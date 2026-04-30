import request from "supertest";
import express from "express";
import { pool } from "../../src/db.js";
import authRoutes from "../../src/routes/authRoutes.js";

// Create a test app
const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);

// Error handler
app.use((error, _req, res, _next) => {
  res.status(500).json({
    error: "Internal server error",
    detail: error.message,
  });
});

describe("Authentication Routes Integration Tests", () => {
  // Clean up database before each test
  beforeEach(async () => {
    await pool.query("DELETE FROM users");
  });

  // Close database connection after all tests
  afterAll(async () => {
    await pool.end();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user with valid data", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "newuser",
          password: "password123",
          role: "viewer",
        })
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.username).toBe("newuser");
      expect(response.body.role).toBe("viewer");
      expect(response.body).toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("password");
      expect(response.body).not.toHaveProperty("passwordHash");
    });

    it("should register an admin user", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "adminuser",
          password: "adminpass123",
          role: "admin",
        })
        .expect(201);

      expect(response.body.role).toBe("admin");
    });

    it("should return 409 Conflict for duplicate username", async () => {
      // Register first user
      await request(app).post("/api/auth/register").send({
        username: "duplicate",
        password: "password123",
        role: "viewer",
      });

      // Try to register with same username
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "duplicate",
          password: "differentpass",
          role: "admin",
        })
        .expect(409);

      expect(response.body.error).toBe("Conflict");
      expect(response.body.detail).toBe("Username already exists");
    });

    it("should return 400 Bad Request for missing username", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          password: "password123",
          role: "viewer",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.fields).toHaveProperty("username");
      expect(response.body.fields.username).toContain("required");
    });

    it("should return 400 Bad Request for missing password", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          role: "viewer",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.fields).toHaveProperty("password");
      expect(response.body.fields.password).toContain("required");
    });

    it("should return 400 Bad Request for missing role", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          password: "password123",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.fields).toHaveProperty("role");
      expect(response.body.fields.role).toContain("required");
    });

    it("should return 400 Bad Request for invalid role", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          password: "password123",
          role: "superuser",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.fields).toHaveProperty("role");
      expect(response.body.fields.role).toContain("admin");
      expect(response.body.fields.role).toContain("viewer");
    });

    it("should return 400 Bad Request for short username", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "ab",
          password: "password123",
          role: "viewer",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.fields).toHaveProperty("username");
      expect(response.body.fields.username).toContain("at least 3 characters");
    });

    it("should return 400 Bad Request for short password", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "testuser",
          password: "short",
          role: "viewer",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.fields).toHaveProperty("password");
      expect(response.body.fields.password).toContain("at least 8 characters");
    });

    it("should return 400 Bad Request for multiple validation errors", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          username: "ab",
          password: "short",
          role: "invalid",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.fields).toHaveProperty("username");
      expect(response.body.fields).toHaveProperty("password");
      expect(response.body.fields).toHaveProperty("role");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Create a test user before each login test
      await request(app).post("/api/auth/register").send({
        username: "loginuser",
        password: "password123",
        role: "viewer",
      });
    });

    it("should login with valid credentials and return JWT token", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "loginuser",
          password: "password123",
        })
        .expect(200);

      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("expiresAt");
      expect(response.body.user).toEqual({
        id: expect.any(Number),
        username: "loginuser",
        role: "viewer",
      });

      // Verify token format (JWT has 3 parts separated by dots)
      expect(response.body.token.split(".")).toHaveLength(3);

      // Verify expiresAt is a valid ISO date string
      expect(new Date(response.body.expiresAt).toString()).not.toBe(
        "Invalid Date"
      );
    });

    it("should return 401 Unauthorized for non-existent username", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "nonexistent",
          password: "password123",
        })
        .expect(401);

      expect(response.body.error).toBe("Unauthorized");
      expect(response.body.detail).toBe("Invalid credentials");
    });

    it("should return 401 Unauthorized for incorrect password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "loginuser",
          password: "wrongpassword",
        })
        .expect(401);

      expect(response.body.error).toBe("Unauthorized");
      expect(response.body.detail).toBe("Invalid credentials");
    });

    it("should not reveal whether username or password was incorrect", async () => {
      // Test with non-existent username
      const response1 = await request(app)
        .post("/api/auth/login")
        .send({
          username: "nonexistent",
          password: "password123",
        })
        .expect(401);

      // Test with incorrect password
      const response2 = await request(app)
        .post("/api/auth/login")
        .send({
          username: "loginuser",
          password: "wrongpassword",
        })
        .expect(401);

      // Both should return the same error message
      expect(response1.body.detail).toBe("Invalid credentials");
      expect(response2.body.detail).toBe("Invalid credentials");
      expect(response1.body.detail).toBe(response2.body.detail);
    });

    it("should return 400 Bad Request for missing username", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          password: "password123",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.fields).toHaveProperty("username");
      expect(response.body.fields.username).toContain("required");
    });

    it("should return 400 Bad Request for missing password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "loginuser",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.fields).toHaveProperty("password");
      expect(response.body.fields.password).toContain("required");
    });

    it("should return 400 Bad Request for empty username", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "",
          password: "password123",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.fields).toHaveProperty("username");
    });

    it("should return 400 Bad Request for empty password", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "loginuser",
          password: "",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.fields).toHaveProperty("password");
    });
  });

  describe("Token Expiration", () => {
    it("should return token with 24-hour expiration", async () => {
      // Register and login
      await request(app).post("/api/auth/register").send({
        username: "expirytest",
        password: "password123",
        role: "viewer",
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          username: "expirytest",
          password: "password123",
        })
        .expect(200);

      const expiresAt = new Date(response.body.expiresAt);
      const now = new Date();

      // Calculate difference in hours
      const hoursDiff = (expiresAt - now) / (1000 * 60 * 60);

      // Should be approximately 24 hours (allow 1 minute tolerance)
      expect(hoursDiff).toBeGreaterThan(23.98);
      expect(hoursDiff).toBeLessThan(24.02);
    });
  });
});
