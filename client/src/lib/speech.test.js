import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeSpectralCentroid, normaliseSpeechScore, computeMFCCs, computeMFCCVariance } from './speech.js';

// Property P11: Speech Normalisation Inversion
describe('speech.js property tests (P11)', () => {
  it('P11: normaliseSpeechScore(variance >= baseline, baseline) === 0.0', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 2000000 }), // baseline > 0
        (baseline) => {
          const variance = baseline * fc.sample(fc.float({ min: 1, max: 2 }), { numRuns: 1 })[0];
          expect(normaliseSpeechScore(variance, baseline)).toBe(0);
        }
      )
    );
  });

  it('P11: normaliseSpeechScore(0, baseline) === 1.0', () => {
    fc.assert(
      fc.property(fc.float({ min: 1, max: 2000000 }), (baseline) => {
        expect(normaliseSpeechScore(0, baseline)).toBe(1);
      })
    );
  });
});

// Unit tests for computeSpectralCentroid
describe('computeSpectralCentroid unit tests', () => {
  it('all-zero dB array returns centroid 0', () => {
    const fftData = new Float32Array(1024).fill(-100); // effectively zero
    const centroid = computeSpectralCentroid(fftData, 44100, 2048);
    expect(centroid).toBe(0);
  });

  it('known weighted input produces expected Hz value', () => {
    // Create FFT data with all energy in bin 100
    const fftData = new Float32Array(1024);
    fftData[100] = 0; // 0 dB = 1 linear
    // All other bins are -100 dB (effectively 0)
    const centroid = computeSpectralCentroid(fftData, 44100, 2048);
    // Expected: (100 * 44100 / 2048) ≈ 2153 Hz
    expect(centroid).toBeCloseTo(2153, 0);
  });
});
// Unit tests for computeMFCCs
describe('computeMFCCs unit tests', () => {
  it('returns array of 13 coefficients by default', () => {
    const audioBuffer = new Float32Array(512).fill(0);
    const mfccs = computeMFCCs(audioBuffer);
    expect(mfccs).toBeInstanceOf(Float32Array);
    expect(mfccs.length).toBe(13);
  });

  it('returns custom number of coefficients when specified', () => {
    const audioBuffer = new Float32Array(512).fill(0);
    const mfccs = computeMFCCs(audioBuffer, 5);
    expect(mfccs.length).toBe(5);
  });

  it('produces different output for different audio signals', () => {
    const audio1 = new Float32Array(512).fill(0.5);
    const audio2 = new Float32Array(512).fill(0.1);
    const mfccs1 = computeMFCCs(audio1);
    const mfccs2 = computeMFCCs(audio2);
    // The MFCCs should be different for different audio signals
    let allSame = true;
    for (let i = 0; i < mfccs1.length; i++) {
      if (mfccs1[i] !== mfccs2[i]) {
        allSame = false;
        break;
      }
    }
    expect(allSame).toBe(false);
  });
});

// Unit tests for computeMFCCVariance
describe('computeMFCCVariance unit tests', () => {
  it('returns 0 for empty array', () => {
    const variance = computeMFCCVariance([]);
    expect(variance).toBe(0);
  });

  it('returns 0 for null/undefined input', () => {
    expect(computeMFCCVariance(null)).toBe(0);
    expect(computeMFCCVariance(undefined)).toBe(0);
  });

  it('returns 0 for single frame (no variance with one sample)', () => {
    const mfccs = [new Float32Array(13).fill(1)];
    const variance = computeMFCCVariance(mfccs);
    expect(variance).toBe(0);
  });

  it('returns positive variance for different frames', () => {
    const mfccs = [
      new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
      new Float32Array([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
    ];
    const variance = computeMFCCVariance(mfccs);
    expect(variance).toBeGreaterThan(0);
  });

  it('returns higher variance for more different frames', () => {
    const similarFrames = [
      new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
      new Float32Array([1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1]),
    ];
    const differentFrames = [
      new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
      new Float32Array([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]),
    ];
    const similarVariance = computeMFCCVariance(similarFrames);
    const differentVariance = computeMFCCVariance(differentFrames);
    expect(differentVariance).toBeGreaterThan(similarVariance);
  });
});

// Property tests for MFCC functions
describe('MFCC property tests', () => {
  it('MFCC variance is non-negative for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: -100, max: 100, noNaN: true, noInfinity: true }), { minLength: 26, maxLength: 50 }),
        (values) => {
          // Create frames with the same values repeated
          const numFrames = Math.min(Math.floor(values.length / 13), 10);
          const mfccs = [];
          for (let i = 0; i < numFrames; i++) {
            mfccs.push(new Float32Array(values.slice(i * 13, (i + 1) * 13)));
          }
          const variance = computeMFCCVariance(mfccs);
          expect(variance).toBeGreaterThanOrEqual(0);
        }
      )
    );
  });
});