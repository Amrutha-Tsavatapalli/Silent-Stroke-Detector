/**
 * Web Audio API wrapper for MFCC-based speech analysis.
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

// Constants for MFCC computation
const SAMPLE_RATE = 16000; // Default sample rate for analysis
const FFT_SIZE = 512;
const NUM_MEL_FILTERS = 26;
const NUM_MFCC_COEFFICIENTS = 13;

/**
 * Converts frequency (Hz) to Mel scale.
 * @param {number} freq - Frequency in Hz
 * @returns {number} Mel frequency
 */
function hzToMel(freq) {
  return 2595 * Math.log10(1 + freq / 700);
}

/**
 * Converts Mel scale to frequency (Hz).
 * @param {number} mel - Mel frequency
 * @returns {number} Frequency in Hz
 */
function melToHz(mel) {
  return 700 * (10 ** (mel / 2595) - 1);
}

/**
 * Creates Mel filterbank.
 * @param {number} numFilters - Number of filters
 * @param {number} sampleRate - Sample rate
 * @param {number} fftSize - FFT size
 * @returns {Array<Float32Array>} Array of filter arrays
 */
function createMelFilterbank(numFilters, sampleRate, fftSize) {
  const filters = [];
  const lowFreq = 0;
  const highFreq = sampleRate / 2;

  // Convert frequencies to Mel scale
  const lowMel = hzToMel(lowFreq);
  const highMel = hzToMel(highFreq);

  // Create mel-spaced points
  const melPoints = [];
  for (let i = 0; i <= numFilters + 1; i++) {
    melPoints.push(lowMel + (i * (highMel - lowMel)) / (numFilters + 1));
  }

  // Convert back to Hz and map to FFT bins
  const hzPoints = melPoints.map(melToHz);
  const binPoints = hzPoints.map((hz) => Math.floor((hz * fftSize) / sampleRate));

  // Create triangular filters
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
      // else filter[j] stays 0
    }
    filters.push(filter);
  }

  return filters;
}

/**
 * Applies Discrete Cosine Transform Type II.
 * @param {Float32Array} input - Input array
 * @param {number} numCoeffs - Number of coefficients to compute
 * @returns {Float32Array} DCT coefficients
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
export function computeMFCCs(audioBuffer, numCoefficients = NUM_MFCC_COEFFICIENTS) {
  // Create FFT
  const fftSize = FFT_SIZE;
  const sampleRate = SAMPLE_RATE;

  // Create Mel filterbank
  const melFilters = createMelFilterbank(NUM_MEL_FILTERS, sampleRate, fftSize);

  // Apply Hann window
  const windowed = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    windowed[i] = audioBuffer[i] * hann;
  }

  // Compute FFT (simple DFT for now - in production use FFT library)
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
    // Apply log
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
export function computeMFCCVariance(mfccs) {
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

/**
 * Computes spectral centroid from FFT frequency data.
 * @param {Float32Array} fftData - dB values from AnalyserNode
 * @param {number} sampleRate - Audio context sample rate
 * @param {number} fftSize - Analyser FFT size
 * @returns {number} Centroid in Hz
 */
export function computeSpectralCentroid(fftData, sampleRate, fftSize) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < fftData.length; i++) {
    // Convert dB to linear amplitude
    const linear = 10 ** (fftData[i] / 20);
    // Bin centre frequency in Hz
    const freq = (i * sampleRate) / fftSize;

    weightedSum += freq * linear;
    totalWeight += linear;
  }

  if (totalWeight === 0) {
    return 0;
  }

  return weightedSum / totalWeight;
}

/**
 * Normalizes speech score based on variance and baseline.
 * @param {number} variance - Spectral centroid variance
 * @param {number} baseline - Baseline variance
 * @returns {number} Normalized score in [0, 1]
 */
export function normaliseSpeechScore(variance, baseline) {
  return Math.max(0, Math.min(1, 1 - variance / baseline));
}

/**
 * Records audio and computes MFCC variance for speech scoring.
 * @param {number} durationMs - Recording duration in ms (default: 8000)
 * @returns {Promise<number>} MFCC variance score
 */
export async function getSpeechScore(durationMs = 8000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();

  // Use smaller buffer for MFCC computation
  analyser.fftSize = 512;
  source.connect(analyser);

  const mfccFrames = [];
  const sampleRate = audioContext.sampleRate;
  const fftSize = analyser.fftSize;
  const bufferSize = analyser.fftSize;
  const intervalMs = 100;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const sample = () => {
      if (Date.now() - startTime >= durationMs) {
        // Recording complete - stop stream and close context
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close();

        // Compute variance from MFCC frames
        if (mfccFrames.length === 0) {
          resolve(0);
          return;
        }
        const variance = computeMFCCVariance(mfccFrames);
        resolve(variance);
        return;
      }

      // Get time-domain data
      const timeData = new Float32Array(bufferSize);
      analyser.getFloatTimeDomainData(timeData);

      // Compute MFCCs for this frame
      const mfccs = computeMFCCs(timeData, NUM_MFCC_COEFFICIENTS);
      mfccFrames.push(mfccs);

      setTimeout(sample, intervalMs);
    };

    sample();
  });
}