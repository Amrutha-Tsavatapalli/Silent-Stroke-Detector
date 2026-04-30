import { Pool } from "pg";
import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes("railway.app") || config.databaseUrl.includes("proxy.rlwy.net")
    ? { rejectUnauthorized: false }
    : false,
});

export async function query(text, params = []) {
  return pool.query(text, params);
}
