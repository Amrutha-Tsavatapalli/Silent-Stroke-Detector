import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as hospitalRepository from "../repositories/hospitalRepository.js";
import { pool } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hospitalsPath = path.resolve(__dirname, "../../../data/hospitals.json");

/**
 * Migrates hospital data from JSON file to database
 * Handles duplicates gracefully and logs progress
 */
async function migrateHospitals() {
  console.log("Starting hospital data migration...");
  console.log(`Reading hospitals from: ${hospitalsPath}`);

  try {
    // Read hospitals from JSON file
    const raw = fs.readFileSync(hospitalsPath, "utf-8");
    const hospitals = JSON.parse(raw);

    console.log(`Found ${hospitals.length} hospitals in JSON file`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Insert each hospital into database
    for (const hospital of hospitals) {
      try {
        const hospitalData = {
          name: hospital.name,
          phone: hospital.phone,
          address: hospital.city, // Using city as address
          latitude: hospital.lat,
          longitude: hospital.lon,
          capabilities: [], // Default empty capabilities
        };

        await hospitalRepository.createHospital(hospitalData);
        successCount++;
        console.log(`✓ Inserted: ${hospital.name} (${hospital.city})`);
      } catch (error) {
        if (error.statusCode === 409) {
          // Duplicate hospital - skip
          skipCount++;
          console.log(`⊘ Skipped (duplicate): ${hospital.name} (${hospital.city})`);
        } else {
          // Other error
          errorCount++;
          console.error(
            `✗ Error inserting ${hospital.name}: ${error.message}`
          );
        }
      }
    }

    console.log("\nMigration complete!");
    console.log(`Successfully inserted: ${successCount}`);
    console.log(`Skipped (duplicates): ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total processed: ${hospitals.length}`);
  } catch (error) {
    console.error("Migration failed:", error.message);
    throw error;
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateHospitals()
    .then(() => {
      console.log("\nMigration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nMigration script failed:", error);
      process.exit(1);
    });
}

export { migrateHospitals };
