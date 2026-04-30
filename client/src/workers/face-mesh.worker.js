/**
 * Web Worker for MediaPipe Face Mesh processing.
 * Handles facial asymmetry scoring with head pose normalization.
 * 
 * Message format:
 *   Input:  { type: 'process', landmarks: [...] }
 *   Output: { type: 'result', rawScore, normalizedScore, pose }
 *   Error:  { type: 'error', message: string }
 */

// ============================================================================
// ASYMMETRY FUNCTIONS (inlined from asymmetry.js)
// ============================================================================

/**
 * 7 anatomical landmark pairs for asymmetry detection.
 * Each pair is [leftIndex, rightIndex] mirrored across the face.
 */
const LANDMARK_PAIRS = [
  [33, 263],  // outer eye corners
  [159, 386], // upper eyelid peak
  [145, 374], // lower eyelid valley
  [61, 291],  // mouth corners
  [70, 300],  // eyebrow outer end
  [105, 334], // eyebrow inner end
  [117, 346], // cheek reference
];

/**
 * MediaPipe Face Mesh landmark indices used for pose estimation.
 */
const POSE_LANDMARKS = {
  NOSE_TIP: 1,
  LEFT_CHEEK: 234,
  RIGHT_CHEEK: 454,
  FOREHEAD: 10,
  CHIN: 152,
};

/**
 * Reference frontal face shape for Procrustes alignment.
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
 * Computes raw asymmetry score from 468 MediaPipe landmarks.
 * @param {Array<{x: number, y: number, z: number}>} landmarks - Array of 468 normalized landmarks
 * @returns {number} Raw asymmetry score (>= 0)
 */
function getAsymmetryScore(landmarks) {
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
function normaliseAsymmetryScore(rawScore) {
  return Math.max(0, Math.min(1, (rawScore - 0.005) / 0.035));
}

/**
 * Computes head pose (pitch, yaw, roll) from MediaPipe face mesh landmarks.
 * @param {Array<{x: number, y: number, z: number}>} landmarks - Array of 468 normalized landmarks
 * @returns {{pitch: number, yaw: number, roll: number}} Head pose angles in degrees
 */
function computeHeadPose(landmarks) {
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

  // Pitch (up/down nodding)
  const faceHeight = chin.y - forehead.y;
  const noseVerticalOffset = noseTip.y - cheekMidpoint.y;
  const pitch = (noseVerticalOffset / faceHeight) * 180 / Math.PI;

  // Yaw (left/right turning)
  const noseHorizontalOffset = noseTip.x - cheekMidpoint.x;
  const faceWidth = rightCheek.x - leftCheek.x;
  const yaw = (noseHorizontalOffset / faceWidth) * 180 / Math.PI;

  // Roll (head tilt)
  const roll = Math.atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x)
    * 180 / Math.PI;

  return { pitch, yaw, roll };
}

/**
 * Creates a 3D rotation matrix for rotation around the X axis (pitch).
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
 */
function centerLandmarks(landmarks, centroid) {
  return landmarks.map(lm => ({
    x: lm.x - centroid.x,
    y: lm.y - centroid.y,
    z: lm.z - centroid.z,
  }));
}

/**
 * Applies Procrustes Analysis to align landmarks to a reference shape.
 */
function procrustesAlign(landmarks) {
  const keyIndices = [1, 33, 263, 61, 291, 70, 300, 105, 334, 159, 386, 145, 374, 117, 346, 152, 10, 234, 454];
  const keyRef = keyIndices.map(i => REFERENCE_FRONTL_FACE[i] || { x: 0.5, y: 0.5 });
  
  const keyLandmarks = keyIndices.map(i => landmarks[i] || { x: 0.5, y: 0.5, z: 0 });
  
  const srcCentroid = computeCentroid(keyLandmarks);
  const refCentroid = computeCentroid(keyRef);
  
  const centeredSrc = centerLandmarks(keyLandmarks, srcCentroid);
  const centeredRef = centerLandmarks(keyRef, refCentroid);
  
  let srcScale = 0, refScale = 0;
  for (let i = 0; i < centeredSrc.length; i++) {
    srcScale += centeredSrc[i].x ** 2 + centeredSrc[i].y ** 2 + centeredSrc[i].z ** 2;
    refScale += centeredRef[i].x ** 2 + centeredRef[i].y ** 2 + centeredRef[i].z ** 2;
  }
  srcScale = Math.sqrt(srcScale / centeredSrc.length) || 1;
  refScale = Math.sqrt(refScale / centeredRef.length) || 1;
  const scaleFactor = refScale / srcScale;
  
  return landmarks.map(lm => ({
    x: (lm.x - srcCentroid.x) * scaleFactor + refCentroid.x,
    y: (lm.y - srcCentroid.y) * scaleFactor + refCentroid.y,
    z: (lm.z - srcCentroid.z) * scaleFactor + refCentroid.z,
  }));
}

/**
 * Normalizes facial landmarks by applying inverse head pose rotation
 * and Procrustes Analysis alignment.
 */
function normalizeLandmarks(landmarks, pitch, yaw, roll) {
  if (!landmarks || landmarks.length < 468) {
    return landmarks;
  }

  const rotX = createRotationMatrixX(-pitch);
  const rotY = createRotationMatrixY(-yaw);
  const rotZ = createRotationMatrixZ(-roll);
  
  const rotYZ = multiplyMatrices(rotY, rotZ);
  const combinedRot = multiplyMatrices(rotX, rotYZ);

  const rotatedLandmarks = landmarks.map(lm => applyMatrix(combinedRot, lm));
  const alignedLandmarks = procrustesAlign(rotatedLandmarks);

  return alignedLandmarks;
}

/**
 * Computes asymmetry score with head pose normalization.
 * @param {Array<{x: number, y: number, z: number}>} landmarks - Array of 468 normalized landmarks
 * @returns {{rawScore: number, normalizedScore: number, pose: {pitch: number, yaw: number, roll: number}}}
 */
function getAsymmetryScoreWithNormalization(landmarks) {
  const pose = computeHeadPose(landmarks);
  
  const normalizedLandmarks = normalizeLandmarks(
    landmarks,
    pose.pitch,
    pose.yaw,
    pose.roll
  );
  
  const rawScore = getAsymmetryScore(normalizedLandmarks);
  const normalizedScore = normaliseAsymmetryScore(rawScore);
  
  return {
    rawScore,
    normalizedScore,
    pose,
  };
}

// ============================================================================
// WORKER MESSAGE HANDLING
// ============================================================================

/**
 * Handle messages from the main thread.
 */
self.onmessage = function(event) {
  const { type, landmarks } = event.data;

  try {
    switch (type) {
      case 'process':
        if (!landmarks || !Array.isArray(landmarks)) {
          self.postMessage({
            type: 'error',
            message: 'Invalid landmarks data: expected array of landmarks'
          });
          return;
        }

        const result = getAsymmetryScoreWithNormalization(landmarks);
        
        self.postMessage({
          type: 'result',
          rawScore: result.rawScore,
          normalizedScore: result.normalizedScore,
          pose: result.pose
        });
        break;

      case 'init':
        // Worker initialized successfully
        self.postMessage({
          type: 'ready'
        });
        break;

      default:
        self.postMessage({
          type: 'error',
          message: `Unknown message type: ${type}`
        });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error.message || 'Unknown error processing landmarks'
    });
  }
};

// Signal that the worker is ready
self.postMessage({ type: 'ready' });