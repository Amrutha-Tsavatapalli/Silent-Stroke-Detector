import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { haversine, sortHospitals } from './routing.js';

// Property P5: Haversine Identity
describe('routing.js property tests', () => {
  it('P5: haversine(lat, lng, lat, lng) === 0 for all valid coordinates', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -90, max: 90 }),
        fc.float({ min: -180, max: 180 }),
        (lat, lng) => {
          expect(haversine(lat, lng, lat, lng)).toBe(0);
        }
      )
    );
  });

  // Property P6: Haversine Symmetry
  it('P6: haversine(lat1, lng1, lat2, lng2) === haversine(lat2, lng2, lat1, lng1) within 0.001', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -90, max: 90 }),
        fc.float({ min: -180, max: 180 }),
        fc.float({ min: -90, max: 90 }),
        fc.float({ min: -180, max: 180 }),
        (lat1, lng1, lat2, lng2) => {
          const d1 = haversine(lat1, lng1, lat2, lng2);
          const d2 = haversine(lat2, lng2, lat1, lng1);
          expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
        }
      )
    );
  });

  // Property P7: Hospital Routing Monotonicity
  it('P7: sortHospitals output is sorted ascending by sortScore', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -90, max: 90 }),
        fc.float({ min: -180, max: 180 }),
        fc.array(
          fc.record({
            id: fc.string(),
            name: fc.string(),
            state: fc.string(),
            district: fc.string(),
            lat: fc.float({ min: -90, max: 90 }),
            lng: fc.float({ min: -180, max: 180 }),
            emergencyPhone: fc.string(),
            hasThrombolysis: fc.boolean(),
            hasCt: fc.boolean(),
            tier: fc.integer({ min: 1, max: 3 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (userLat, userLng, hospitals) => {
          const sorted = sortHospitals(userLat, userLng, hospitals);
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].sortScore).toBeLessThanOrEqual(sorted[i + 1].sortScore);
          }
        }
      )
    );
  });

  // Property P8: Thrombolysis Preference
  it('P8: thrombolysis-capable hospital ranks above equidistant non-capable hospital', () => {
    const hospitals = [
      {
        id: '1',
        name: 'Hospital A',
        state: 'TN',
        district: 'Chennai',
        lat: 13.0827,
        lng: 80.2707,
        emergencyPhone: '123',
        hasThrombolysis: false,
        hasCt: true,
        tier: 1,
      },
      {
        id: '2',
        name: 'Hospital B',
        state: 'TN',
        district: 'Chennai',
        lat: 13.0827,
        lng: 80.2707,
        emergencyPhone: '456',
        hasThrombolysis: true,
        hasCt: true,
        tier: 1,
      },
    ];
    const sorted = sortHospitals(13.0827, 80.2707, hospitals);
    expect(sorted[0].hasThrombolysis).toBe(true);
  });

  // Unit test: Chennai to Mumbai distance
  it('Chennai (13.0827, 80.2707) to Mumbai (19.0760, 72.8777) ≈ 1340 km', () => {
    const distance = haversine(13.0827, 80.2707, 19.076, 72.8777);
    expect(distance).toBeCloseTo(1340, 0);
  });
});