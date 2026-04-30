import cors from "cors";
import { config } from "../config.js";

/**
 * CORS middleware with environment-based origin validation
 * 
 * Development: Allows all origins
 * Production: Restricts to specific domains from CORS_ORIGINS environment variable
 * 
 * Supports credentials (cookies, authorization headers) for authenticated requests
 */

/**
 * Validates if an origin is allowed based on configuration
 * @param {string} origin - The origin to validate
 * @param {Function} callback - Callback function (error, allowed)
 */
function validateOrigin(origin, callback) {
  // In development, allow all origins
  if (config.nodeEnv === "development") {
    callback(null, true);
    return;
  }

  // Parse allowed origins from configuration
  const allowedOrigins = config.corsOrigins
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // Allow requests with no origin (e.g., mobile apps, Postman)
  if (!origin) {
    callback(null, true);
    return;
  }

  // Check if origin is in the allowed list
  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  }
}

/**
 * CORS options configuration
 */
const corsOptions = {
  origin: validateOrigin,
  credentials: true, // Allow credentials (cookies, authorization headers)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Length", "X-Request-Id"],
  maxAge: 86400, // Cache preflight requests for 24 hours
};

/**
 * Configured CORS middleware
 */
export const corsMiddleware = cors(corsOptions);
