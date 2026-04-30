/**
 * Weighted risk score fusion from three normalized signals.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

/**
 * Clamps a value between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes weighted risk score from face, speech, and arm signals.
 * @param {number} faceRaw - Raw asymmetry score from getAsymmetryScore
 * @param {number} speechVariance - Spectral centroid variance from getSpeechScore
 * @param {0|1} armBinary - 0 = both raised, 1 = one droops
 * @param {number} speechBaseline - Baseline variance (default: 500000)
 * @returns {{ level: 'FLAG'|'WARN'|'CLEAR', score: number, faceNorm: number, speechNorm: number, armNorm: number }}
 */
export function computeRiskScore(faceRaw, speechVariance, armBinary, speechBaseline = 500000) {
  // Normalise face: 0.005 is baseline, 0.04 is severe
  const faceNorm = clamp((faceRaw - 0.005) / 0.035, 0, 1);

  // Normalise speech: lower variance = higher risk, so invert
  const speechNorm = clamp(1 - (speechVariance / speechBaseline), 0, 1);

  // Arm is already binary 0 or 1
  const armNorm = armBinary;

  // Weighted fusion: face 0.40 + speech 0.40 + arm 0.20
  const score = faceNorm * 0.4 + speechNorm * 0.4 + armNorm * 0.2;

  // Assign risk level based on thresholds
  let level;
  if (score > 0.55) {
    level = 'FLAG';
  } else if (score > 0.35) {
    level = 'WARN';
  } else {
    level = 'CLEAR';
  }

  return { level, score, faceNorm, speechNorm, armNorm };
}