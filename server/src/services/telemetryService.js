/**
 * Telemetry Service - Dynamic Threshold Adjustment
 * 
 * Provides Statistical Process Control (SPC) based threshold adjustment
 * for the FAST Check risk score fusion system.
 * 
 * Requirements: 11.5, 11.6
 */

import { query } from '../db.js';

// In-memory thresholds store (shared with telemetry routes)
const thresholds = {
  warnThreshold: 0.35,
  flagThreshold: 0.55,
};

// Configuration for threshold adjustment
const CONFIG = {
  // Minimum sessions required for analysis
  minSessionsForAnalysis: 30,
  
  // Number of days to look back for analysis
  analysisWindowDays: 30,
  
  // SPC control limits
  spcControlLimit: 2.0,  // Standard deviations for control limits
  
  // Drift detection thresholds
  meanShiftThreshold: 0.1,  // Significant mean shift to trigger adjustment
  feedbackAccuracyThreshold: 0.7,  // Minimum accuracy to consider thresholds calibrated
  
  // Maximum adjustment per run (to prevent sudden large changes)
  maxAdjustmentPerRun: 0.05,
  
  // Moving average window size for SPC
  movingAverageWindow: 10,
};

/**
 * Get recent scan sessions for analysis
 * 
 * @param {number} days - Number of days to look back (default: CONFIG.analysisWindowDays)
 * @param {number} limit - Maximum number of sessions to return (default: 1000)
 * @returns {Promise<Array>} Array of session objects with scores and feedback
 */
export async function getRecentSessions(days = CONFIG.analysisWindowDays, limit = 1000) {
  const result = await query(
    `SELECT 
       s.id,
       s.created_at,
       s.face_score,
       s.speech_score,
       s.arm_score,
       s.risk_score,
       s.risk_level,
       f.was_stroke,
       f.submitted_at as feedback_submitted_at
     FROM scan_sessions s
     LEFT JOIN feedback f ON s.id = f.session_id
     WHERE s.created_at >= NOW() - INTERVAL '${days} days'
       AND s.risk_score IS NOT NULL
     ORDER BY s.created_at DESC
     LIMIT $1`,
    [limit]
  );
  
  return result.rows.map(row => ({
    id: row.id,
    createdAt: row.created_at,
    faceScore: row.face_score ? Number(row.face_score) : null,
    speechScore: row.speech_score ? Number(row.speech_score) : null,
    armScore: row.arm_score ? Number(row.arm_score) : null,
    riskScore: row.risk_score ? Number(row.risk_score) : null,
    riskLevel: row.risk_level,
    wasStroke: row.was_stroke,
    feedbackSubmittedAt: row.feedback_submitted_at,
  }));
}

/**
 * Calculate statistical measures for an array of scores
 * 
 * @param {number[]} scores - Array of numeric scores
 * @returns {Object} Statistics object with mean, stddev, median, percentiles
 */
function calculateStatistics(scores) {
  if (!scores || scores.length === 0) {
    return {
      count: 0,
      mean: null,
      stddev: null,
      median: null,
      p25: null,
      p75: null,
      min: null,
      max: null,
    };
  }
  
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;
  
  const squaredDiffs = sorted.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / n;
  const stddev = Math.sqrt(variance);
  
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  
  const percentile = (p) => {
    const index = Math.ceil(p * n) - 1;
    return sorted[Math.max(0, index)];
  };
  
  return {
    count: n,
    mean: Math.round(mean * 10000) / 10000,
    stddev: Math.round(stddev * 10000) / 10000,
    median: Math.round(median * 10000) / 10000,
    p25: Math.round(percentile(0.25) * 10000) / 10000,
    p75: Math.round(percentile(0.75) * 10000) / 10000,
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/**
 * Calculate SPC-style drift indicator
 * Uses moving average and control chart principles to detect score drift
 * 
 * @param {number[]} scores - Array of risk scores in chronological order
 * @returns {Object} Drift indicator with status and details
 */
export function calculateDriftIndicator(scores) {
  if (!scores || scores.length < CONFIG.movingAverageWindow) {
    return {
      hasDrift: false,
      driftDirection: null,
      driftMagnitude: 0,
      movingAverage: null,
      controlStatus: 'insufficient_data',
      justification: 'Insufficient data for SPC analysis',
    };
  }
  
  // Calculate moving average
  const windowSize = Math.min(CONFIG.movingAverageWindow, scores.length);
  const movingAverages = [];
  
  for (let i = windowSize - 1; i < scores.length; i++) {
    const window = scores.slice(i - windowSize + 1, i + 1);
    const avg = window.reduce((sum, val) => sum + val, 0) / windowSize;
    movingAverages.push(avg);
  }
  
  // Calculate overall mean and stddev of moving averages
  const stats = calculateStatistics(movingAverages);
  
  // Compare recent moving average to overall baseline
  const recentWindow = movingAverages.slice(-windowSize);
  const recentMean = recentWindow.reduce((sum, val) => sum + val, 0) / recentWindow.length;
  
  // Calculate drift
  const overallMean = stats.mean;
  const driftMagnitude = Math.abs(recentMean - overallMean);
  const driftDirection = recentMean > overallMean ? 'up' : (recentMean < overallMean ? 'down' : 'none');
  
  // Control status based on SPC principles
  let controlStatus = 'in_control';
  if (stats.stddev && stats.stddev > 0) {
    const zScore = (recentMean - overallMean) / stats.stddev;
    if (Math.abs(zScore) > CONFIG.spcControlLimit) {
      controlStatus = 'out_of_control';
    } else if (Math.abs(zScore) > CONFIG.spcControlLimit * 0.5) {
      controlStatus = 'warning';
    }
  }
  
  const hasDrift = driftMagnitude > CONFIG.meanShiftThreshold || controlStatus === 'out_of_control';
  
  return {
    hasDrift,
    driftDirection,
    driftMagnitude: Math.round(driftMagnitude * 10000) / 10000,
    movingAverage: Math.round(recentMean * 10000) / 10000,
    controlStatus,
    zScore: stats.stddev ? Math.round(((recentMean - overallMean) / stats.stddev) * 10000) / 10000 : 0,
    justification: hasDrift
      ? `Detected ${driftDirection}ward drift of ${driftMagnitude.toFixed(4)} in risk scores. Control status: ${controlStatus}.`
      : 'Risk scores are within normal variation limits.',
  };
}

/**
 * Calculate feedback accuracy - how well predictions match actual outcomes
 * Compares predicted risk levels with feedback (was_stroke)
 * 
 * @returns {Object} Feedback accuracy metrics
 */
export async function calculateFeedbackAccuracy() {
  const result = await query(
    `SELECT 
       s.risk_level,
       f.was_stroke,
       COUNT(*) as count
     FROM scan_sessions s
     INNER JOIN feedback f ON s.id = f.session_id
     WHERE f.was_stroke IS NOT NULL
     GROUP BY s.risk_level, f.was_stroke`
  );
  
  const matrix = {
    truePositive: 0,  // FLAG + was_stroke = true
    falsePositive: 0, // FLAG + was_stroke = false
    trueNegative: 0,  // CLEAR + was_stroke = false
    falseNegative: 0, // CLEAR + was_stroke = true
    warnTrue: 0,      // WARN + was_stroke = true
    warnFalse: 0,     // WARN + was_stroke = false
  };
  
  result.rows.forEach(row => {
    const level = row.risk_level;
    const wasStroke = row.was_stroke;
    const count = parseInt(row.count, 10);
    
    if (level === 'FLAG' && wasStroke) {
      matrix.truePositive += count;
    } else if (level === 'FLAG' && !wasStroke) {
      matrix.falsePositive += count;
    } else if (level === 'CLEAR' && !wasStroke) {
      matrix.trueNegative += count;
    } else if (level === 'CLEAR' && wasStroke) {
      matrix.falseNegative += count;
    } else if (level === 'WARN' && wasStroke) {
      matrix.warnTrue += count;
    } else if (level === 'WARN' && !wasStroke) {
      matrix.warnFalse += count;
    }
  });
  
  const total = matrix.truePositive + matrix.falsePositive + 
                matrix.trueNegative + matrix.falseNegative + 
                matrix.warnTrue + matrix.warnFalse;
  
  // Calculate precision (for FLAG predictions)
  const flagPrecision = matrix.truePositive + matrix.falsePositive > 0
    ? matrix.truePositive / (matrix.truePositive + matrix.falsePositive)
    : null;
  
  // Calculate recall (how many actual strokes were flagged)
  const strokeCases = matrix.truePositive + matrix.falseNegative + matrix.warnTrue;
  const recall = strokeCases > 0
    ? (matrix.truePositive + matrix.warnTrue * 0.5) / strokeCases
    : null;
  
  // Calculate overall accuracy
  const accuracy = total > 0
    ? (matrix.truePositive + matrix.trueNegative) / total
    : null;
  
  // Determine if thresholds need adjustment based on feedback
  let needsAdjustment = false;
  let adjustmentReason = null;
  
  if (accuracy !== null && accuracy < CONFIG.feedbackAccuracyThreshold) {
    needsAdjustment = true;
    adjustmentReason = `Low accuracy (${(accuracy * 100).toFixed(1)}%) indicates thresholds may be miscalibrated`;
  } else if (flagPrecision !== null && flagPrecision < 0.5 && matrix.truePositive + matrix.falsePositive > 5) {
    needsAdjustment = true;
    adjustmentReason = `Low FLAG precision (${(flagPrecision * 100).toFixed(1)}%) - too many false alarms`;
  } else if (recall !== null && recall < 0.6 && strokeCases > 5) {
    needsAdjustment = true;
    adjustmentReason = `Low recall (${(recall * 100).toFixed(1)}%) - missing actual stroke cases`;
  }
  
  return {
    matrix,
    total,
    accuracy: accuracy ? Math.round(accuracy * 10000) / 10000 : null,
    flagPrecision: flagPrecision ? Math.round(flagPrecision * 10000) / 10000 : null,
    recall: recall ? Math.round(recall * 10000) / 10000 : null,
    needsAdjustment,
    adjustmentReason,
    sampleSize: strokeCases,
  };
}

/**
 * Main function: Adjust thresholds based on statistical analysis
 * 
 * @param {Object} options - Adjustment options
 * @param {boolean} options.dryRun - If true, don't actually apply changes (default: false)
 * @param {number} options.days - Number of days to analyze (default: CONFIG.analysisWindowDays)
 * @param {number} options.minSessions - Minimum sessions required (default: CONFIG.minSessionsForAnalysis)
 * @returns {Object} Adjustment result with old thresholds, new thresholds, and justification
 */
export async function adjustThresholds(options = {}) {
  const {
    dryRun = false,
    days = CONFIG.analysisWindowDays,
    minSessions = CONFIG.minSessionsForAnalysis,
  } = options;
  
  const timestamp = new Date().toISOString();
  const justifications = [];
  
  // Get current thresholds
  const oldWarnThreshold = thresholds.warnThreshold;
  const oldFlagThreshold = thresholds.flagThreshold;
  
  // Get recent sessions
  const sessions = await getRecentSessions(days, 1000);
  
  if (sessions.length < minSessions) {
    return {
      success: false,
      dryRun,
      oldWarnThreshold,
      oldFlagThreshold,
      newWarnThreshold: oldWarnThreshold,
      newFlagThreshold: oldFlagThreshold,
      sessionsAnalyzed: sessions.length,
      minSessionsRequired: minSessions,
      adjusted: false,
      justifications: [`Insufficient data: ${sessions.length} sessions, need at least ${minSessions}`],
      message: 'Threshold adjustment skipped: insufficient data',
    };
  }
  
  // Extract risk scores for analysis
  const riskScores = sessions
    .map(s => s.riskScore)
    .filter(s => s !== null && s !== undefined);
  
  // Calculate score statistics
  const scoreStats = calculateStatistics(riskScores);
  
  // Calculate drift indicator
  const driftIndicator = calculateDriftIndicator(riskScores);
  justifications.push(driftIndicator.justification);
  
  // Calculate feedback accuracy
  const feedbackAccuracy = await calculateFeedbackAccuracy();
  if (feedbackAccuracy.adjustmentReason) {
    justifications.push(feedbackAccuracy.adjustmentReason);
  }
  
  // Determine if adjustment is needed
  let needsAdjustment = driftIndicator.hasDrift || feedbackAccuracy.needsAdjustment;
  
  if (!needsAdjustment) {
    console.log(`[Telemetry][${timestamp}] Threshold adjustment: No adjustment needed`);
    console.log(`  - Sessions analyzed: ${sessions.length}`);
    console.log(`  - Risk score mean: ${scoreStats.mean}, stddev: ${scoreStats.stddev}`);
    console.log(`  - Drift status: ${driftIndicator.controlStatus}`);
    console.log(`  - Feedback accuracy: ${feedbackAccuracy.accuracy ? (feedbackAccuracy.accuracy * 100).toFixed(1) + '%' : 'N/A'}`);
    
    return {
      success: true,
      dryRun,
      oldWarnThreshold,
      oldFlagThreshold,
      newWarnThreshold: oldWarnThreshold,
      newFlagThreshold: oldFlagThreshold,
      sessionsAnalyzed: sessions.length,
      scoreStatistics: scoreStats,
      driftIndicator: {
        hasDrift: driftIndicator.hasDrift,
        driftDirection: driftIndicator.driftDirection,
        driftMagnitude: driftIndicator.driftMagnitude,
        controlStatus: driftIndicator.controlStatus,
      },
      feedbackAccuracy: {
        accuracy: feedbackAccuracy.accuracy,
        flagPrecision: feedbackAccuracy.flagPrecision,
        recall: feedbackAccuracy.recall,
      },
      adjusted: false,
      justifications,
      message: 'Thresholds are within acceptable parameters',
    };
  }
  
  // Calculate new thresholds
  let newWarnThreshold = oldWarnThreshold;
  let newFlagThreshold = oldFlagThreshold;
  
  // Adjust based on drift
  if (driftIndicator.hasDrift && driftIndicator.driftMagnitude > 0) {
    const adjustment = Math.min(
      Math.abs(driftIndicator.driftMagnitude),
      CONFIG.maxAdjustmentPerRun
    );
    
    if (driftIndicator.driftDirection === 'up') {
      // Scores are trending higher - lower thresholds to maintain sensitivity
      newWarnThreshold = Math.max(0.1, oldWarnThreshold - adjustment);
      newFlagThreshold = Math.max(0.2, oldFlagThreshold - adjustment);
      justifications.push(`Lowered thresholds by ${adjustment.toFixed(4)} due to upward score drift`);
    } else if (driftIndicator.driftDirection === 'down') {
      // Scores are trending lower - raise thresholds to maintain specificity
      newWarnThreshold = Math.min(0.8, oldWarnThreshold + adjustment);
      newFlagThreshold = Math.min(0.9, oldFlagThreshold + adjustment);
      justifications.push(`Raised thresholds by ${adjustment.toFixed(4)} due to downward score drift`);
    }
  }
  
  // Adjust based on feedback accuracy
  if (feedbackAccuracy.needsAdjustment && feedbackAccuracy.sampleSize >= 5) {
    if (feedbackAccuracy.flagPrecision !== null && feedbackAccuracy.flagPrecision < 0.5) {
      // Too many false positives - raise flag threshold
      const precisionAdjustment = (0.5 - feedbackAccuracy.flagPrecision) * 0.5;
      newFlagThreshold = Math.min(0.9, newFlagThreshold + precisionAdjustment);
      justifications.push(`Raised flag threshold by ${precisionAdjustment.toFixed(4)} to improve precision`);
    }
    
    if (feedbackAccuracy.recall !== null && feedbackAccuracy.recall < 0.6) {
      // Missing too many actual strokes - lower warn threshold
      const recallAdjustment = (0.6 - feedbackAccuracy.recall) * 0.3;
      newWarnThreshold = Math.max(0.1, newWarnThreshold - recallAdjustment);
      justifications.push(`Lowered warn threshold by ${recallAdjustment.toFixed(4)} to improve recall`);
    }
  }
  
  // Ensure warn < flag
  if (newWarnThreshold >= newFlagThreshold) {
    const gap = newWarnThreshold - newFlagThreshold + 0.05;
    newWarnThreshold = newWarnThreshold - gap / 2;
    newFlagThreshold = newFlagThreshold + gap / 2;
    justifications.push('Adjusted thresholds to maintain warn < flag invariant');
  }
  
  // Apply changes if not dry run
  if (!dryRun) {
    thresholds.warnThreshold = newWarnThreshold;
    thresholds.flagThreshold = newFlagThreshold;
  }
  
  // Log the adjustment
  console.log(`[Telemetry][${timestamp}] Threshold adjustment ${dryRun ? '(DRY RUN)' : ''}:`);
  console.log(`  - Sessions analyzed: ${sessions.length}`);
  console.log(`  - Risk score mean: ${scoreStats.mean}, stddev: ${scoreStats.stddev}`);
  console.log(`  - Drift: ${driftIndicator.driftDirection} (${driftIndicator.driftMagnitude.toFixed(4)})`);
  console.log(`  - Feedback accuracy: ${feedbackAccuracy.accuracy ? (feedbackAccuracy.accuracy * 100).toFixed(1) + '%' : 'N/A'}`);
  console.log(`  - Thresholds: ${oldWarnThreshold} -> ${newWarnThreshold} (warn), ${oldFlagThreshold} -> ${newFlagThreshold} (flag)`);
  justifications.forEach((j, i) => console.log(`  - Justification ${i + 1}: ${j}`));
  
  return {
    success: true,
    dryRun,
    oldWarnThreshold,
    oldFlagThreshold,
    newWarnThreshold: Math.round(newWarnThreshold * 10000) / 10000,
    newFlagThreshold: Math.round(newFlagThreshold * 10000) / 10000,
    sessionsAnalyzed: sessions.length,
    scoreStatistics: scoreStats,
    driftIndicator: {
      hasDrift: driftIndicator.hasDrift,
      driftDirection: driftIndicator.driftDirection,
      driftMagnitude: driftIndicator.driftMagnitude,
      controlStatus: driftIndicator.controlStatus,
    },
    feedbackAccuracy: {
      accuracy: feedbackAccuracy.accuracy,
      flagPrecision: feedbackAccuracy.flagPrecision,
      recall: feedbackAccuracy.recall,
      sampleSize: feedbackAccuracy.sampleSize,
    },
    adjusted: !dryRun,
    justifications,
    message: dryRun
      ? 'Dry run complete - no changes applied'
      : 'Thresholds adjusted successfully',
  };
}

/**
 * Get current thresholds
 * 
 * @returns {Object} Current threshold values
 */
export function getThresholds() {
  return {
    warnThreshold: thresholds.warnThreshold,
    flagThreshold: thresholds.flagThreshold,
  };
}

/**
 * Set thresholds (for admin use or initialization)
 * 
 * @param {number} warnThreshold - New warn threshold value
 * @param {number} flagThreshold - New flag threshold value
 * @returns {Object} Updated threshold values
 */
export function setThresholds(warnThreshold, flagThreshold) {
  if (warnThreshold >= flagThreshold) {
    throw new Error('warnThreshold must be less than flagThreshold');
  }
  if (warnThreshold <= 0 || warnThreshold >= 1 || flagThreshold <= 0 || flagThreshold >= 1) {
    throw new Error('Thresholds must be in the range (0, 1)');
  }
  
  thresholds.warnThreshold = warnThreshold;
  thresholds.flagThreshold = flagThreshold;
  
  console.log(`[Telemetry] Thresholds manually set to: warn=${warnThreshold}, flag=${flagThreshold}`);
  
  return getThresholds();
}

export default {
  getRecentSessions,
  calculateDriftIndicator,
  calculateFeedbackAccuracy,
  adjustThresholds,
  getThresholds,
  setThresholds,
  CONFIG,
};