import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import pg from 'pg';
import app from '../index.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/fastcheck',
});

describe('Hospital Routing Endpoint Integration Tests', () => {
  // Seed 5 hospitals with known coordinates before tests
  beforeAll(async () => {
    // Clear existing hospitals
    await pool.query('DELETE FROM hospitals');

    // Insert test hospitals
    const hospitals = [
      { name: 'Hospital A', state: 'TN', district: 'Chennai', lat: 13.0827, lng: 80.2707, phone: '111', hasThrombolysis: true, hasCt: true, tier: 1 },
      { name: 'Hospital B', state: 'TN', district: 'Chennai', lat: 13.0827, lng: 80.2707, phone: '222', hasThrombolysis: false, hasCt: true, tier: 2 },
      { name: 'Hospital C', state: 'TN', district: 'Madurai', lat: 9.9252, lng: 78.1198, phone: '333', hasThrombolysis: true, hasCt: true, tier: 1 },
      { name: 'Hospital D', state: 'TN', district: 'Salem', lat: 11.6643, lng: 78.1460, phone: '444', hasThrombolysis: false, hasCt: false, tier: 3 },
      { name: 'Hospital E', state: 'TN', district: 'Coimbatore', lat: 11.0168, lng: 76.9558, phone: '555', hasThrombolysis: true, hasCt: true, tier: 1 },
    ];

    for (const h of hospitals) {
      await pool.query(
        `INSERT INTO hospitals (name, state, district, lat, lng, emergency_phone, has_thrombolysis, has_ct, tier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [h.name, h.state, h.district, h.lat, h.lng, h.phone, h.hasThrombolysis, h.hasCt, h.tier]
      );
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM hospitals');
    await pool.end();
  });

  // Test: GET /api/hospitals/nearest?lat=13.08&lng=80.27 returns exactly 3 results sorted by sortScore
  it('should return exactly 3 hospitals sorted by sortScore', async () => {
    const res = await request(app)
      .get('/api/hospitals/nearest?lat=13.08&lng=80.27')
      .expect(200);

    expect(res.body).toHaveLength(3);
    
    // Verify sorted by sortScore ascending
    for (let i = 0; i < res.body.length - 1; i++) {
      expect(res.body[i].sortScore).toBeLessThanOrEqual(res.body[i + 1].sortScore);
    }
  });

  // Test: thrombolysis-capable hospital ranks above equidistant non-capable hospital
  it('should rank thrombolysis-capable hospital above equidistant non-capable hospital', async () => {
    const res = await request(app)
      .get('/api/hospitals/nearest?lat=13.0827&lng=80.2707')
      .expect(200);

    // Hospital A and B are at exact same coordinates, A has thrombolysis
    expect(res.body[0].hasThrombolysis).toBe(true);
    expect(res.body[0].name).toBe('Hospital A');
  });

  // Test: missing lat parameter → HTTP 400
  it('should return 400 when lat is missing', async () => {
    const res = await request(app)
      .get('/api/hospitals/nearest?lng=80.27')
      .expect(400);

    expect(res.body.error).toBe('Missing parameter');
  });

  // Test: missing lng parameter → HTTP 400
  it('should return 400 when lng is missing', async () => {
    const res = await request(app)
      .get('/api/hospitals/nearest?lat=13.08')
      .expect(400);

    expect(res.body.error).toBe('Missing parameter');
  });

  // Test: lat out of range → HTTP 400
  it('should return 400 when lat is out of range', async () => {
    const res = await request(app)
      .get('/api/hospitals/nearest?lat=100&lng=80.27')
      .expect(400);

    expect(res.body.error).toBe('Out of range');
  });

  // Test: lng out of range → HTTP 400
  it('should return 400 when lng is out of range', async () => {
    const res = await request(app)
      .get('/api/hospitals/nearest?lat=13.08&lng=200')
      .expect(400);

    expect(res.body.error).toBe('Out of range');
  });
});