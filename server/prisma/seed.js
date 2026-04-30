/**
 * Hospital seed script for FAST Check ML Pipeline Migration
 *
 * Reads data/hospitals.json and bulk-inserts into the hospitals table.
 * Skips rows that already exist (upsert by name + district using ON CONFLICT DO NOTHING).
 *
 * NOTE: Requires a UNIQUE constraint on (name, district) in the hospitals table.
 * Add this to schema.sql if not already present:
 *   ALTER TABLE hospitals ADD CONSTRAINT uq_hospitals_name_district UNIQUE (name, district);
 *
 * Usage:
 *   node server/prisma/seed.js
 *
 * Requirements: 8.7
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve hospitals.json relative to the server directory (../../data/hospitals.json)
const HOSPITALS_JSON_PATH = resolve(__dirname, '../../data/hospitals.json');

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  let inserted = 0;
  let skipped = 0;

  try {
    console.log(`Reading hospitals from: ${HOSPITALS_JSON_PATH}`);
    const raw = await readFile(HOSPITALS_JSON_PATH, 'utf-8');
    const hospitals = JSON.parse(raw);

    console.log(`Found ${hospitals.length} hospitals to seed.`);

    // Ensure the UNIQUE constraint exists so ON CONFLICT works correctly.
    // Uses a DO block to check pg_constraint first — idempotent, safe to run multiple times.
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'uq_hospitals_name_district'
        ) THEN
          ALTER TABLE hospitals
            ADD CONSTRAINT uq_hospitals_name_district UNIQUE (name, district);
        END IF;
      END
      $$
    `);

    for (const h of hospitals) {
      const result = await pool.query(
        `INSERT INTO hospitals
           (name, state, district, lat, lng, emergency_phone, has_thrombolysis, has_ct, tier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (name, district) DO NOTHING`,
        [
          h.name,
          h.state,
          h.district,
          h.lat,
          h.lng,
          h.emergencyPhone,
          h.hasThrombolysis,
          h.hasCt,
          h.tier,
        ]
      );

      if (result.rowCount > 0) {
        inserted++;
        console.log(`  ✓ Inserted: ${h.name} (${h.district})`);
      } else {
        skipped++;
        console.log(`  – Skipped (already exists): ${h.name} (${h.district})`);
      }
    }

    console.log(`\nSeed complete. Inserted: ${inserted}, Skipped: ${skipped}`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log('Database pool closed.');
  }
}

seed();
