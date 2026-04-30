import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { analyticsService } from "../services/analyticsService.js";

const router = Router();

/**
 * GET /api/analytics
 * Get analytics summary for a date range
 * Auth: Required (admin only)
 * Requirements: 3.6, 3.7
 */
router.get("/", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "Bad Request",
        detail: "startDate and endDate query parameters are required",
      });
    }

    // Validate date formats
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: "Bad Request",
        detail: "Invalid date format. Use ISO 8601 format (YYYY-MM-DD)",
      });
    }

    // Get analytics summary
    const analytics = await analyticsService.getAnalyticsSummary(
      startDate,
      endDate
    );

    res.json(analytics);
  } catch (error) {
    // Handle validation errors (date range too large)
    if (error.statusCode === 400) {
      return res.status(400).json({
        error: "Bad Request",
        detail: error.message,
      });
    }

    next(error);
  }
});

export default router;
