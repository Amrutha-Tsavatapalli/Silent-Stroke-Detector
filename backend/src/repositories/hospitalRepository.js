import { query } from "../db.js";

/**
 * HospitalRepository handles database operations for hospitals
 */

/**
 * Creates a new hospital in the database
 * @param {Object} hospital - Hospital data
 * @param {string} hospital.name - Hospital name
 * @param {string} hospital.phone - Hospital phone number
 * @param {string} hospital.address - Hospital address
 * @param {number} hospital.latitude - Hospital latitude
 * @param {number} hospital.longitude - Hospital longitude
 * @param {Array} hospital.capabilities - Hospital capabilities (optional)
 * @returns {Promise<Object>} Created hospital object
 * @throws {Error} If duplicate hospital exists (same name and location)
 */
export async function createHospital(hospital) {
  try {
    const result = await query(
      `
        INSERT INTO hospitals (name, phone, address, latitude, longitude, capabilities, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, name, phone, address, latitude, longitude, capabilities, created_at, updated_at
      `,
      [
        hospital.name,
        hospital.phone,
        hospital.address,
        hospital.latitude,
        hospital.longitude,
        JSON.stringify(hospital.capabilities || []),
      ]
    );

    return result.rows[0];
  } catch (error) {
    // Handle unique constraint violation (duplicate hospital)
    if (error.code === "23505") {
      const err = new Error(
        "Hospital with same name and location already exists"
      );
      err.statusCode = 409;
      throw err;
    }
    throw error;
  }
}

/**
 * Updates an existing hospital by ID
 * @param {number} id - Hospital ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated hospital object
 * @throws {Error} If hospital not found
 */
export async function updateHospital(id, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  // Build dynamic UPDATE query based on provided fields
  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.phone !== undefined) {
    fields.push(`phone = $${paramIndex++}`);
    values.push(updates.phone);
  }
  if (updates.address !== undefined) {
    fields.push(`address = $${paramIndex++}`);
    values.push(updates.address);
  }
  if (updates.latitude !== undefined) {
    fields.push(`latitude = $${paramIndex++}`);
    values.push(updates.latitude);
  }
  if (updates.longitude !== undefined) {
    fields.push(`longitude = $${paramIndex++}`);
    values.push(updates.longitude);
  }
  if (updates.capabilities !== undefined) {
    fields.push(`capabilities = $${paramIndex++}`);
    values.push(JSON.stringify(updates.capabilities));
  }

  if (fields.length === 0) {
    throw new Error("No fields to update");
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `
      UPDATE hospitals
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name, phone, address, latitude, longitude, capabilities, created_at, updated_at
    `,
    values
  );

  if (result.rows.length === 0) {
    const error = new Error("Hospital not found");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

/**
 * Deletes a hospital by ID
 * @param {number} id - Hospital ID
 * @returns {Promise<boolean>} True if deleted successfully
 * @throws {Error} If hospital not found
 */
export async function deleteHospital(id) {
  const result = await query(
    `
      DELETE FROM hospitals
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  if (result.rows.length === 0) {
    const error = new Error("Hospital not found");
    error.statusCode = 404;
    throw error;
  }

  return true;
}

/**
 * Lists hospitals with pagination
 * @param {number} limit - Maximum number of hospitals to return
 * @param {number} offset - Number of hospitals to skip
 * @returns {Promise<Object>} Object with items array and total count
 */
export async function listHospitals(limit = 10, offset = 0) {
  const result = await query(
    `
      SELECT id, name, phone, address, latitude, longitude, capabilities, created_at, updated_at
      FROM hospitals
      ORDER BY name ASC
      LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  const countResult = await query(`SELECT COUNT(*) FROM hospitals`);
  const total = parseInt(countResult.rows[0].count, 10);

  return {
    items: result.rows,
    total,
  };
}

/**
 * Searches hospitals by name or address (case-insensitive partial match)
 * @param {string} searchQuery - Search term for name or address
 * @returns {Promise<Array>} Array of matching hospitals
 */
export async function searchHospitals(searchQuery) {
  const result = await query(
    `
      SELECT id, name, phone, address, latitude, longitude, capabilities, created_at, updated_at
      FROM hospitals
      WHERE name ILIKE $1 OR address ILIKE $1
      ORDER BY name ASC
    `,
    [`%${searchQuery}%`]
  );

  return result.rows;
}

/**
 * Finds the nearest hospital to given coordinates using Haversine formula
 * @param {number} latitude - Target latitude
 * @param {number} longitude - Target longitude
 * @returns {Promise<Object|null>} Nearest hospital object with distance, or null if no hospitals
 */
export async function findNearestHospital(latitude, longitude) {
  // Haversine formula to calculate distance in kilometers
  const result = await query(
    `
      SELECT 
        id, name, phone, address, latitude, longitude, capabilities,
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(latitude)) * 
            cos(radians(longitude) - radians($2)) + 
            sin(radians($1)) * sin(radians(latitude))
          )
        ) AS distance
      FROM hospitals
      ORDER BY distance ASC
      LIMIT 1
    `,
    [latitude, longitude]
  );

  return result.rows[0] || null;
}

/**
 * Gets a hospital by ID
 * @param {number} id - Hospital ID
 * @returns {Promise<Object|null>} Hospital object or null if not found
 */
export async function getHospitalById(id) {
  const result = await query(
    `
      SELECT id, name, phone, address, latitude, longitude, capabilities, created_at, updated_at
      FROM hospitals
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}
