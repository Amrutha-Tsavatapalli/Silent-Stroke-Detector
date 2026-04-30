import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Executes a SQL query against the connection pool.
 *
 * @param {string} text   - SQL query string
 * @param {Array}  params - Query parameters (optional)
 * @returns {Promise<import('pg').QueryResult>} Query result
 */
export function query(text, params) {
  return pool.query(text, params);
}

export default pool;
