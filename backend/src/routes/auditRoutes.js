import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { auditService } from "../services/auditService.js";

const router = Router();

/**
 * GET /api/audit
 * Retrieve audit logs with optional filters
 * Auth: Required (admin only)
 * Requirements: 15.4, 15.5
 */
router.get("/", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const filters = {};

    // Extract filter parameters from query string
    if (req.query.startDate) {
      filters.startDate = req.query.startDate;
    }

    if (req.query.endDate) {
      filters.endDate = req.query.endDate;
    }

    if (req.query.userId) {
      filters.userId = parseInt(req.query.userId);
      if (isNaN(filters.userId)) {
        return res.status(400).json({
          error: "Bad Request",
          detail: "userId must be a valid number",
        });
      }
    }

    if (req.query.operation) {
      const validOperations = ["CREATE", "UPDATE", "DELETE"];
      if (!validOperations.includes(req.query.operation)) {
        return res.status(400).json({
          error: "Bad Request",
          detail: "operation must be one of: CREATE, UPDATE, DELETE",
        });
      }
      filters.operation = req.query.operation;
    }

    if (req.query.tableName) {
      filters.tableName = req.query.tableName;
    }

    // Pagination parameters
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Get audit logs
    const result = await auditService.getAuditLogs(filters, limit, offset);

    res.json({
      items: result.items,
      total: result.total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      filters,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
