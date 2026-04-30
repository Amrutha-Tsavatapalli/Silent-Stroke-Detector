import rateLimit from "express-rate-limit";

/**
 * General rate limiter for all API routes
 * Limits: 100 requests per 15-minute window per IP
 * Requirements: 11.1
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: "Too Many Requests",
    detail: "Too many requests from this IP, please try again later",
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  statusCode: 429, // Return 429 Too Many Requests
});

/**
 * Stricter rate limiter for authentication endpoints
 * Limits: 10 requests per 15-minute window per IP
 * Requirements: 11.2
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    error: "Too Many Requests",
    detail: "Too many authentication attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
});
