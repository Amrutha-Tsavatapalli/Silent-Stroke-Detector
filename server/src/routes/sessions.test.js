import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import pg from 'pg';
import app from '../index.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/fastcheck',
});

describe('Backend Session Flow Integration Tests', () => {
  let sessionId;

  afterAll(async () => {
    await pool.end();
  });

  // Test: POST /api/sessions → PATCH /api/sessions/:id → POST /api/sessions/:id/frames
  it('should create session, update scores, and insert frames', async () => {
    // Create session
    const createRes = await request(app)
      .post('/api/sessions')
      .send({ language: 'en' })
      .expect(201);

    expect(createRes.body).toHaveProperty('id');
    expect(createRes.body).toHaveProperty('createdAt');
    sessionId = createRes.body.id;

    // Update session with scores
    const updateRes = await request(app)
      .patch(`/api/sessions/${sessionId}`)
      .send({
        faceScore: 0.3,
        speechScore: 0.5,
        armScore: 0.0,
        riskScore: 0.25,
        riskLevel: 'CLEAR',
      })
      .expect(204);

    // Insert frames
    const framesRes = await request(app)
      .post(`/api/sessions/${sessionId}/frames`)
      .send({
        frames: [
          { frameTs: 0, rawScore: 0.01, faceDetected: true },
          { frameTs: 100, rawScore: 0.015, faceDetected: true },
          { frameTs: 200, rawScore: 0.012, faceDetected: true },
        ],
      })
      .expect(201);

    // Verify DB state
    const sessionCheck = await pool.query(
      'SELECT face_score, speech_score, arm_score, risk_score, risk_level FROM scan_sessions WHERE id = $1',
      [sessionId]
    );
    expect(sessionCheck.rows[0].face_score).toBe('0.3000');
    expect(sessionCheck.rows[0].speech_score).toBe('0.5000');
    expect(sessionCheck.rows[0].arm_score).toBe('0.00');
    expect(sessionCheck.rows[0].risk_score).toBe('0.2500');
    expect(sessionCheck.rows[0].risk_level).toBe('CLEAR');

    const framesCheck = await pool.query(
      'SELECT COUNT(*) FROM frame_logs WHERE session_id = $1',
      [sessionId]
    );
    expect(framesCheck.rows[0].count).toBe('3');
  });

  // Test: POST /api/sessions with invalid language → HTTP 400
  it('should return 400 for invalid language', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ language: 'invalid' })
      .expect(400);

    expect(res.body.error).toBe('Invalid language');
  });

  // Test: PATCH /api/sessions/:id with unknown UUID → HTTP 404
  it('should return 404 for unknown session UUID', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .patch(`/api/sessions/${fakeId}`)
      .send({ faceScore: 0.5 })
      .expect(404);

    expect(res.body.error).toBe('Session not found');
  });

  // Test: POST /api/feedback/:id twice for same session → HTTP 409
  it('should return 409 when submitting feedback twice for same session', async () => {
    // Create a new session
    const createRes = await request(app)
      .post('/api/sessions')
      .send({ language: 'en' })
      .expect(201);

    const newSessionId = createRes.body.id;

    // Submit feedback first time
    await request(app)
      .post(`/api/feedback/${newSessionId}`)
      .send({ wasStroke: true, notes: 'Test note' })
      .expect(201);

    // Submit feedback second time → should be 409
    const res = await request(app)
      .post(`/api/feedback/${newSessionId}`)
      .send({ wasStroke: false })
      .expect(409);

    expect(res.body.error).toBe('Feedback already exists');
  });
});