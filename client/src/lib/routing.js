/**
 * Haversine-based hospital routing with stroke-capability weighting.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 7.1, 7.4, 7.6
 */

import { triggerSync, getSyncStatus } from './sw-register.js';

const API_BASE = '/api';

/**
 * Computes great-circle distance between two GPS coordinates using Haversine formula.
 * @param {number} lat1 - Origin latitude in degrees
 * @param {number} lng1 - Origin longitude in degrees
 * @param {number} lat2 - Destination latitude in degrees
 * @param {number} lng2 - Destination longitude in degrees
 * @returns {number} Distance in kilometres
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Sorts hospitals by capability-weighted distance and returns top 3.
 * @param {number} userLat - User latitude
 * @param {number} userLng - User longitude
 * @param {Array} hospitals - Array of hospital objects
 * @returns {Array} Top 3 hospitals sorted by sortScore
 */
export function sortHospitals(userLat, userLng, hospitals) {
  const scored = hospitals.map((h) => {
    const distance = haversine(userLat, userLng, h.lat, h.lng);
    const sortScore = distance * (h.hasThrombolysis ? 1 : 4);
    return { ...h, distance, sortScore };
  });

  scored.sort((a, b) => a.sortScore - b.sortScore);
  return scored.slice(0, 3);
}

/**
 * Gets nearest hospitals, with offline fallback.
 * Requirements: 7.1, 7.4
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @returns {Promise<Array>} Top 3 hospitals sorted by capability-weighted distance
 */
export async function getNearestHospital(lat, lng) {
  // First try to get hospital data from IndexedDB via service worker
  try {
    const status = await getSyncStatus();
    
    if (status.count > 0) {
      // IndexedDB has hospital data, fetch from cache
      const response = await fetch('/hospitals.json');
      if (response.ok) {
        const hospitals = await response.json();
        return sortHospitals(lat, lng, hospitals);
      }
    }
  } catch (error) {
    console.warn('[Routing] IndexedDB lookup failed, falling back:', error);
  }

  // Fallback to API endpoint
  try {
    const response = await fetch(`${API_BASE}/hospitals/nearest?lat=${lat}&lng=${lng}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    // Final fallback to cached hospitals.json
    try {
      const response = await fetch('/hospitals.json');
      if (!response.ok) {
        return [];
      }
      const hospitals = await response.json();
      return sortHospitals(lat, lng, hospitals);
    } catch {
      return [];
    }
  }
}

/**
 * Triggers a manual sync of hospital data from the server.
 * Requirements: 7.6
 * @returns {Promise<{success: boolean, updated?: boolean, count?: number, error?: string}>}
 */
export async function syncHospitalsFromServer() {
  return await triggerSync();
}

/**
 * Gets the current hospital data version and freshness status.
 * Requirements: 7.1
 * @returns {Promise<{version: number|null, timestamp: number|null, count: number, isStale: boolean}>}
 */
export async function getHospitalVersion() {
  return await getSyncStatus();
}