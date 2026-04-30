import cors from "cors";
import express from "express";
import { config } from "./config.js";
import authRoutes from "./routes/authRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";
import screeningRoutes from "./routes/screeningRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import { generalLimiter, authLimiter, securityHeaders, corsMiddleware } from "./middleware/index.js";

const app = express();

// Apply security headers to all responses
app.use(securityHeaders);

// Apply CORS middleware with environment-based origin validation
app.use(corsMiddleware);
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "Silent Stroke Detector API",
    version: "1.0.0",
  });
});

// Health check endpoints are excluded from rate limiting
app.use("/health", healthRoutes);

// Apply auth rate limiter to authentication endpoints (10 requests per 15 minutes)
app.use("/api/auth", authLimiter, authRoutes);

// Apply general rate limiter to all other API routes (100 requests per 15 minutes)
app.use("/api/hospitals", generalLimiter, hospitalRoutes);
app.use("/api/screenings", generalLimiter, screeningRoutes);
app.use("/api/analytics", generalLimiter, analyticsRoutes);
app.use("/api/audit", generalLimiter, auditRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: "Internal server error",
    detail: error.message,
  });
});

app.listen(config.port, () => {
  console.log(`Silent Stroke Detector backend listening on port ${config.port}`);
});
