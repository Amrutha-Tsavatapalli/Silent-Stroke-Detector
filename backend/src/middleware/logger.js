import winston from "winston";
import { config, maskSensitiveObject } from "../config.js";

/**
 * Winston logger configuration with JSON format for structured logging
 * Requirements: 13.6, 13.7, 14.7
 */
export const logger = winston.createLogger({
  level: config.logLevel || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "silent-stroke-detector-backend" },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      )
    })
  ]
});

// Add file transports in production
if (config.nodeEnv === "production") {
  logger.add(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  );
}

/**
 * Request ID generation middleware
 * Generates a unique ID for each request for tracking across logs
 */
export function requestIdMiddleware(req, res, next) {
  req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader("X-Request-ID", req.id);
  next();
}

/**
 * HTTP request logging middleware
 * Logs all HTTP requests with method, path, status, duration
 * Requirements: 13.6
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();
  
  // Log request
  logger.info("Incoming request", {
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    userId: req.user?.userId || null,
    ip: req.ip
  });
  
  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    res.send = originalSend;
    
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    
    logger.log(logLevel, "Request completed", {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.userId || null
    });
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn("Slow request detected", {
        requestId: req.id,
        method: req.method,
        path: req.path,
        duration: `${duration}ms`
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Authentication event logger
 * Logs login and token validation events
 * Requirements: 13.6
 */
export function logAuthEvent(event, userId, username, success, details = {}) {
  logger.info("Authentication event", {
    event, // 'login', 'token_validation', 'logout'
    userId,
    username,
    success,
    timestamp: new Date().toISOString(),
    ...details
  });
}

/**
 * Authorization failure logger
 * Logs when users attempt to access resources they don't have permission for
 * Requirements: 13.7
 */
export function logAuthorizationFailure(req, requiredRole) {
  logger.warn("Authorization failure", {
    requestId: req.id,
    userId: req.user?.userId || null,
    username: req.user?.username || null,
    userRole: req.user?.role || null,
    requiredRole,
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString()
  });
}

/**
 * Database error logger
 * Logs database errors with masked sensitive data
 * Requirements: 13.7, 14.7
 */
export function logDatabaseError(error, query, params = {}) {
  logger.error("Database error", {
    error: error.message,
    code: error.code,
    query,
    params: maskSensitiveObject(params),
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
}

/**
 * Slow query logger
 * Logs database queries that take longer than 500ms
 * Requirements: 13.7
 */
export function logSlowQuery(query, duration, params = {}) {
  if (duration > 500) {
    logger.warn("Slow query detected", {
      query,
      duration: `${duration}ms`,
      params: maskSensitiveObject(params),
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * External API call logger
 * Logs calls to external APIs (e.g., Twilio)
 * Requirements: 13.7
 */
export function logExternalApiCall(service, operation, success, details = {}) {
  const logLevel = success ? "info" : "error";
  
  logger.log(logLevel, "External API call", {
    service, // 'twilio', etc.
    operation, // 'send_sms', 'make_call', etc.
    success,
    timestamp: new Date().toISOString(),
    ...maskSensitiveObject(details)
  });
}

/**
 * Masks sensitive values in logs
 * Prevents passwords, tokens, API keys from being logged
 * Requirements: 14.7
 */
export function maskSensitiveData(data) {
  return maskSensitiveObject(data);
}
