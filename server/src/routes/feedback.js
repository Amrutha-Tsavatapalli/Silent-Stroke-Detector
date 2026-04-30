import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

/**
 * POST /api/feedback/:id
 * Params: id — session UUID
 * Body: { wasStroke?: boolean, notes?: string }
 *
 * Inserts a feedback record linked to the given session.
 * Returns HTTP 201 with { id, sessionId, submittedAt } on success.
 * Returns HTTP 404 if the session does not exist.
 * Returns HTTP 409 if feedback already exists for this session.
 *
 * Requirements: 9.5, 9.6
 */
router.post('/:id', async (req, res) => {
  const { id } = req.params;
  const { wasStroke, notes } = req.body;

  // Check session exists
  try {
    const sessionCheck = await query(
      'SELECT id FROM scan_sessions WHERE id = $1',
      [id]
    );

    if (sessionCheck.rowCount === 0) {
      return res.status(404).json({
        error: 'Session not found',
        detail: `No session with id ${id}`,
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }

  // Check for existing feedback (enforce unique constraint at app layer for a clear 409)
  try {
    const existingCheck = await query(
      'SELECT id FROM feedback WHERE session_id = $1',
      [id]
    );

    if (existingCheck.rowCount > 0) {
      return res.status(409).json({
        error: 'Feedback already exists',
        detail: `Feedback has already been submitted for session ${id}`,
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }

  // Insert feedback record
  try {
    const result = await query(
      `INSERT INTO feedback (session_id, was_stroke, notes)
       VALUES ($1, $2, $3)
       RETURNING id, session_id, submitted_at`,
      [id, wasStroke ?? null, notes ?? null]
    );

    const row = result.rows[0];
    return res.status(201).json({
      id: row.id,
      sessionId: row.session_id,
      submittedAt: row.submitted_at,
    });
  } catch (err) {
    // Handle race condition where two concurrent inserts both pass the check above
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Feedback already exists',
        detail: `Feedback has already been submitted for session ${id}`,
      });
    }
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

export default router;
