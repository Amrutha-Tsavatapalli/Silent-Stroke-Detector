import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { updateBaseline, loadBaseline, saveBaseline } from './baseline.js';

// Property P10: Baseline Anomaly Guard
describe('baseline.js property tests (P10)', () => {
  it('P10: updateBaseline returns newBaseline === baseline when z-score > 2.5', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.001, max: 0.1 }), // baseline
        fc.float({ min: 0, max: 0.01 }), // stdDev
        (baseline, stdDev) => {
          // Generate todayScore that guarantees z-score > 2.5
          const todayScore = baseline + 3 * Math.max(stdDev, 0.001);
          const result = updateBaseline(baseline, stdDev, todayScore);
          expect(result.isAnomaly).toBe(true);
          expect(result.newBaseline).toBe(baseline);
        }
      )
    );
  });
});

// Unit tests for baseline.js
describe('baseline.js unit tests', () => {
  it('normal score within 1σ → baseline drifts by 5%', () => {
    const baseline = 0.01;
    const stdDev = 0.001;
    const todayScore = baseline + 0.5 * stdDev; // within 1σ
    const result = updateBaseline(baseline, stdDev, todayScore);
    expect(result.isAnomaly).toBe(false);
    // newBaseline = 0.95 * 0.01 + 0.05 * (0.0105) = 0.0095 + 0.000525 = 0.010025
    expect(result.newBaseline).toBeCloseTo(0.010025, 4);
  });

  it('anomalous score → baseline unchanged', () => {
    const baseline = 0.01;
    const stdDev = 0.001;
    const todayScore = baseline + 3 * stdDev; // z-score = 3 > 2.5
    const result = updateBaseline(baseline, stdDev, todayScore);
    expect(result.isAnomaly).toBe(true);
    expect(result.newBaseline).toBe(baseline);
  });

  it('loadBaseline returns null when no data', () => {
    localStorage.removeItem('fastcheck_baseline');
    localStorage.removeItem('fastcheck_stddev');
    expect(loadBaseline()).toBeNull();
  });

  it('saveBaseline and loadBaseline work correctly', () => {
    saveBaseline(0.01, 0.001);
    const loaded = loadBaseline();
    expect(loaded).not.toBeNull();
    expect(loaded.baseline).toBe(0.01);
    expect(loaded.stdDev).toBe(0.001);
  });
});