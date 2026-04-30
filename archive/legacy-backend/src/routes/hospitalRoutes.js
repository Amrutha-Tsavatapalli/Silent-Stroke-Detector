import { Router } from "express";
import { nearestHospital } from "../services/hospitalService.js";

const router = Router();

router.get("/nearest", (req, res) => {
  const location = String(req.query.location || "Unknown location");
  res.json(nearestHospital(location));
});

export default router;
