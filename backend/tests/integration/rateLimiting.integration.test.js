import request from "supertest";
import express from "express";
import { generalLimiter, authLimiter } from "../../src/middleware/index.js";

// Create a simple test app without database dependencies
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Health check endpoint (no rate limiting)
  app.get("/health/live", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Auth endpoints with auth rate limiter (10 requests per 15 minutes)
  app.post("/api/auth/login", authLimiter, (_req, res) => {
    res.status(200).json({ message: "Login endpoint" });
  });

  app.post("/api/auth/register", authLimiter, (_req, res) => {
    res.status(201).json({ message: "Register endpoint" });
  });

  // General API endpoints with general rate limiter (100 requests per 15 minutes)
  app.get("/api/screenings", generalLimiter, (_req, res) => {
    res.status(200).json({ items: [] });
  });

  app.get("/api/hospitals", generalLimiter, (_req, res) => {
    res.status(200).json({ items: [] });
  });

  // Error handler
  app.use((error, _req, res, _next) => {
    res.status(500).json({
      error: "Internal server error",
      detail: error.message,
    });
  });

  return app;
};

describe("Rate Limiting Integration Tests", () => {
  let app;

  beforeEach(() => {
    // Create a fresh app instance for each test to reset rate limiters
    app = createTestApp();
  });

  describe("Auth Rate Limiter (10 requests per 15 minutes)", () => {
    it("should allow requests within the limit", async () => {
      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post("/api/auth/login")
          .send({
            username: "testuser",
            password: "password123",
          });

        // Should not be rate limited
        expect(response.status).toBe(200);
        expect(response.status).not.toBe(429);
      }
    });

    it("should return 429 Too Many Requests when auth limit is exceeded", async () => {
      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        await request(app).post("/api/auth/login").send({
          username: "testuser",
          password: "password123",
        });
      }

      // The 11th request should be rate limited
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "testuser",
          password: "password123",
        })
        .expect(429);

      expect(response.body.error).toBe("Too Many Requests");
      expect(response.body.detail).toBe(
        "Too many authentication attempts, please try again later"
      );
    });

    it("should include rate limit headers in response", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "testuser",
          password: "password123",
        });

      // Check for standard rate limit headers
      expect(response.headers).toHaveProperty("ratelimit-limit");
      expect(response.headers["ratelimit-limit"]).toBe("10");
      expect(response.headers).toHaveProperty("ratelimit-remaining");
      expect(response.headers).toHaveProperty("ratelimit-reset");
    });

    it("should apply rate limit to register endpoint", async () => {
      // Make 10 requests to register endpoint
      for (let i = 0; i < 10; i++) {
        await request(app).post("/api/auth/register").send({
          username: `user${i}`,
          password: "password123",
          role: "viewer",
        });
      }

      // The 11th request should be rate limited
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "user11",
          password: "password123",
          role: "viewer",
        })
        .expect(429);

      expect(response.body.error).toBe("Too Many Requests");
    });

    it("should share rate limit across auth endpoints", async () => {
      // Make 5 login requests
      for (let i = 0; i < 5; i++) {
        await request(app).post("/api/auth/login").send({
          username: "testuser",
          password: "password123",
        });
      }

      // Make 5 register requests
      for (let i = 0; i < 5; i++) {
        await request(app).post("/api/auth/register").send({
          username: `user${i}`,
          password: "password123",
          role: "viewer",
        });
      }

      // The 11th request (either endpoint) should be rate limited
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "testuser",
          password: "password123",
        })
        .expect(429);

      expect(response.body.error).toBe("Too Many Requests");
    });
  });

  describe("General Rate Limiter (100 requests per 15 minutes)", () => {
    it("should allow requests within the limit", async () => {
      // Make 50 requests (well within the limit of 100)
      for (let i = 0; i < 50; i++) {
        const response = await request(app).get("/api/screenings");

        // Should not be rate limited
        expect(response.status).toBe(200);
        expect(response.status).not.toBe(429);
      }
    });

    it("should return 429 Too Many Requests when general limit is exceeded", async () => {
      // Make 100 requests (the limit)
      for (let i = 0; i < 100; i++) {
        await request(app).get("/api/screenings");
      }

      // The 101st request should be rate limited
      const response = await request(app)
        .get("/api/screenings")
        .expect(429);

      expect(response.body.error).toBe("Too Many Requests");
      expect(response.body.detail).toBe(
        "Too many requests from this IP, please try again later"
      );
    });

    it("should include rate limit headers in response", async () => {
      const response = await request(app).get("/api/screenings");

      // Check for standard rate limit headers
      expect(response.headers).toHaveProperty("ratelimit-limit");
      expect(response.headers["ratelimit-limit"]).toBe("100");
      expect(response.headers).toHaveProperty("ratelimit-remaining");
      expect(response.headers).toHaveProperty("ratelimit-reset");
    });

    it("should share rate limit across general API endpoints", async () => {
      // Make 50 requests to screenings endpoint
      for (let i = 0; i < 50; i++) {
        await request(app).get("/api/screenings");
      }

      // Make 50 requests to hospitals endpoint
      for (let i = 0; i < 50; i++) {
        await request(app).get("/api/hospitals");
      }

      // The 101st request (either endpoint) should be rate limited
      const response = await request(app)
        .get("/api/screenings")
        .expect(429);

      expect(response.body.error).toBe("Too Many Requests");
    });
  });

  describe("Health Check Endpoints (No Rate Limiting)", () => {
    it("should not apply rate limiting to health check endpoints", async () => {
      // Make 150 requests (exceeding both rate limits)
      for (let i = 0; i < 150; i++) {
        const response = await request(app).get("/health/live");

        // Should never be rate limited
        expect(response.status).toBe(200);
        expect(response.status).not.toBe(429);
      }
    });

    it("should not include rate limit headers for health endpoints", async () => {
      const response = await request(app).get("/health/live");

      // Health endpoints should not have rate limit headers
      expect(response.headers).not.toHaveProperty("ratelimit-limit");
      expect(response.headers).not.toHaveProperty("ratelimit-remaining");
    });
  });

  describe("Rate Limit Response Format", () => {
    it("should return consistent error format when rate limited", async () => {
      // Exceed auth rate limit
      for (let i = 0; i < 10; i++) {
        await request(app).post("/api/auth/login").send({
          username: "testuser",
          password: "password123",
        });
      }

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "testuser",
          password: "password123",
        })
        .expect(429);

      // Verify error format matches the application's error structure
      expect(response.body).toHaveProperty("error");
      expect(response.body).toHaveProperty("detail");
      expect(response.body.error).toBe("Too Many Requests");
      expect(typeof response.body.detail).toBe("string");
    });
  });
});
