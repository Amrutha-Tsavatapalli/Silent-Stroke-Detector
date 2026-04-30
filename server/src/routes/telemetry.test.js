import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import pg from 'pg';
import app from '../index.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/fastcheck',
});

describe('Telemetry API Tests', () => {
  let sessionId;

  afterAll(async () => {
    await pool.end();
  });

  // Create test sessions with scores for summary testing
  beforeAll(async () => {
    // Create a few test sessions with different scores and risk levels
    const sessions = [
      { language: 'en', faceScore: 0.3, speechScore: 0.2, armScore: 0.1, riskScore: 0.2, riskLevel: 'CLEAR' },
      { language: 'en', faceScore: 0.5, speechScore: 0.4, armScore: 0.3, riskScore: 0.4, riskLevel: 'WARN' },
      { language: 'en', faceScore: 0.7, speechScore: 0.6, armScore: 0.5, riskScore: 0.6, riskLevel: 'FLAG' },
      { language: 'en', faceScore: 0.2, speechScore: 0.1, armScore: 0.0, riskScore: 0.1, riskLevel: 'CLEAR' },
      { language: 'en', faceScore: 0.6, speechScore: 0.5, armScore: 0.4, riskScore: 0.5, riskLevel: 'WARN' },
    ];

    for (const s of sessions) {
      const res = await request(app)
        .post('/api/sessions')
        .send({ language: s.language })
        .expect(201);
      sessionId = res.body.id;

      await request(app)
        .patch(`/api/sessions/${sessionId}`)
        .send({
          faceScore: s.faceScore,
          speechScore: s.speechScore,
          armScore: s.armScore,
          riskScore: s.riskScore,
          riskLevel: s.riskLevel,
        })
        .expect(204);
    }
  });

  // Test: GET /api/telemetry/summary returns aggregate statistics
  it('should return aggregate statistics for all score types', async () => {
    const res = await request(app)
      .get('/api/telemetry/summary')
      .expect(200);

    expect(res.body).toHaveProperty('totalSessions');
    expect(res.body).toHaveProperty('counts');
    expect(res.body).toHaveProperty('statistics');
    expect(res.body.statistics).toHaveLength(4);

    // Check statistics structure
    const scoreTypes = ['face_score', 'speech_score', 'arm_score', 'risk_score'];
    for (const stat of res.body.statistics) {
      expect(scoreTypes).toContain(stat.name);
      expect(stat).toHaveProperty('count');
      expect(stat).toHaveProperty('mean');
      expect(stat).toHaveProperty('median');
      expect(stat).toHaveProperty('stddev');
    }

    // Check counts
    expect(res.body.counts).toHaveProperty('FLAG');
    expect(res.body.counts).toHaveProperty('WARN');
    expect(res.body.counts).toHaveProperty('CLEAR');
    expect(res.body.counts.FLAG).toBe(1);
    expect(res.body.counts.WARN).toBe(2);
    expect(res.body.counts.CLEAR).toBe(2);
  });

  // Test: GET /api/telemetry/summary with date filters
  it('should filter by date range when startDate and endDate provided', async () => {
    const res = await request(app)
      .get('/api/telemetry/summary?startDate=2020-01-01&endDate=2030-12-31')
      .expect(200);

    expect(res.body.totalSessions).toBe(5);
  });

  // Test: GET /api/telemetry/thresholds returns current thresholds
  it('should return current fusion thresholds', async () => {
    const res = await request(app)
      .get('/api/telemetry/thresholds')
      .expect(200);

    expect(res.body).toHaveProperty('warnThreshold');
    expect(res.body).toHaveProperty('flagThreshold');
    expect(res.body.warnThreshold).toBe(0.35);
    expect(res.body.flagThreshold).toBe(0.55);
  });

  // Test: PATCH /api/telemetry/thresholds without admin key returns 401
  it('should return 401 when admin key is missing', async () => {
    const res = await request(app)
      .patch('/api/telemetry/thresholds')
      .send({ warnThreshold: 0.4, flagThreshold: 0.6 })
      .expect(401);

    expect(res.body.error).toBe('Unauthorized');
  });

  // Test: PATCH /api/telemetry/thresholds with invalid admin key returns 401
  it('should return 401 when admin key is invalid', async () => {
    const res = await request(app)
      .patch('/api/telemetry/thresholds')
      .set('X-Admin-Key', 'invalid-key')
      .send({ warnThreshold: 0.4, flagThreshold: 0.6 })
      .expect(401);

    expect(res.body.error).toBe('Unauthorized');
  });

  // Test: PATCH /api/telemetry/thresholds with valid admin key
  it('should update thresholds with valid admin key', async () => {
    // Set admin key in environment for testing
    process.env.ADMIN_API_KEY = 'test-admin-key';

    const res = await request(app)
      .patch('/api/telemetry/thresholds')
      .set('X-Admin-Key', 'test-admin-key')
      .send({ warnThreshold: 0.4, flagThreshold: 0.6 })
      .expect(200);

    expect(res.body.warnThreshold).toBe(0.4);
    expect(res.body.flagThreshold).toBe(0.6);
    expect(res.body.message).toBe('Thresholds updated successfully');

    // Verify thresholds were actually updated
    const getRes = await request(app)
      .get('/api/telemetry/thresholds')
      .expect(200);
    expect(getRes.body.warnThreshold).toBe(0.4);
    expect(getRes.body.flagThreshold).toBe(0.6);

    // Reset to defaults
    await request(app)
      .patch('/api/telemetry/thresholds')
      .set('X-Admin-Key', 'test-admin-key')
      .send({ warnThreshold: 0.35, flagThreshold: 0.55 })
      .expect(200);

    delete process.env.ADMIN_API_KEY;
  });

  // Test: PATCH /api/telemetry/thresholds validates warnThreshold < flagThreshold
  it('should return 400 when warnThreshold >= flagThreshold', async () => {
    process.env.ADMIN_API_KEY = 'test-admin-key';

    const res = await request(app)
      .patch('/api/telemetry/thresholds')
      .set('X-Admin-Key', 'test-admin-key')
      .send({ warnThreshold: 0.6, flagThreshold: 0.4 })
      .expect(400);

    expect(res.body.error).toBe('Invalid thresholds');
    expect(res.body.detail).toContain('warnThreshold must be less than flagThreshold');

    delete process.env.ADMIN_API_KEY;
  });

  // Test: PATCH /api/telemetry/thresholds validates range (0, 1)
  it('should return 400 when thresholds are outside (0, 1) range', async () => {
    process.env.ADMIN_API_KEY = 'test-admin-key';

    // Test with threshold = 0
    const res1 = await request(app)
      .patch('/api/telemetry/thresholds')
      .set('X-Admin-Key', 'test-admin-key')
      .send({ warnThreshold: 0, flagThreshold: 0.5 })
      .expect(400);
    expect(res1.body.detail).toContain('(0, 1)');

    // Test with threshold = 1
    const res2 = await request(app)
      .patch('/api/telemetry/thresholds')
      .set('X-Admin-Key', 'test-admin-key')
      .send({ warnThreshold: 0.3, flagThreshold: 1 })
      .expect(400);
    expect(res2.body.detail).toContain('(0, 1)');

    delete process.env.ADMIN_API_KEY;
  });

  // Test: GET /api/telemetry/summary with empty database
  it('should handle empty sessions gracefully', async () => {
    // This test would require a clean database or specific date filtering
    // For now, we verify the endpoint works with the existing data
    const res = await request(app)
      .get('/api/telemetry/summary?startDate=2030-01-01&endDate=2030-12-31')
      .expect(200);

    expect(res.body.totalSessions).toBe(0);
    expect(res.body.counts.FLAG).toBe(0);
    expect(res.body.counts.WARN).toBe(0);
    expect(res.body.counts.CLEAR).toBe(0);
  });
});