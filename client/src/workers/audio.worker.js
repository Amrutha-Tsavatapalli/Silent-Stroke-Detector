/**
 * Web Worker for Web Audio processing.
 * Handles MFCC computation and variance calculation for speech analysis.
 * 
 * Message format:
 *   Input:  { type: 'process', audioData: Float32Array }
 *   Output: { type: 'result', variance }
 *   Error:  { type: 'error', message: string }
 */

// ============================================================================
// MFCC FUNCTIONS (inlined from speech.js)
// ============================================================================

// Constants for MFCC computation
const SAMPLE_RATE = 16000;
const FFT_SIZE = 512;
const NUM_MEL_FILTERS = 26;
const NUM_MFCC_COEFFICIENTS = 13;

/**
 * Converts frequency (Hz) to Mel scale.
 */
function hzToMel(freq) {
  return 2595 * Math.log10(1 + freq / 700);
}

/**
 * Converts Mel scale to frequency (Hz).
 */
function melToHz(mel) {
  return 700 * (10 ** (mel / 2595) - 1);
}

/**
 * Creates Mel filterbank.
 */
function createMelFilterbank(numFilters, sampleRate, fftSize) {
  const filters = [];
  const lowFreq = 0;
  const highFreq = sampleRate / 2;

  const lowMel = hzToMel(lowFreq);
  const highMel = hzToMel(highFreq);

  const melPoints = [];
  for (let i = 0; i <= numFilters + 1; i++) {
    melPoints.push(lowMel + (i * (highMel - lowMel)) / (numFilters + 1));
  }

  const hzPoints = melPoints.map(melToHz);
  const binPoints = hzPoints.map((hz) => Math.floor((hz * fftSize) / sampleRate));

  for (let i = 0; i < numFilters; i++) {
    const filter = new Float32Array(fftSize / 2);
    const left = binPoints[i];
    const center = binPoints[i + 1];
    const right = binPoints[i + 2];

    for (let j = 0; j < fftSize / 2; j++) {
      if (j >= left && j <= center) {
        filter[j] = (j - left) / (center - left);
      } else if (j >= center && j <= right) {
        filter[j] = (right - j) / (right - center);
      }
    }
    filters.push(filter);
  }

  return filters;
}

/**
 * Applies Discrete Cosine Transform Type II.
 */
function dct(input, numCoeffs) {
  const N = input.length;
  const output = new Float32Array(numCoeffs);

  for (let k = 0; k < numCoeffs; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += input[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
    }
    output[k] = sum;
  }

  return output;
}

/**
 * Computes MFCCs from audio samples.
 * @param {Float32Array} audioBuffer - Audio samples
 * @param {number} numCoefficients - Number of MFCC coefficients (default: 13)
 * @returns {Float32Array} Array of 13 MFCC coefficients
 */
function computeMFCCs(audioBuffer, numCoefficients = NUM_MFCC_COEFFICIENTS) {
  const fftSize = FFT_SIZE;
  const sampleRate = SAMPLE_RATE;

  const melFilters = createMelFilterbank(NUM_MEL_FILTERS, sampleRate, fftSize);

  // Apply Hann window
  const windowed = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    windowed[i] = audioBuffer[i] * hann;
  }

  // Compute FFT (simple DFT)
  const fftReal = new Float32Array(fftSize / 2);
  const fftImag = new Float32Array(fftSize / 2);

  for (let k = 0; k < fftSize / 2; k++) {
    let real = 0;
    let imag = 0;
    for (let n = 0; n < fftSize; n++) {
      const angle = (2 * Math.PI * k * n) / fftSize;
      real += windowed[n] * Math.cos(angle);
      imag -= windowed[n] * Math.sin(angle);
    }
    fftReal[k] = real;
    fftImag[k] = imag;
  }

  // Compute magnitude spectrum
  const magnitude = new Float32Array(fftSize / 2);
  for (let i = 0; i < fftSize / 2; i++) {
    magnitude[i] = Math.sqrt(fftReal[i] ** 2 + fftImag[i] ** 2);
  }

  // Apply Mel filterbank
  const melEnergies = new Float32Array(NUM_MEL_FILTERS);
  for (let i = 0; i < NUM_MEL_FILTERS; i++) {
    let sum = 0;
    for (let j = 0; j < fftSize / 2; j++) {
      sum += magnitude[j] * melFilters[i][j];
    }
    melEnergies[i] = Math.log(Math.max(sum, 1e-10));
  }

  // Apply DCT
  const mfccs = dct(melEnergies, numCoefficients);

  return mfccs;
}

/**
 * Computes variance across time frames for MFCC coefficients.
 * @param {Array<Float32Array>} mfccs - Array of MFCC coefficient arrays (one per time frame)
 * @returns {number} Sum of variances across all coefficients
 */
function computeMFCCVariance(mfccs) {
  if (!mfccs || mfccs.length === 0) {
    return 0;
  }

  const numCoefficients = mfccs[0].length;
  const numFrames = mfccs.length;

  // Compute mean for each coefficient
  const means = new Float32Array(numCoefficients);
  for (let i = 0; i < numCoefficients; i++) {
    let sum = 0;
    for (let j = 0; j < numFrames; j++) {
      sum += mfccs[j][i];
    }
    means[i] = sum / numFrames;
  }

  // Compute variance for each coefficient
  let totalVariance = 0;
  for (let i = 0; i < numCoefficients; i++) {
    let sumSquaredDiff = 0;
    for (let j = 0; j < numFrames; j++) {
      const diff = mfccs[j][i] - means[i];
      sumSquaredDiff += diff * diff;
    }
    totalVariance += sumSquaredDiff / numFrames;
  }

  return totalVariance;
}

// ============================================================================
// WORKER STATE
// ============================================================================

// Store MFCC frames for batch processing
let mfccFrames = [];

// ============================================================================
// WORKER MESSAGE HANDLING
// ============================================================================

/**
 * Handle messages from the main thread.
 */
self.onmessage = function(event) {
  const { type, audioData } = event.data;

  try {
    switch (type) {
      case 'process':
        if (!audioData || !(audioData instanceof Float32Array)) {
          self.postMessage({
            type: 'error',
            message: 'Invalid audio data: expected Float32Array'
          });
          return;
        }

        // Compute MFCCs for this audio frame
        const mfccs = computeMFCCs(audioData, NUM_MFCC_COEFFICIENTS);
        mfccFrames.push(mfccs);

        // Return current frame count so main thread knows progress
        self.postMessage({
          type: 'progress',
          frameCount: mfccFrames.length
        });
        break;

      case 'getVariance':
        // Compute and return variance from all accumulated frames
        if (mfccFrames.length === 0) {
          self.postMessage({
            type: 'result',
            variance: 0
          });
          return;
        }

        const variance = computeMFCCVariance(mfccFrames);
        
        self.postMessage({
          type: 'result',
          variance: variance
        });

        // Reset frames after getting variance
        mfccFrames = [];
        break;

      case 'reset':
        // Reset accumulated frames
        mfccFrames = [];
        self.postMessage({
          type: 'ready'
        });
        break;

      case 'init':
        // Worker initialized successfully
        mfccFrames = [];
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
      message: error.message || 'Unknown error processing audio'
    });
  }
};

// Signal that the worker is ready
self.postMessage({ type: 'ready' });