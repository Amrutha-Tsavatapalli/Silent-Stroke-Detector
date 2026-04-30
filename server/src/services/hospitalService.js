/**
 * Hospital Service - Geohashing for spatial indexing
 * 
 * Provides geohash encoding functions for efficient spatial queries
 * on the hospitals table. Uses base32 encoding with the standard
 * geohash alphabet.
 * 
 * Requirements: 5.3, 5.4, 5.5
 */

// Standard geohash alphabet (base32)
const BASE32_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encodes a latitude/longitude pair to a geohash string.
 * 
 * @param {number} lat - Latitude in degrees [-90, 90]
 * @param {number} lng - Longitude in degrees [-180, 180]
 * @param {number} precision - Number of characters (default: 6, ~610m × 1220m)
 * @returns {string} Geohash string
 * 
 * @example
 * geohash.encode(13.0827, 80.2707, 6) // => 'mc78ru'
 * geohash.encode(13.0827, 80.2707)    // => 'mc78ru' (default precision)
 */
export function encode(lat, lng, precision = 6) {
  if (lat < -90 || lat > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }
  if (lng < -180 || lng > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }
  if (precision < 1 || precision > 12) {
    throw new Error('Precision must be between 1 and 12');
  }

  let latInterval = [-90, 90];
  let lngInterval = [-180, 180];
  
  let bit = 0;
  let ch = 0;
  let geohash = '';
  let isEven = true;

  const totalBits = precision * 5;

  while (geohash.length < precision) {
    if (isEven) {
      const mid = (lngInterval[0] + lngInterval[1]) / 2;
      if (lng >= mid) {
        ch |= (1 << (4 - bit));
        lngInterval[0] = mid;
      } else {
        lngInterval[1] = mid;
      }
    } else {
      const mid = (latInterval[0] + latInterval[1]) / 2;
      if (lat >= mid) {
        ch |= (1 << (4 - bit));
        latInterval[0] = mid;
      } else {
        latInterval[1] = mid;
      }
    }

    isEven = !isEven;

    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32_ALPHABET[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

/**
 * Returns neighboring geohashes (8 surrounding cells).
 * 
 * @param {string} geohash - The center geohash
 * @returns {string[]} Array of 8 neighboring geohashes [N, NE, E, SE, S, SW, W, NW]
 */
export function getNeighbors(geohash) {
  const lat = decode(geohash).lat;
  const lng = decode(geohash).lng;
  const precision = geohash.length;
  
  // Get the bounding box of this geohash cell
  const bbox = decodeBbox(geohash);
  
  // Calculate step sizes
  const latStep = (bbox.north - bbox.south) / 2;
  const lngStep = (bbox.east - bbox.west) / 2;
  
  const neighbors = [
    // North
    encode((bbox.north + latStep), lng, precision),
    // North East
    encode((bbox.north + latStep), (bbox.east + lngStep), precision),
    // East
    encode(lat, (bbox.east + lngStep), precision),
    // South East
    encode((bbox.south - latStep), (bbox.east + lngStep), precision),
    // South
    encode((bbox.south - latStep), lng, precision),
    // South West
    encode((bbox.south - latStep), (bbox.west - lngStep), precision),
    // West
    encode(lat, (bbox.west - lngStep), precision),
    // North West
    encode((bbox.north + latStep), (bbox.west - lngStep), precision),
  ];
  
  return neighbors;
}

/**
 * Decodes a geohash to approximate latitude/longitude center.
 * 
 * @param {string} geohash - Geohash string
 * @returns {{ lat: number, lng: number }} Approximate center coordinates
 */
export function decode(geohash) {
  let latInterval = [-90, 90];
  let lngInterval = [-180, 180];
  
  let isEven = true;
  
  for (let i = 0; i < geohash.length; i++) {
    const char = geohash[i];
    const charIndex = BASE32_ALPHABET.indexOf(char);
    
    if (charIndex === -1) {
      throw new Error(`Invalid geohash character: ${char}`);
    }
    
    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (charIndex >> bit) & 1;
      
      if (isEven) {
        const mid = (lngInterval[0] + lngInterval[1]) / 2;
        if (bitValue === 1) {
          lngInterval[0] = mid;
        } else {
          lngInterval[1] = mid;
        }
      } else {
        const mid = (latInterval[0] + latInterval[1]) / 2;
        if (bitValue === 1) {
          latInterval[0] = mid;
        } else {
          latInterval[1] = mid;
        }
      }
      
      isEven = !isEven;
    }
  }
  
  return {
    lat: (latInterval[0] + latInterval[1]) / 2,
    lng: (lngInterval[0] + lngInterval[1]) / 2,
  };
}

/**
 * Returns the bounding box for a geohash.
 * 
 * @param {string} geohash - Geohash string
 * @returns {{ north: number, south: number, east: number, west: number }}
 */
export function decodeBbox(geohash) {
  let latInterval = [-90, 90];
  let lngInterval = [-180, 180];
  
  let isEven = true;
  
  for (let i = 0; i < geohash.length; i++) {
    const char = geohash[i];
    const charIndex = BASE32_ALPHABET.indexOf(char);
    
    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (charIndex >> bit) & 1;
      
      if (isEven) {
        const mid = (lngInterval[0] + lngInterval[1]) / 2;
        if (bitValue === 1) {
          lngInterval[0] = mid;
        } else {
          lngInterval[1] = mid;
        }
      } else {
        const mid = (latInterval[0] + latInterval[1]) / 2;
        if (bitValue === 1) {
          latInterval[0] = mid;
        } else {
          latInterval[1] = mid;
        }
      }
      
      isEven = !isEven;
    }
  }
  
  return {
    north: latInterval[1],
    south: latInterval[0],
    east: lngInterval[1],
    west: lngInterval[0],
  };
}

/**
 * Encodes a bounding box around a center point with a given radius.
 * Returns an array of geohashes that cover the area, including
 * neighboring geohashes to handle edge cases.
 * 
 * @param {number} lat - Center latitude in degrees
 * @param {number} lng - Center longitude in degrees
 * @param {number} radiusKm - Radius in kilometers
 * @returns {string[]} Array of geohash strings covering the bounding box
 * 
 * @example
 * geohash.encodeBoundingBox(13.0827, 80.2707, 10)
 * // Returns geohashes covering a 10km radius around Chennai
 */
export function encodeBoundingBox(lat, lng, radiusKm) {
  // Calculate bounding box in degrees
  // Approximate: 1 degree latitude ≈ 111 km
  // 1 degree longitude ≈ 111 * cos(latitude) km
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;
  
  // Determine precision based on radius
  // Precision 6 ≈ 1.2km × 0.6km cells
  // Precision 5 ≈ 4km × 2km cells
  // Precision 4 ≈ 20km × 10km cells
  let precision;
  if (radiusKm <= 1) {
    precision = 7;
  } else if (radiusKm <= 5) {
    precision = 6;
  } else if (radiusKm <= 20) {
    precision = 5;
  } else if (radiusKm <= 80) {
    precision = 4;
  } else {
    precision = 3;
  }
  
  // Get the center geohash
  const centerGeohash = encode(lat, lng, precision);
  
  // Get bounding box of center geohash
  const centerBbox = decodeBbox(centerGeohash);
  
  // Check if the bounding box covers the entire radius
  const coversCenter = 
    minLat >= centerBbox.south &&
    maxLat <= centerBbox.north &&
    minLng >= centerBbox.west &&
    maxLng <= centerBbox.east;
  
  if (coversCenter) {
    return [centerGeohash];
  }
  
  // Need to get neighboring geohashes
  // Calculate grid of geohashes needed
  const geohashes = new Set();
  
  // Add center
  geohashes.add(centerGeohash);
  
  // Add neighbors and their neighbors for edge coverage
  const neighbors = getNeighbors(centerGeohash);
  neighbors.forEach(n => geohashes.add(n));
  
  // For larger radii, add second ring of neighbors
  if (radiusKm > 5) {
    neighbors.forEach(n => {
      getNeighbors(n).forEach(nn => geohashes.add(nn));
    });
  }
  
  // Filter to only include geohashes that overlap with our bounding box
  const result = [];
  for (const gh of geohashes) {
    const bbox = decodeBbox(gh);
    
    // Check if this geohash overlaps with our search area
    const overlaps = 
      bbox.north >= minLat &&
      bbox.south <= maxLat &&
      bbox.east >= minLng &&
      bbox.west <= maxLng;
    
    if (overlaps) {
      result.push(gh);
    }
  }
  
  return result;
}

/**
 * Computes the great-circle distance between two GPS coordinates using the
 * Haversine formula with Earth radius 6371 km.
 * 
 * @param {number} lat1 - Origin latitude in degrees
 * @param {number} lng1 - Origin longitude in degrees
 * @param {number} lat2 - Destination latitude in degrees
 * @param {number} lng2 - Destination longitude in degrees
 * @returns {number} Distance in kilometres
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Queries hospitals using geohash-based spatial indexing.
 * Falls back to Haversine for final sorting.
 * 
 * @param {object} db - Database query function
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @param {number} radiusKm - Search radius in km (default: 50)
 * @returns {Promise<Array>} Array of hospitals sorted by capability-weighted distance
 */
export async function findNearestHospitals(db, lat, lng, radiusKm = 50) {
  // Get geohashes covering the search area
  const geohashes = encodeBoundingBox(lat, lng, radiusKm);
  
  // Build the query with geohash prefix matching
  const placeholders = geohashes.map((_, i) => `$${i + 1}`).join(', ');
  
  const queryText = `
    SELECT 
      id,
      name,
      state,
      district,
      lat,
      lng,
      emergency_phone,
      has_thrombolysis,
      has_ct,
      tier,
      geohash
    FROM hospitals
    WHERE geohash IN (${placeholders})
       OR geohash LIKE (
         SELECT SUBSTRING(geohash FROM 1 FOR 5) || '%'
         FROM hospitals
         WHERE geohash = $${geohashes.length + 1}
         LIMIT 1
       )
    ORDER BY 
      CASE 
        WHEN has_thrombolysis THEN 1 
        ELSE 2 
      END,
      (lat - $${geohashes.length + 2}) * (lat - $${geohashes.length + 2}) +
      (lng - $${geohashes.length + 3}) * (lng - $${geohashes.length + 3})
    LIMIT 20
  `;
  
  const params = [...geohashes, encode(lat, lng, 5), lat, lng];
  
  try {
    const result = await db(queryText, params);
    
    // If no results from geohash query, fall back to full table scan
    if (result.rows.length === 0) {
      return findNearestHospitalsFullScan(db, lat, lng);
    }
    
    // Calculate actual distances using Haversine and sort
    const hospitals = result.rows.map((row) => {
      const distance = haversine(lat, lng, Number(row.lat), Number(row.lng));
      const sortScore = distance * (row.has_thrombolysis ? 1 : 4);
      return {
        id: row.id,
        name: row.name,
        state: row.state,
        district: row.district,
        lat: Number(row.lat),
        lng: Number(row.lng),
        emergencyPhone: row.emergency_phone,
        hasThrombolysis: row.has_thrombolysis,
        hasCt: row.has_ct,
        tier: row.tier,
        distance,
        sortScore,
      };
    });
    
    // Final sort by sortScore
    hospitals.sort((a, b) => a.sortScore - b.sortScore);
    
    return hospitals.slice(0, 3);
  } catch (err) {
    // If geohash column doesn't exist yet, fall back to full scan
    if (err.message.includes('geohash') || err.code === '42703') {
      return findNearestHospitalsFullScan(db, lat, lng);
    }
    throw err;
  }
}

/**
 * Fallback full-table scan for hospital queries.
 * Used when geohash index is not available.
 * 
 * @param {object} db - Database query function
 * @param {number} lat - User latitude
 * @param {number} lng - User longitude
 * @returns {Promise<Array>} Array of hospitals sorted by capability-weighted distance
 */
async function findNearestHospitalsFullScan(db, lat, lng) {
  const result = await db(
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
     FROM hospitals`
  );

  const hospitals = result.rows.map((row) => {
    const distance = haversine(lat, lng, Number(row.lat), Number(row.lng));
    const sortScore = distance * (row.has_thrombolysis ? 1 : 4);
    return {
      id: row.id,
      name: row.name,
      state: row.state,
      district: row.district,
      lat: Number(row.lat),
      lng: Number(row.lng),
      emergencyPhone: row.emergency_phone,
      hasThrombolysis: row.has_thrombolysis,
      hasCt: row.has_ct,
      tier: row.tier,
      distance,
      sortScore,
    };
  });

  hospitals.sort((a, b) => a.sortScore - b.sortScore);
  return hospitals.slice(0, 3);
}

export default {
  encode,
  decode,
  decodeBbox,
  getNeighbors,
  encodeBoundingBox,
  haversine,
  findNearestHospitals,
};