import { maskSensitiveObject } from "../config.js";

/**
 * Global error handling middleware
 * Catches all errors and returns consistent JSON responses
 * 
 * Requirements: 10.3, 10.4, 10.6, 10.7
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function errorHandler(err, req, res, next) {
  // Generate request ID if not already present
  const requestId = req.id || generateRequestId();
  
  // Prepare log entry with all relevant information
  const logEntry = {
    timestamp: new Date().toISOString(),
    requestId,
    userId: req.user?.userId || null,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    body: maskSensitiveObject(req.body || {})
  };
  
  // Log the error
  console.error("Error occurred:", JSON.stringify(logEntry, null, 2));
  
  // Determine status code and error response
  let statusCode = err.statusCode || 500;
  let error = "Internal Server Error";
  let detail = "An unexpected error occurred";
  
  // Handle specific error types
  if (err.name === "ValidationError") {
    // Joi validation errors
    statusCode = 400;
    error = "Bad Request";
    detail = err.message;
  } else if (err.code === "23505") {
    // PostgreSQL unique constraint violation
    statusCode = 409;
    error = "Conflict";
    detail = "Resource already exists";
  } else if (err.code === "23503") {
    // PostgreSQL foreign key constraint violation
    statusCode = 400;
    error = "Bad Request";
    detail = "Invalid reference to related resource";
  } else if (err.code === "23502") {
    // PostgreSQL not null constraint violation
    statusCode = 400;
    error = "Bad Request";
    detail = "Missing required field";
  } else if (err.code && err.code.startsWith("23")) {
    // Other PostgreSQL constraint violations
    statusCode = 400;
    error = "Bad Request";
    detail = "Database constraint violation";
  } else if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    // Database connection errors
    statusCode = 503;
    error = "Service Unavailable";
    detail = "Database connection failed";
  } else if (err.message && err.message.toLowerCase().includes("not found")) {
    // Resource not found errors
    statusCode = 404;
    error = "Not Found";
    detail = err.message;
  } else if (err.statusCode) {
    // Custom errors with statusCode property
    statusCode = err.statusCode;
    
    if (statusCode === 401) {
      error = "Unauthorized";
      detail = err.message;
    } else if (statusCode === 403) {
      error = "Forbidden";
      detail = err.message;
    } else if (statusCode === 404) {
      error = "Not Found";
      detail = err.message;
    } else if (statusCode === 409) {
      error = "Conflict";
      detail = err.message;
    } else if (statusCode === 400) {
      error = "Bad Request";
      detail = err.message;
    } else if (statusCode >= 500) {
      error = "Internal Server Error";
      // Don't expose internal error details for 5xx errors
      detail = "An unexpected error occurred";
    }
  } else if (err.name === "JsonWebTokenError") {
    // JWT errors
    statusCode = 401;
    error = "Unauthorized";
    detail = "Invalid token";
  } else if (err.name === "TokenExpiredError") {
    // JWT expiration errors
    statusCode = 401;
    error = "Unauthorized";
    detail = "Token has expired";
  }
  
  // For database errors (5xx), don't expose internal details
  if (statusCode === 500 && err.code) {
    detail = "Internal server error";
  }
  
  // Build error response
  const errorResponse = {
    error,
    detail
  };
  
  // Add request ID to response headers for tracking
  res.setHeader("X-Request-ID", requestId);
  
  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Generates a unique request ID
 * @returns {string} Request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 404 Not Found handler for undefined routes
 * Should be added after all route definitions
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: "Not Found",
    detail: `Route ${req.method} ${req.path} not found`
  });
}
