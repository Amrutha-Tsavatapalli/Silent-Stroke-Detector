import { Router } from 'express';
import { query } from '../db.js';
import { 
  encode, 
  encodeBoundingBox, 
  haversine, 
  findNearestHospitals 
} from '../services/hospitalService.js';

const router = Router();

// In-memory version tracking (in production, this could be stored in DB or file)
let hospitalDataVersion = {
  version: 1,
  timestamp: Date.now(),
  count: 0
};

// Initialize version from database on startup
(async () => {
  try {
    const result = await query('SELECT COUNT(*) as count FROM hospitals');
    hospitalDataVersion.count = parseInt(result.rows[0].count, 10);
    hospitalDataVersion.timestamp = Date.now();
  } catch (err) {
    console.error('Failed to initialize hospital version:', err);
  }
})();

/**
 * GET /api/hospitals/nearest?lat&lng
 *
 * Query params:
 *   lat {number} - User latitude  [-90, 90]
 *   lng {number} - User longitude [-180, 180]
 *   radius {number} - Optional search radius in km (default: 50)
 *
 * Returns the top 3 hospitals sorted ascending by capability-weighted
 * Haversine distance (sortScore = distance × (has_thrombolysis ? 1 : 4)).
 * Uses geohash-based spatial indexing for efficient queries.
 *
 * HTTP 400 if lat/lng are missing or out of range.
 */
router.get('/nearest', async (req, res) => {
  const { lat: latStr, lng: lngStr, radius: radiusStr } = req.query;

  // Validate presence
  if (latStr === undefined || latStr === null || latStr === '') {
    return res.status(400).json({ error: 'Missing parameter', detail: 'lat is required' });
  }
  if (lngStr === undefined || lngStr === null || lngStr === '') {
    return res.status(400).json({ error: 'Missing parameter', detail: 'lng is required' });
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  const radiusKm = radiusStr ? parseFloat(radiusStr) : 50;

  // Validate numeric
  if (Number.isNaN(lat)) {
    return res.status(400).json({ error: 'Invalid parameter', detail: 'lat must be a number' });
  }
  if (Number.isNaN(lng)) {
    return res.status(400).json({ error: 'Invalid parameter', detail: 'lng must be a number' });
  }
  if (Number.isNaN(radiusKm)) {
    return res.status(400).json({ error: 'Invalid parameter', detail: 'radius must be a number' });
  }

  // Validate range
  if (lat < -90 || lat > 90) {
    return res.status(400).json({
      error: 'Out of range',
      detail: 'lat must be in the range [-90, 90]',
    });
  }
  if (lng < -180 || lng > 180) {
    return res.status(400).json({
      error: 'Out of range',
      detail: 'lng must be in the range [-180, 180]',
    });
  }
  if (radiusKm <= 0 || radiusKm > 500) {
    return res.status(400).json({
      error: 'Out of range',
      detail: 'radius must be between 0 and 500 km',
    });
  }

  try {
    // Use geohash-based query for efficiency
    const hospitals = await findNearestHospitals(query, lat, lng, radiusKm);

    return res.json(hospitals.slice(0, 3));
  } catch (err) {
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

/**
 * GET /api/hospitals/version
 * 
 * Returns version metadata for hospital data.
 * Used by the service worker to check if data needs updating.
 * 
 * Returns:
 *   { version: number, timestamp: number, count: number }
 */
router.get('/version', async (req, res) => {
  try {
    // Refresh count from database
    const result = await query('SELECT COUNT(*) as count FROM hospitals');
    hospitalDataVersion.count = parseInt(result.rows[0].count, 10);
    
    return res.json({
      version: hospitalDataVersion.version,
      timestamp: hospitalDataVersion.timestamp,
      count: hospitalDataVersion.count
    });
  } catch (err) {
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

/**
 * GET /api/hospitals/data
 * 
 * Returns the full hospital dataset.
 * Supports ETag for conditional fetching to reduce bandwidth.
 * 
 * Headers:
 *   If-None-Match - Optional ETag for conditional request
 * 
 * Returns:
 *   { hospitals: Array, version: number, etag: string }
 */
router.get('/data', async (req, res) => {
  const clientEtag = req.headers['if-none-match'];
  const serverEtag = `"v${hospitalDataVersion.version}-${hospitalDataVersion.count}"`;
  
  // Check if client has latest version
  if (clientEtag && clientEtag === serverEtag) {
    return res.status(304).end();
  }
  
  try {
    const result = await query(
      `SELECT 
         id, 
         name, 
         state, 
         district, 
         lat, 
         lng, 
         emergency_phone, 
         has_thrombolysis, 
         has_ct, 
         tier 
       FROM hospitals 
       ORDER BY name`
    );
    
    const hospitals = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      state: row.state,
      district: row.district,
      lat: Number(row.lat),
      lng: Number(row.lng),
      emergencyPhone: row.emergency_phone,
      hasThrombolysis: row.has_thrombolysis,
      hasCt: row.has_ct,
      tier: row.tier
    }));
    
    // Update version info
    hospitalDataVersion.count = hospitals.length;
    hospitalDataVersion.timestamp = Date.now();
    
    res.set('ETag', serverEtag);
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    return res.json({
      hospitals,
      version: hospitalDataVersion.version,
      etag: serverEtag
    });
  } catch (err) {
    return res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

export default router;
