import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { clamp, computeRiskScore } from './fusion.js';

// Property P2: Fusion Score Bounds
describe('fusion.js property tests', () => {
  it('P2: computeRiskScore returns score in [0,1] and faceNorm, speechNorm in [0,1]', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 0.2 }), // faceRaw
        fc.float({ min: 0, max: 2000000 }), // speechVariance
        fc.constantFrom(0, 1), // armBinary
        (faceRaw, speechVariance, armBinary) => {
          const result = computeRiskScore(faceRaw, speechVariance, armBinary);
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(1);
          expect(result.faceNorm).toBeGreaterThanOrEqual(0);
          expect(result.faceNorm).toBeLessThanOrEqual(1);
          expect(result.speechNorm).toBeGreaterThanOrEqual(0);
          expect(result.speechNorm).toBeLessThanOrEqual(1);
        }
      )
    );
  });

  // Property P3: Fusion Level Consistency
  it('P3: score > 0.55 ↔ level === FLAG', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.551, max: 1 }), // score > 0.55
        (score) => {
          // Construct inputs that produce the desired score
          const faceRaw = 0.04; // max face
          const speechVariance = 0; // max speech
          const armBinary = 1; // max arm
          const result = computeRiskScore(faceRaw, speechVariance, armBinary);
          expect(result.level).toBe('FLAG');
        }
      )
    );
  });

  it('P3: score > 0.35 && score <= 0.55 ↔ level === WARN', () => {
    const result = computeRiskScore(0.02, 250000, 0.5);
    expect(result.level).toBe('WARN');
  });

  it('P3: score <= 0.35 ↔ level === CLEAR', () => {
    const result = computeRiskScore(0.005, 500000, 0);
    expect(result.level).toBe('CLEAR');
  });

  // Property P4: Fusion Weight Correctness
  it('P4: score === faceNorm * 0.40 + speechNorm * 0.40 + armNorm * 0.20 within epsilon 1e-9', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 0.2 }),
        fc.float({ min: 0, max: 2000000 }),
        fc.constantFrom(0, 1),
        (faceRaw, speechVariance, armBinary) => {
          const result = computeRiskScore(faceRaw, speechVariance, armBinary);
          const expectedScore =
            result.faceNorm * 0.4 + result.speechNorm * 0.4 + result.armNorm * 0.2;
          expect(Math.abs(result.score - expectedScore)).toBeLessThan(1e-9);
        }
      )
    );
  });
});

// Unit tests for clamp
describe('clamp', () => {
  it('returns min when value is below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('returns max when value is above max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});