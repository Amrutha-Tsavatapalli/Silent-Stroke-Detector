import { Router } from "express";
import { createScreening, listScreenings } from "../repositories/screeningRepository.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 20);
    const screenings = await listScreenings(limit);
    res.json({ items: screenings });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const screening = req.body;
    const screeningId = await createScreening(screening);
    res.status(201).json({
      screeningId,
      riskScore: screening.fusion?.risk_score ?? null,
      shouldAlert: screening.alert?.should_alert ?? false,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
