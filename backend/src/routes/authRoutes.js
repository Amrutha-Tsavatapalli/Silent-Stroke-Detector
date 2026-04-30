import { Router } from "express";
import Joi from "joi";
import { authService } from "../services/authService.js";

const router = Router();

// Joi validation schemas
const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required().messages({
    "string.empty": "Username is required",
    "string.min": "Username must be at least 3 characters long",
    "string.max": "Username must not exceed 50 characters",
    "any.required": "Username is required",
  }),
  password: Joi.string().min(8).max(100).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 8 characters long",
    "string.max": "Password must not exceed 100 characters",
    "any.required": "Password is required",
  }),
  role: Joi.string().valid("admin", "viewer").required().messages({
    "any.only": "Role must be either 'admin' or 'viewer'",
    "any.required": "Role is required",
  }),
});

const loginSchema = Joi.object({
  username: Joi.string().required().messages({
    "string.empty": "Username is required",
    "any.required": "Username is required",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),
});

/**
 * POST /api/auth/register
 * Register a new user
 * Requirements: 1.1, 1.2, 1.3
 */
router.post("/register", async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const fields = {};
      error.details.forEach((detail) => {
        fields[detail.path[0]] = detail.message;
      });

      return res.status(400).json({
        error: "Validation failed",
        detail: "Invalid request body",
        fields,
      });
    }

    const { username, password, role } = value;

    // Register user
    const user = await authService.register(username, password, role);

    res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error) {
    // Handle duplicate username error (409 Conflict)
    if (error.statusCode === 409) {
      return res.status(409).json({
        error: "Conflict",
        detail: error.message,
      });
    }

    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 * Requirements: 1.2, 1.3
 */
router.post("/login", async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const fields = {};
      error.details.forEach((detail) => {
        fields[detail.path[0]] = detail.message;
      });

      return res.status(400).json({
        error: "Validation failed",
        detail: "Invalid request body",
        fields,
      });
    }

    const { username, password } = value;

    // Authenticate user
    const result = await authService.login(username, password);

    res.status(200).json({
      token: result.token,
      expiresAt: result.expiresAt,
      user: result.user,
    });
  } catch (error) {
    // Handle invalid credentials error (401 Unauthorized)
    // Don't reveal whether username or password was incorrect
    if (error.statusCode === 401) {
      return res.status(401).json({
        error: "Unauthorized",
        detail: "Invalid credentials",
      });
    }

    next(error);
  }
});

export default router;
