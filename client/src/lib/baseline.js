/**
 * Morning wellness baseline tracking using exponential moving average.
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

const STORAGE_KEYS = {
  BASELINE: 'fastcheck_baseline',
  STDDEV: 'fastcheck_stddev',
};

/**
 * Updates baseline using exponential moving average with anomaly guard.
 * @param {number} oldBaseline - Stored median from previous days
 * @param {number} oldStdDev - Stored standard deviation
 * @param {number} todayScore - Today's raw asymmetry score
 * @returns {{ newBaseline: number, newStdDev: number, isAnomaly: boolean }}
 */
export function updateBaseline(oldBaseline, oldStdDev, todayScore) {
  const zScore = (todayScore - oldBaseline) / Math.max(oldStdDev, 0.001);

  // If z-score > 2.5, flag as anomaly and don't drift baseline
  if (zScore > 2.5) {
    return { newBaseline: oldBaseline, newStdDev: oldStdDev, isAnomaly: true };
  }

  // Exponential moving average — 5% drift per day
  const newBaseline = 0.95 * oldBaseline + 0.05 * todayScore;
  const newStdDev = 0.95 * oldStdDev + 0.05 * Math.abs(todayScore - newBaseline);

  return { newBaseline, newStdDev, isAnomaly: false };
}

/**
 * Loads baseline from localStorage.
 * @returns {{ baseline: number, stdDev: number } | null}
 */
export function loadBaseline() {
  const baselineStr = localStorage.getItem(STORAGE_KEYS.BASELINE);
  const stdDevStr = localStorage.getItem(STORAGE_KEYS.STDDEV);

  if (baselineStr === null || stdDevStr === null) {
    return null;
  }

  return {
    baseline: parseFloat(baselineStr),
    stdDev: parseFloat(stdDevStr),
  };
}

/**
 * Saves baseline to localStorage.
 * @param {number} baseline
 * @param {number} stdDev
 */
export function saveBaseline(baseline, stdDev) {
  localStorage.setItem(STORAGE_KEYS.BASELINE, baseline.toString());
  localStorage.setItem(STORAGE_KEYS.STDDEV, stdDev.toString());
}