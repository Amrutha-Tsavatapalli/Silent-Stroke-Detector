/**
 * Integration tests for CORS middleware
 */

import request from "supertest";
import express from "express";
import { jest } from "@jest/globals";

describe("CORS Integration Tests", () => {
  let app;
  let originalEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  beforeEach(async () => {
    // Clear module cache to reload with new config
    jest.resetModules();
  });

  describe("Development Environment", () => {
    beforeEach(async () => {
      process.env.NODE_ENV = "development";
      process.env.CORS_ORIGINS = "*";
      process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
      process.env.JWT_SECRET = "test-secret-key-minimum-32-characters-long";

      // Dynamically import to get fresh config
      const { corsMiddleware } = await import("../../src/middleware/cors.js");

      app = express();
      app.use(corsMiddleware);
      app.get("/test", (req, res) => {
        res.json({ message: "success" });
      });
    });

    test("should allow requests from any origin in development", async () => {
      const response = await request(app)
        .get("/test")
        .set("Origin", "http://localhost:3000");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000"
      );
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });

    test("should allow requests from different origin in development", async () => {
      const response = await request(app)
        .get("/test")
        .set("Origin", "https://random-domain.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://random-domain.com"
      );
    });

    test("should handle preflight OPTIONS requests in development", async () => {
      const response = await request(app)
        .options("/test")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-methods"]).toContain("POST");
    });
  });

  describe("Production Environment with Whitelisted Origins", () => {
    beforeEach(async () => {
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGINS = "https://app.example.com,https://admin.example.com";
      process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
      process.env.JWT_SECRET = "test-secret-key-minimum-32-characters-long";

      // Dynamically import to get fresh config
      const { corsMiddleware } = await import("../../src/middleware/cors.js");

      app = express();
      app.use(corsMiddleware);
      app.get("/test", (req, res) => {
        res.json({ message: "success" });
      });
    });

    test("should allow whitelisted origin in production", async () => {
      const response = await request(app)
        .get("/test")
        .set("Origin", "https://app.example.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://app.example.com"
      );
    });

    test("should allow second whitelisted origin in production", async () => {
      const response = await request(app)
        .get("/test")
        .set("Origin", "https://admin.example.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://admin.example.com"
      );
    });

    test("should reject non-whitelisted origin in production", async () => {
      const response = await request(app)
        .get("/test")
        .set("Origin", "https://malicious.com");

      // CORS errors are handled by the cors library
      // The request fails and returns an error status
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("should allow requests with no origin in production", async () => {
      const response = await request(app).get("/test");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "success" });
    });
  });

  describe("Production Environment with Wildcard", () => {
    beforeEach(async () => {
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGINS = "*";
      process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
      process.env.JWT_SECRET = "test-secret-key-minimum-32-characters-long";

      // Dynamically import to get fresh config
      const { corsMiddleware } = await import("../../src/middleware/cors.js");

      app = express();
      app.use(corsMiddleware);
      app.get("/test", (req, res) => {
        res.json({ message: "success" });
      });
    });

    test("should allow any origin when wildcard is set in production", async () => {
      const response = await request(app)
        .get("/test")
        .set("Origin", "https://any-domain.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://any-domain.com"
      );
    });
  });

  describe("Credentials Support", () => {
    beforeEach(async () => {
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGINS = "https://app.example.com";
      process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
      process.env.JWT_SECRET = "test-secret-key-minimum-32-characters-long";

      // Dynamically import to get fresh config
      const { corsMiddleware } = await import("../../src/middleware/cors.js");

      app = express();
      app.use(corsMiddleware);
      app.get("/test", (req, res) => {
        res.json({ message: "success" });
      });
    });

    test("should include credentials header", async () => {
      const response = await request(app)
        .get("/test")
        .set("Origin", "https://app.example.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });

    test("should allow Authorization header", async () => {
      const response = await request(app)
        .options("/test")
        .set("Origin", "https://app.example.com")
        .set("Access-Control-Request-Method", "GET")
        .set("Access-Control-Request-Headers", "Authorization");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-headers"]).toContain(
        "Authorization"
      );
    });
  });

  describe("Preflight Requests", () => {
    beforeEach(async () => {
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGINS = "https://app.example.com";
      process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
      process.env.JWT_SECRET = "test-secret-key-minimum-32-characters-long";

      // Dynamically import to get fresh config
      const { corsMiddleware } = await import("../../src/middleware/cors.js");

      app = express();
      app.use(corsMiddleware);
      app.post("/test", (req, res) => {
        res.json({ message: "success" });
      });
    });

    test("should handle preflight OPTIONS for POST requests", async () => {
      const response = await request(app)
        .options("/test")
        .set("Origin", "https://app.example.com")
        .set("Access-Control-Request-Method", "POST");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-methods"]).toContain("POST");
    });

    test("should handle preflight OPTIONS for PUT requests", async () => {
      const response = await request(app)
        .options("/test")
        .set("Origin", "https://app.example.com")
        .set("Access-Control-Request-Method", "PUT");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-methods"]).toContain("PUT");
    });

    test("should handle preflight OPTIONS for DELETE requests", async () => {
      const response = await request(app)
        .options("/test")
        .set("Origin", "https://app.example.com")
        .set("Access-Control-Request-Method", "DELETE");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-methods"]).toContain("DELETE");
    });

    test("should set max age for preflight cache", async () => {
      const response = await request(app)
        .options("/test")
        .set("Origin", "https://app.example.com")
        .set("Access-Control-Request-Method", "POST");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-max-age"]).toBe("86400");
    });
  });
});
