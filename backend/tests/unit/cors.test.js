/**
 * Unit tests for CORS middleware
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

// Mock config before importing corsMiddleware
const mockConfig = {
  nodeEnv: "development",
  corsOrigins: "*",
};

jest.unstable_mockModule("../../src/config.js", () => ({
  config: mockConfig,
}));

const { corsMiddleware } = await import("../../src/middleware/cors.js");

describe("CORS Middleware", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(corsMiddleware);
    app.get("/test", (req, res) => {
      res.json({ message: "success" });
    });
  });

  describe("Development Environment", () => {
    beforeEach(() => {
      mockConfig.nodeEnv = "development";
      mockConfig.corsOrigins = "*";
    });

    test("should allow all origins in development", async () => {
      const response = await request(app)
        .get("/test")
        .set("Origin", "http://localhost:3000");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000"
      );
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });

    test("should allow requests with no origin in development", async () => {
      const response = await request(app).get("/test");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "success" });
    });

    test("should allow any origin in development", async () => {
      const response = await request(app)
        .get("/test")
        .set("Origin", "https://random-domain.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://random-domain.com"
      );
    });
  });

  describe("Production Environment", () => {
    beforeEach(() => {
      mockConfig.nodeEnv = "production";
    });

    test("should allow whitelisted origins in production", async () => {
      mockConfig.corsOrigins = "https://app.example.com,https://admin.example.com";

      const response = await request(app)
        .get("/test")
        .set("Origin", "https://app.example.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://app.example.com"
      );
    });

    test("should reject non-whitelisted origins in production", async () => {
      mockConfig.corsOrigins = "https://app.example.com";

      const response = await request(app)
        .get("/test")
        .set("Origin", "https://malicious.com");

      // CORS errors are handled by the cors library and result in no CORS headers
      // The request fails at the browser level, not at the server level
      // In our test environment, the server returns an error
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("should allow requests with no origin in production", async () => {
      mockConfig.corsOrigins = "https://app.example.com";

      const response = await request(app).get("/test");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "success" });
    });

    test("should handle multiple whitelisted origins", async () => {
      mockConfig.corsOrigins = "https://app.example.com,https://admin.example.com,https://mobile.example.com";

      const response = await request(app)
        .get("/test")
        .set("Origin", "https://mobile.example.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://mobile.example.com"
      );
    });

    test("should handle wildcard in production", async () => {
      mockConfig.corsOrigins = "*";

      const response = await request(app)
        .get("/test")
        .set("Origin", "https://any-domain.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://any-domain.com"
      );
    });

    test("should trim whitespace from origin list", async () => {
      mockConfig.corsOrigins = " https://app.example.com , https://admin.example.com ";

      const response = await request(app)
        .get("/test")
        .set("Origin", "https://admin.example.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://admin.example.com"
      );
    });
  });

  describe("Credentials Support", () => {
    test("should enable credentials support", async () => {
      mockConfig.nodeEnv = "production";
      mockConfig.corsOrigins = "https://app.example.com";

      const response = await request(app)
        .get("/test")
        .set("Origin", "https://app.example.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });
  });

  describe("Preflight Requests", () => {
    beforeEach(() => {
      mockConfig.nodeEnv = "production";
      mockConfig.corsOrigins = "https://app.example.com";
    });

    test("should handle OPTIONS preflight requests", async () => {
      const response = await request(app)
        .options("/test")
        .set("Origin", "https://app.example.com")
        .set("Access-Control-Request-Method", "POST");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-methods"]).toContain("POST");
    });

    test("should set allowed headers for preflight", async () => {
      const response = await request(app)
        .options("/test")
        .set("Origin", "https://app.example.com")
        .set("Access-Control-Request-Headers", "Content-Type,Authorization");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-headers"]).toContain(
        "Content-Type"
      );
      expect(response.headers["access-control-allow-headers"]).toContain(
        "Authorization"
      );
    });
  });
});
