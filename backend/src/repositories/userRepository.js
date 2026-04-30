import { query } from "../db.js";

/**
 * Creates a new user in the database
 * @param {Object} user - User data
 * @param {string} user.username - Unique username
 * @param {string} user.passwordHash - Bcrypt hashed password
 * @param {string} user.role - User role (admin or viewer)
 * @returns {Promise<Object>} Created user object with id, username, role, created_at
 */
export async function createUser(user) {
  const result = await query(
    `
      INSERT INTO users (username, password_hash, role, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING id, username, role, created_at, updated_at
    `,
    [user.username, user.passwordHash, user.role]
  );

  return result.rows[0];
}

/**
 * Finds a user by username
 * @param {string} username - Username to search for
 * @returns {Promise<Object|null>} User object with id, username, password_hash, role, or null if not found
 */
export async function findUserByUsername(username) {
  const result = await query(
    `
      SELECT id, username, password_hash, role, created_at, updated_at
      FROM users
      WHERE username = $1
    `,
    [username]
  );

  return result.rows[0] || null;
}

/**
 * Finds a user by ID
 * @param {number} id - User ID to search for
 * @returns {Promise<Object|null>} User object with id, username, role (without password_hash), or null if not found
 */
export async function findUserById(id) {
  const result = await query(
    `
      SELECT id, username, role, created_at, updated_at
      FROM users
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}
