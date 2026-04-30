import { Router } from "express";
import Joi from "joi";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import * as hospitalRepository from "../repositories/hospitalRepository.js";

const router = Router();

// Validation schemas
const createHospitalSchema = Joi.object({
  name: Joi.string().required(),
  phone: Joi.string().required(),
  address: Joi.string().required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  capabilities: Joi.array().items(Joi.string()).optional(),
});

const updateHospitalSchema = Joi.object({
  name: Joi.string().optional(),
  phone: Joi.string().optional(),
  address: Joi.string().optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  capabilities: Joi.array().items(Joi.string()).optional(),
}).min(1); // At least one field must be provided

/**
 * GET /api/hospitals
 * List all hospitals with pagination
 * Auth: Required
 */
router.get("/", authenticate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const result = await hospitalRepository.listHospitals(limit, offset);

    res.json({
      items: result.items,
      total: result.total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/hospitals
 * Create a new hospital
 * Auth: Required (admin only)
 */
router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate(createHospitalSchema),
  async (req, res, next) => {
    try {
      const hospital = await hospitalRepository.createHospital(req.body);
      res.status(201).json(hospital);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/hospitals/search
 * Search hospitals by name or location
 * Auth: Required
 */
router.get("/search", authenticate, async (req, res, next) => {
  try {
    const query = req.query.q || "";
    const hospitals = await hospitalRepository.searchHospitals(query);
    res.json({ items: hospitals });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/hospitals/nearest
 * Find nearest hospital by coordinates or location text
 * Auth: Required
 */
router.get("/nearest", authenticate, async (req, res, next) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: "Bad Request",
        detail: "latitude and longitude query parameters are required",
      });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        error: "Bad Request",
        detail: "latitude and longitude must be valid numbers",
      });
    }

    const hospital = await hospitalRepository.findNearestHospital(lat, lon);

    if (!hospital) {
      return res.status(404).json({
        error: "Not Found",
        detail: "No hospitals found in database",
      });
    }

    res.json(hospital);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/hospitals/:id
 * Update an existing hospital
 * Auth: Required (admin only)
 */
router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(updateHospitalSchema),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          error: "Bad Request",
          detail: "Invalid hospital ID",
        });
      }

      const hospital = await hospitalRepository.updateHospital(id, req.body);
      res.json(hospital);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/hospitals/:id
 * Delete a hospital
 * Auth: Required (admin only)
 */
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          error: "Bad Request",
          detail: "Invalid hospital ID",
        });
      }

      await hospitalRepository.deleteHospital(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
