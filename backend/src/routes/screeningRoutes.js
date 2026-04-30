import { Router } from "express";
import {
  createScreening,
  listScreenings,
  getScreeningById,
  getScreeningsByPatient,
  searchScreenings,
  calculatePatientTrend
} from "../repositories/screeningRepository.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { nearestHospital } from "../services/hospitalService.js";
import { notificationService } from "../services/notificationService.js";

const router = Router();

// Apply authentication middleware to all screening routes
router.use(authenticate);

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

// GET /api/screenings/search - Search screenings with filters
router.get("/search", async (req, res, next) => {
  try {
    const filters = {};
    
    // Extract filter parameters from query string
    if (req.query.patientName) filters.patientName = req.query.patientName;
    if (req.query.location) filters.location = req.query.location;
    if (req.query.riskScoreMin) filters.riskScoreMin = parseFloat(req.query.riskScoreMin);
    if (req.query.riskScoreMax) filters.riskScoreMax = parseFloat(req.query.riskScoreMax);
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.shouldAlert !== undefined) {
      filters.shouldAlert = req.query.shouldAlert === 'true';
    }
    if (req.query.priority) filters.priority = req.query.priority;
    
    const limit = Number(req.query.limit || 20);
    const offset = Number(req.query.offset || 0);
    
    const result = await searchScreenings(filters, limit, offset);
    
    res.json({
      items: result.items,
      total: result.total,
      filters: filters
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/screenings/patient/:patientName - Get patient history with trend
router.get("/patient/:patientName", async (req, res, next) => {
  try {
    const { patientName } = req.params;
    const limit = Number(req.query.limit || 20);
    const offset = Number(req.query.offset || 0);
    
    const result = await getScreeningsByPatient(patientName, limit, offset);
    const trend = await calculatePatientTrend(patientName);
    
    res.json({
      items: result.items,
      trend: trend,
      total: result.total
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/screenings/:id - Get screening by ID with alert events and nearest hospital
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        error: "Bad Request",
        detail: "Invalid screening ID"
      });
    }
    
    const screening = await getScreeningById(id);
    
    if (!screening) {
      return res.status(404).json({
        error: "Not Found",
        detail: "Screening not found"
      });
    }
    
    // Get nearest hospital based on screening location
    const hospital = nearestHospital(screening.location);
    screening.nearest_hospital = hospital;
    
    res.json(screening);
  } catch (error) {
    next(error);
  }
});

// POST /api/screenings/:id/alert - Manually trigger alert notification
router.post("/:id/alert", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        error: "Bad Request",
        detail: "Invalid screening ID"
      });
    }
    
    // Trigger alert notification
    const result = await notificationService.triggerAlertForScreening(id);
    
    res.json(result);
  } catch (error) {
    // Handle specific errors
    if (error.statusCode === 404) {
      return res.status(404).json({
        error: "Not Found",
        detail: error.message
      });
    }
    
    // Handle other errors as 500
    return res.status(500).json({
      error: "Internal Server Error",
      detail: "Failed to send alert notification"
    });
  }
});

export default router;
