import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hospitalsPath = path.resolve(__dirname, "../../../data/hospitals.json");

export function loadHospitals() {
  const raw = fs.readFileSync(hospitalsPath, "utf-8");
  return JSON.parse(raw);
}

export function nearestHospital(locationHint = "Unknown location") {
  const hospitals = loadHospitals();
  return hospitals[0] || {
    name: "Nearest Government Hospital",
    city: locationHint,
    phone: "108",
  };
}
