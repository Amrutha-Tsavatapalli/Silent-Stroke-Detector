import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, pool } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, "../../sql/schema.sql");

async function main() {
  const sql = fs.readFileSync(schemaPath, "utf-8");
  await query(sql);
  console.log("Database schema initialized.");
}

main()
  .catch((error) => {
    console.error("Failed to initialize database schema.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
