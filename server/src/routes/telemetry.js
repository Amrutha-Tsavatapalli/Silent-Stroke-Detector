import { Router } from 'express';
import { query } from '../db.js';
import telemetryService from '../services/telemetryService.js';

const router = Router();

// Use thresholds from telemetry service (shared state)
const { getThresholds, adjustThresholds, setThresholds } = telemetryService;

/**
 * Helper: Calculate median from array of numbers
 */
function calculateMedian(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Helper: Calculate standard deviation from array of numbers
 */
function calculateStdDev(arr) {
  if (!arr || arr.length < 2) return null;
  const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
  const squaredDiffs = arr.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * GET /api/telemetry/summary
 * Query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns aggregate statistics for all score types
 */
router.get('/summary', async (req, res) => {
  const { startDate, endDate } = req.query;

  // Build date filter if provided
  let dateFilter = '';
  const params = [];
  let paramIndex = 1;

  if (startDate || endDate) {
    const conditions = [];
    if (startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      conditions.push(`created_at <= $${paramIndex}::date + interval '1 day'`);
      params.push(endDate);
      paramIndex++;
    }
    dateFilter = `WHERE ${conditions.join(' AND ')}`;
  }

  try {
    // Get all sessions with scores within date range
    const result = await query(
      `SELECT face_score, speech_score, arm_score, risk_score, risk_level
       FROM scan_sessions
       ${dateFilter}
       ORDER BY created_at`,
      params
    );

    const sessions = result.rows;

    // Extract non-null scores for each type
    const faceScores = sessions
      .map((s) => s.face_score)
      .filter((s) => s !== null && s !== undefined);
    const speechScores = sessions
      .map((s) => s.speech_score)
      .filter((s) => s !== null && s !== undefined);
    const armScores = sessions
      .map((s) => s.arm_score)
      .filter((s) => s !== null && s !== undefined);
    const riskScores = sessions
      .map((s) => s.risk_score)
      .filter((s) => s !== null && s !== undefined);

    // Calculate aggregate statistics for each score type
    const calculateStats = (scores, name) => {
      if (scores.length === 0) {
        return { name, count: 0, mean: null, median: null, stddev: null };
      }
      const mean = scores.reduce((sum, val) => sum + Number(val), 0) / scores.length;
      return {
        name,
        count: scores.length,
        mean: Math.round(mean * 10000) / 10000,
        median: Math.round(calculateMedian(scores) * 10000) / 10000,
        stddev: Math.round(calculateStdDev(scores.map(Number)) * 10000) / 10000,
      };
    };

    // Count sessions by risk level
    const flagCount = sessions.filter((s) => s.risk_level === 'FLAG').length;
    const warnCount = sessions.filter((s) => s.risk_level === 'WARN').length;
    const clearCount = sessions.filter((s) => s.risk_level === 'CLEAR').length;

    return res.json({
      totalSessions: sessions.length,
      counts: {
        FLAG: flagCount,
        WARN: warnCount,
        CLEAR: clearCount,
      },
      statistics: [
        calculateStats(faceScores, 'face_score'),
        calculateStats(speechScores, 'speech_score'),
        calculateStats(armScores, 'arm_score'),
        calculateStats(riskScores, 'risk_score'),
      ],
    });
  } catch (err) {
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

/**
 * GET /api/telemetry/thresholds
 * Returns current fusion thresholds
 */
router.get('/thresholds', (req, res) => {
  const currentThresholds = getThresholds();
  return res.json({
    warnThreshold: currentThresholds.warnThreshold,
    flagThreshold: currentThresholds.flagThreshold,
  });
});

/**
 * PATCH /api/telemetry/thresholds
 * Body: { warnThreshold, flagThreshold }
 * Requires admin API key in header (X-Admin-Key)
 * Validates: warnThreshold < flagThreshold, both in (0, 1)
 */
router.patch('/thresholds', async (req, res) => {
  const { warnThreshold, flagThreshold } = req.body;
  const adminKey = req.headers['x-admin-key'];

  // Check for admin API key
  if (!adminKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      detail: 'Admin API key required in X-Admin-Key header',
    });
  }

  // Validate admin key (in production, this should be compared against a secure key)
  // For now, we check if it matches the environment variable
  const validAdminKey = process.env.ADMIN_API_KEY;
  if (validAdminKey && adminKey !== validAdminKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      detail: 'Invalid admin API key',
    });
  }

  // Validate threshold values
  if (warnThreshold === undefined || flagThreshold === undefined) {
    return res.status(400).json({
      error: 'Invalid thresholds',
      detail: 'Both warnThreshold and flagThreshold are required',
    });
  }

  const warnVal = Number(warnThreshold);
  const flagVal = Number(flagThreshold);

  if (Number.isNaN(warnVal) || Number.isNaN(flagVal)) {
    return res.status(400).json({
      error: 'Invalid thresholds',
      detail: 'Thresholds must be numbers',
    });
  }

  if (warnVal <= 0 || warnVal >= 1 || flagVal <= 0 || flagVal >= 1) {
    return res.status(400).json({
      error: 'Invalid thresholds',
      detail: 'Thresholds must be in the range (0, 1)',
    });
  }

  if (warnVal >= flagVal) {
    return res.status(400).json({
      error: 'Invalid thresholds',
      detail: 'warnThreshold must be less than flagThreshold',
    });
  }

  // Use the service to set thresholds (validates and logs)
  try {
    const updated = setThresholds(warnVal, flagVal);
    return res.json({
      warnThreshold: updated.warnThreshold,
      flagThreshold: updated.flagThreshold,
      message: 'Thresholds updated successfully',
    });
  } catch (err) {
    return res.status(400).json({
      error: 'Invalid thresholds',
      detail: err.message,
    });
  }
});

/**
 * POST /api/telemetry/adjust
 * Body: { dryRun: boolean, days: number }
 * Automatically adjusts thresholds based on statistical analysis
 * Requires admin API key in header (X-Admin-Key)
 */
router.post('/adjust', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  const { dryRun, days } = req.body;

  // Check for admin API key
  if (!adminKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      detail: 'Admin API key required in X-Admin-Key header',
    });
  }

  // Validate admin key
  const validAdminKey = process.env.ADMIN_API_KEY;
  if (validAdminKey && adminKey !== validAdminKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      detail: 'Invalid admin API key',
    });
  }

  try {
    const result = await adjustThresholds({
      dryRun: dryRun === true,
      days: days || undefined,
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      error: 'Threshold adjustment failed',
      detail: err.message,
    });
  }
});

export default router;