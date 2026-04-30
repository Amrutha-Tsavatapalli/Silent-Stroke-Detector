/**
 * Facial asymmetry scoring from MediaPipe Face Mesh landmarks.
 * Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */

/**
 * 7 anatomical landmark pairs for asymmetry detection.
 * Each pair is [leftIndex, rightIndex] mirrored across the face.
 */
export const LANDMARK_PAIRS = [
  [33, 263],  // outer eye corners
  [159, 386], // upper eyelid peak
  [145, 374], // lower eyelid valley
  [61, 291],  // mouth corners
  [70, 300],  // eyebrow outer end
  [105, 334], // eyebrow inner end
  [117, 346], // cheek reference
];

/**
 * Computes raw asymmetry score from 468 MediaPipe landmarks.
 * @param {Array<{x: number, y: number, z: number}>} landmarks - Array of 468 normalized landmarks
 * @returns {number} Raw asymmetry score (>= 0)
 */
export function getAsymmetryScore(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return 0;
  }

  const nose = landmarks[1]; // nose tip as center reference
  const scores = [];

  for (const [leftIdx, rightIdx] of LANDMARK_PAIRS) {
    const left = landmarks[leftIdx];
    const right = landmarks[rightIdx];

    // Mirror left point across nose x-axis
    const mirroredLx = 2 * nose.x - left.x;

    // Euclidean distance between mirrored left and actual right
    const dx = mirroredLx - right.x;
    const dy = left.y - right.y;
    const pairScore = Math.sqrt(dx * dx + dy * dy);

    scores.push(pairScore);
  }

  // Return mean Euclidean distance across all pairs
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Normalizes raw asymmetry score to [0, 1] range.
 * @param {number} rawScore - Output of getAsymmetryScore
 * @returns {number} Normalized score in [0, 1]
 */
export function normaliseAsymmetryScore(rawScore) {
  return Math.max(0, Math.min(1, (rawScore - 0.005) / 0.035));
}

/**
 * Aggregates frame scores to produce a final face score.
 * @param {Array<{rawScore: number, faceDetected: boolean}>} frameScores
 * @param {number} minValidFrames - Minimum valid frames required (default: 200)
 * @returns {number|null} Median of valid rawScores, or null if insufficient data
 */
export function aggregateFrameScores(frameScores, minValidFrames = 200) {
  const validScores = frameScores
    .filter((f) => f.faceDetected === true)
    .map((f) => f.rawScore);

  if (validScores.length < minValidFrames) {
    return null;
  }

  // Use median to reject outlier frames from head movement
  const sorted = [...validScores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * MediaPipe Face Mesh landmark indices used for pose estimation.
 * @readonly
 * @enum {number}
 */
export const POSE_LANDMARKS = {
  NOSE_TIP: 1,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
  FOREHEAD: 10,
  CHIN: 152,
};

/**
 * Computes head pose (pitch, yaw, roll) from MediaPipe face mesh landmarks.
 * Requirements: 1.2, 1.3
 *
 * @param {Array<{x: number, y: number, z: number}>} landmarks - Array of 468 normalized landmarks
 * @returns {{pitch: number, yaw: number, roll: number}} Head pose angles in degrees
 *   - pitch: vertical head tilt (nodding up/down), positive = looking up
 *   - yaw: horizontal rotation (turning left/right), positive = looking left
 *   - roll: head tilt (tilting ear to shoulder), positive = tilting right
 */
export function computeHeadPose(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { pitch: 0, yaw: 0, roll: 0 };
  }

  const noseTip = landmarks[POSE_LANDMARKS.NOSE_TIP];
  const leftCheek = landmarks[POSE_LANDMARKS.LEFT_CHEEK];
  const rightCheek = landmarks[POSE_LANDMARKS.RIGHT_CHEEK];
  const forehead = landmarks[POSE_LANDMARKS.FOREHEAD];
  const chin = landmarks[POSE_LANDMARKS.CHIN];

  // Calculate cheek midpoint (center of face)
  const cheekMidpoint = {
    x: (leftCheek.x + rightCheek.x) / 2,
    y: (leftCheek.y + rightCheek.y) / 2,
  };

  // Pitch (up/down nodding): angle between nose-chin vector and face plane normal
  // Positive = looking up, Negative = looking down
  const faceHeight = chin.y - forehead.y;
  const noseVerticalOffset = noseTip.y - cheekMidpoint.y;
  const pitch = (noseVerticalOffset / faceHeight) * 180 / Math.PI;

  // Yaw (left/right turning): horizontal offset of nose from cheek midpoint
  // Positive = looking left, Negative = looking right
  const noseHorizontalOffset = noseTip.x - cheekMidpoint.x;
  const faceWidth = rightCheek.x - leftCheek.x;
  const yaw = (noseHorizontalOffset / faceWidth) * 180 / Math.PI;

  // Roll (head tilt): angle between line connecting cheeks and horizontal axis
  const roll = Math.atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x)
    * 180 / Math.PI;

  return {
    pitch: pitch,
    yaw: yaw,
    roll: roll,
  };
}

/**
 * Reference frontal face shape for Procrustes alignment.
 * This represents the average frontal face landmark positions from MediaPipe Face Mesh.
 * These values are normalized [0,1] coordinates.
 */
const REFERENCE_FRONTL_FACE = [
  { x: 0.346, y: 0.220 },   // 0 - forehead top
  { x: 0.500, y: 0.295 },   // 1 - nose tip
  { x: 0.404, y: 0.360 },   // 2 - under nose
  { x: 0.500, y: 0.395 },   // 3 - upper lip
  { x: 0.500, y: 0.450 },   // 4 - lower lip
  { x: 0.380, y: 0.520 },   // 5 - chin left
  { x: 0.620, y: 0.520 },   // 6 - chin right
  { x: 0.280, y: 0.230 },   // 7 - left eyebrow outer
  { x: 0.350, y: 0.200 },   // 8 - left eyebrow inner
  { x: 0.650, y: 0.200 },   // 9 - right eyebrow inner
  { x: 0.720, y: 0.230 },   // 10 - right eyebrow outer
  { x: 0.290, y: 0.310 },   // 11 - left eye outer
  { x: 0.380, y: 0.290 },   // 12 - left eye inner
  { x: 0.620, y: 0.290 },   // 13 - right eye inner
  { x: 0.710, y: 0.310 },   // 14 - right eye outer
  { x: 0.350, y: 0.380 },   // 15 - left cheek
  { x: 0.650, y: 0.380 },   // 16 - right cheek
  { x: 0.350, y: 0.480 },   // 17 - left mouth corner
  { x: 0.650, y: 0.480 },   // 18 - right mouth corner
];

/**
 * Creates a 3D rotation matrix for rotation around the X axis (pitch).
 * @param {number} angle - Angle in degrees
 * @returns {number[][]} 3x3 rotation matrix
 */
function createRotationMatrixX(angle) {
  const rad = angle * Math.PI / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

/**
 * Creates a 3D rotation matrix for rotation around the Y axis (yaw).
 * @param {number} angle - Angle in degrees
 * @returns {number[][]} 3x3 rotation matrix
 */
function createRotationMatrixY(angle) {
  const rad = angle * Math.PI / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

/**
 * Creates a 3D rotation matrix for rotation around the Z axis (roll).
 * @param {number} angle - Angle in degrees
 * @returns {number[][]} 3x3 rotation matrix
 */
function createRotationMatrixZ(angle) {
  const rad = angle * Math.PI / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

/**
 * Multiplies a 3x3 rotation matrix with a 3D point.
 * @param {number[][]} matrix - 3x3 rotation matrix
 * @param {{x: number, y: number, z: number}} point - 3D point
 * @returns {{x: number, y: number, z: number}} Transformed point
 */
function applyMatrix(matrix, point) {
  return {
    x: matrix[0][0] * point.x + matrix[0][1] * point.y + matrix[0][2] * point.z,
    y: matrix[1][0] * point.x + matrix[1][1] * point.y + matrix[1][2] * point.z,
    z: matrix[2][0] * point.x + matrix[2][1] * point.y + matrix[2][2] * point.z,
  };
}

/**
 * Multiplies two 3x3 matrices.
 * @param {number[][]} a - First 3x3 matrix
 * @param {number[][]} b - Second 3x3 matrix
 * @returns {number[][]} Resulting 3x3 matrix
 */
function multiplyMatrices(a, b) {
  const result = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

/**
 * Computes the centroid (mean position) of a set of landmarks.
 * @param {Array<{x: number, y: number, z: number}>} landmarks - Array of landmarks
 * @returns {{x: number, y: number, z: number}} Centroid
 */
function computeCentroid(landmarks) {
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const lm of landmarks) {
    sumX += lm.x;
    sumY += lm.y;
    sumZ += lm.z;
  }
  const n = landmarks.length;
  return { x: sumX / n, y: sumY / n, z: sumZ / n };
}

/**
 * Centers landmarks by subtracting the centroid.
 * @param {Array<{x: number, y: number, z: number}>} landmarks - Array of landmarks
 * @param {{x: number, y: number, z: number}} centroid - Centroid to subtract
 * @returns {Array<{x: number, y: number, z: number}>} Centered landmarks
 */
function centerLandmarks(landmarks, centroid) {
  return landmarks.map(lm => ({
    x: lm.x - centroid.x,
    y: lm.y - centroid.y,
    z: lm.z - centroid.z,
  }));
}

/**
 * Computes the scaling factor for Procrustes alignment.
 * @param {Array<{x: number, y: number, z: number}>} landmarks - Centered landmarks
 * @param {Array<{x: number, y: number, z: number}>} reference - Centered reference
 * @returns {number} Scaling factor
 */
function computeScale(landmarks, reference) {
  let sumSquares = 0;
  for (let i = 0; i < landmarks.length; i++) {
    const dx = landmarks[i].x - reference[i].x;
    const dy = landmarks[i].y - reference[i].y;
    const dz = landmarks[i].z - reference[i].z;
    sumSquares += dx * dx + dy * dy + dz * dz;
  }
  return Math.sqrt(sumSquares / landmarks.length) || 1;
}

/**
 * Applies Procrustes Analysis to align landmarks to a reference shape.
 * Uses the reference frontal face as the target shape.
 * @param {Array<{x: number, y: number, z: number}>} landmarks - Input landmarks
 * @returns {Array<{x: number, y: number, z: number}>} Aligned landmarks
 */
function procrustesAlign(landmarks) {
  // Use subset of key landmarks for alignment (more stable)
  const keyIndices = [1, 33, 263, 61, 291, 70, 300, 105, 334, 159, 386, 145, 374, 117, 346, 152, 10, 234, 454];
  const keyRef = keyIndices.map(i => REFERENCE_FRONTL_FACE[i] || { x: 0.5, y: 0.5 });
  
  // Extract corresponding landmarks
  const keyLandmarks = keyIndices.map(i => landmarks[i] || { x: 0.5, y: 0.5, z: 0 });
  
  // Compute centroids
  const srcCentroid = computeCentroid(keyLandmarks);
  const refCentroid = computeCentroid(keyRef);
  
  // Center both
  const centeredSrc = centerLandmarks(keyLandmarks, srcCentroid);
  const centeredRef = centerLandmarks(keyRef, refCentroid);
  
  // Compute scale
  let srcScale = 0, refScale = 0;
  for (let i = 0; i < centeredSrc.length; i++) {
    srcScale += centeredSrc[i].x ** 2 + centeredSrc[i].y ** 2 + centeredSrc[i].z ** 2;
    refScale += centeredRef[i].x ** 2 + centeredRef[i].y ** 2 + centeredRef[i].z ** 2;
  }
  srcScale = Math.sqrt(srcScale / centeredSrc.length) || 1;
  refScale = Math.sqrt(refScale / centeredRef.length) || 1;
  const scaleFactor = refScale / srcScale;
  
  // Scale and translate back to reference space
  return landmarks.map(lm => ({
    x: (lm.x - srcCentroid.x) * scaleFactor + refCentroid.x,
    y: (lm.y - srcCentroid.y) * scaleFactor + refCentroid.y,
    z: (lm.z - srcCentroid.z) * scaleFactor + refCentroid.z,
  }));
}

/**
 * Computes asymmetry score with head pose normalization.
 * Requirements: 1.6, 1.7, 1.8
 * 
 * This function chains:
 * 1. Head pose estimation (computeHeadPose)
 * 2. Landmark normalization (normalizeLandmarks)
 * 3. Asymmetry scoring (getAsymmetryScore)
 * 
 * @param {Array<{x: number, y: number, z: number}>} landmarks - Array of 468 normalized landmarks
 * @returns {{rawScore: number, normalizedScore: number, pose: {pitch: number, yaw: number, roll: number}}}
 *   - rawScore: Raw asymmetry score from normalized landmarks
 *   - normalizedScore: Score normalized to [0, 1] range
 *   - pose: The head pose angles detected
 */
export function getAsymmetryScoreWithNormalization(landmarks) {
  // Step 1: Compute head pose
  const pose = computeHeadPose(landmarks);
  
  // Step 2: Normalize landmarks using the computed pose
  const normalizedLandmarks = normalizeLandmarks(
    landmarks,
    pose.pitch,
    pose.yaw,
    pose.roll
  );
  
  // Step 3: Compute asymmetry score on normalized landmarks
  const rawScore = getAsymmetryScore(normalizedLandmarks);
  
  // Step 4: Normalize the score to [0, 1] range
  const normalizedScore = normaliseAsymmetryScore(rawScore);
  
  return {
    rawScore,
    normalizedScore,
    pose,
  };
}

/**
 * Normalizes facial landmarks by:
 * 1. Applying inverse head pose rotation (Affine Transformation)
 * 2. Using Procrustes Analysis to align to neutral frontal pose
 * 
 * This prevents false positives when the patient's head is tilted.
 * Requirements: 1.4, 1.5
 *
 * @param {Array<{x: number, y: number, z: number}>} landmarks - Array of 468 normalized landmarks
 * @param {number} pitch - Head pitch angle in degrees (positive = looking up)
 * @param {number} yaw - Head yaw angle in degrees (positive = looking left)
 * @param {number} roll - Head roll angle in degrees (positive = tilting right)
 * @returns {Array<{x: number, y: number, z: number}>} Normalized landmarks array
 */
export function normalizeLandmarks(landmarks, pitch, yaw, roll) {
  if (!landmarks || landmarks.length < 468) {
    return landmarks;
  }

  // Create combined rotation matrix (inverse of the pose angles)
  // Order: Z (roll) -> Y (yaw) -> X (pitch)
  const rotX = createRotationMatrixX(-pitch);
  const rotY = createRotationMatrixY(-yaw);
  const rotZ = createRotationMatrixZ(-roll);
  
  // Combine rotations: R = Rx * Ry * Rz
  const rotYZ = multiplyMatrices(rotY, rotZ);
  const combinedRot = multiplyMatrices(rotX, rotYZ);

  // Apply rotation to each landmark
  const rotatedLandmarks = landmarks.map(lm => applyMatrix(combinedRot, lm));

  // Apply Procrustes Analysis to align to frontal reference
  const alignedLandmarks = procrustesAlign(rotatedLandmarks);

  return alignedLandmarks;
}