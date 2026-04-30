import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  LANDMARK_PAIRS,
  getAsymmetryScore,
  normaliseAsymmetryScore,
  aggregateFrameScores,
} from './asymmetry.js';

// Property P1: Asymmetry Score Bounds
describe('asymmetry.js property tests (P1)', () => {
  it('P1: getAsymmetryScore returns >= 0 and normalised score in [0, 1] for all valid 468-landmark arrays', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.float({ min: 0, max: 1 }),
            y: fc.float({ min: 0, max: 1 }),
            z: fc.float({ min: -1, max: 1 }),
          }),
          { minLength: 468, maxLength: 468 }
        ),
        (landmarks) => {
          const rawScore = getAsymmetryScore(landmarks);
          expect(rawScore).toBeGreaterThanOrEqual(0);
          const normalised = normaliseAsymmetryScore(rawScore);
          expect(normalised).toBeGreaterThanOrEqual(0);
          expect(normalised).toBeLessThanOrEqual(1);
        }
      )
    );
  });
});

// Unit tests for asymmetry.js
describe('asymmetry.js unit tests', () => {
  // Create symmetric landmarks (perfect mirror)
  const createSymmetricLandmarks = () => {
    const landmarks = [];
    for (let i = 0; i < 468; i++) {
      landmarks.push({ x: 0.5, y: 0.5, z: 0 });
    }
    return landmarks;
  };

  it('symmetric landmarks produce score near 0', () => {
    const landmarks = createSymmetricLandmarks();
    const score = getAsymmetryScore(landmarks);
    expect(score).toBeLessThan(0.001);
  });

  it('normaliseAsymmetryScore(0.005) returns 0.0', () => {
    expect(normaliseAsymmetryScore(0.005)).toBe(0);
  });

  it('normaliseAsymmetryScore(0.040) returns 1.0', () => {
    expect(normaliseAsymmetryScore(0.040)).toBe(1);
  });

  it('normaliseAsymmetryScore(0.0225) returns 0.5', () => {
    expect(normaliseAsymmetryScore(0.0225)).toBe(0.5);
  });
});

// Property P9: Temporal Aggregation Null Safety
describe('aggregateFrameScores property tests (P9)', () => {
  it('P9: aggregateFrameScores returns null when all frames have faceDetected: false', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            rawScore: fc.float({ min: 0, max: 0.1 }),
            faceDetected: fc.constant(false),
          }),
          { minLength: 1, maxLength: 500 }
        ),
        (frameScores) => {
          expect(aggregateFrameScores(frameScores, 200)).toBeNull();
        }
      )
    );
  });

  it('exactly 200 valid frames returns median', () => {
    const frames = [];
    for (let i = 0; i < 200; i++) {
      frames.push({ rawScore: 0.01 + i * 0.0001, faceDetected: true });
    }
    const result = aggregateFrameScores(frames, 200);
    expect(result).not.toBeNull();
    // Median of 200 values: average of positions 99 and 100 (0-indexed)
    expect(result).toBeCloseTo(0.0199, 3);
  });

  it('199 valid frames returns null', () => {
    const frames = [];
    for (let i = 0; i < 199; i++) {
      frames.push({ rawScore: 0.01, faceDetected: true });
    }
    expect(aggregateFrameScores(frames, 200)).toBeNull();
  });
});