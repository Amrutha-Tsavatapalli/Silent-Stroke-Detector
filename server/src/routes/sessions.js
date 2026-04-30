import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

const VALID_LANGUAGES = ['en', 'hi', 'ta', 'te'];
const VALID_RISK_LEVELS = ['CLEAR', 'WARN', 'FLAG'];
const SCORE_FIELDS = ['faceScore', 'speechScore', 'armScore', 'riskScore'];

/**
 * POST /api/sessions
 * Body: { language }
 * Creates a new scan session and returns { id, createdAt } with HTTP 201.
 */
router.post('/', async (req, res) => {
  const { language } = req.body;

  if (!language || !VALID_LANGUAGES.includes(language)) {
    return res.status(400).json({
      error: 'Invalid language',
      detail: `language must be one of: ${VALID_LANGUAGES.join(', ')}`,
    });
  }

  try {
    const result = await query(
      'INSERT INTO scan_sessions (language) VALUES ($1) RETURNING id, created_at',
      [language]
    );

    const row = result.rows[0];
    return res.status(201).json({
      id: row.id,
      createdAt: row.created_at,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

/**
 * PATCH /api/sessions/:id
 * Body: { faceScore, speechScore, armScore, riskScore, riskLevel, district, hospitalId, alertSent }
 * Updates the session; returns HTTP 204 on success, HTTP 404 if not found.
 */
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    faceScore,
    speechScore,
    armScore,
    riskScore,
    riskLevel,
    district,
    hospitalId,
    alertSent,
  } = req.body;

  // Validate score fields are in [0, 1] if provided
  for (const field of SCORE_FIELDS) {
    const value = req.body[field];
    if (value !== undefined && value !== null) {
      const num = Number(value);
      if (Number.isNaN(num) || num < 0 || num > 1) {
        return res.status(400).json({
          error: 'Invalid score value',
          detail: `${field} must be a number in [0, 1]`,
        });
      }
    }
  }

  // Validate riskLevel if provided
  if (riskLevel !== undefined && riskLevel !== null) {
    if (!VALID_RISK_LEVELS.includes(riskLevel)) {
      return res.status(400).json({
        error: 'Invalid riskLevel',
        detail: `riskLevel must be one of: ${VALID_RISK_LEVELS.join(', ')}`,
      });
    }
  }

  // Build dynamic SET clause from provided fields
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  const fieldMap = {
    faceScore: 'face_score',
    speechScore: 'speech_score',
    armScore: 'arm_score',
    riskScore: 'risk_score',
    riskLevel: 'risk_level',
    district: 'district',
    hospitalId: 'hospital_id',
    alertSent: 'alert_sent',
  };

  for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
    const value = req.body[jsKey];
    if (value !== undefined) {
      setClauses.push(`${dbCol} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    // Nothing to update — still return 204
    return res.status(204).send();
  }

  values.push(id); // for the WHERE clause
  const sql = `UPDATE scan_sessions SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id`;

  try {
    const result = await query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found', detail: `No session with id ${id}` });
    }

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

/**
 * POST /api/sessions/:id/frames
 * Body: { frames: [{ frameTs, rawScore, faceDetected }] }
 * Bulk-inserts frame logs; returns HTTP 201 on success, HTTP 404 if session not found.
 */
router.post('/:id/frames', async (req, res) => {
  const { id } = req.params;
  const { frames } = req.body;

  if (!Array.isArray(frames) || frames.length === 0) {
    return res.status(400).json({
      error: 'Invalid frames',
      detail: 'frames must be a non-empty array',
    });
  }

  // Validate frameTs >= 0 for all frames
  for (let i = 0; i < frames.length; i++) {
    const { frameTs } = frames[i];
    if (frameTs === undefined || frameTs === null || Number(frameTs) < 0) {
      return res.status(400).json({
        error: 'Invalid frameTs',
        detail: `frames[${i}].frameTs must be >= 0`,
      });
    }
  }

  // Check session exists
  try {
    const sessionCheck = await query('SELECT id FROM scan_sessions WHERE id = $1', [id]);
    if (sessionCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found', detail: `No session with id ${id}` });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }

  // Bulk-insert using unnest for efficiency
  try {
    const sessionIds = frames.map(() => id);
    const frameTsArr = frames.map((f) => Number(f.frameTs));
    const rawScoreArr = frames.map((f) => Number(f.rawScore));
    const faceDetectedArr = frames.map((f) => Boolean(f.faceDetected));

    await query(
      `INSERT INTO frame_logs (session_id, frame_ts, raw_score, face_detected)
       SELECT * FROM unnest($1::uuid[], $2::int[], $3::numeric[], $4::bool[])`,
      [sessionIds, frameTsArr, rawScoreArr, faceDetectedArr]
    );

    return res.status(201).send();
  } catch (err) {
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

export default router;
