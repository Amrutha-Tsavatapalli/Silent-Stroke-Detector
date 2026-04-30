import { pool } from "../../src/db.js";
import { authService } from "../../src/services/authService.js";
import * as userRepository from "../../src/repositories/userRepository.js";

describe("Authentication Integration Tests", () => {
  // Clean up database before each test
  beforeEach(async () => {
    await pool.query("DELETE FROM users");
  });

  // Close database connection after all tests
  afterAll(async () => {
    await pool.end();
  });

  describe("User Registration", () => {
    it("should register a new user with hashed password", async () => {
      const result = await authService.register("testuser", "password123", "viewer");

      expect(result).toHaveProperty("id");
      expect(result.username).toBe("testuser");
      expect(result.role).toBe("viewer");
      expect(result).toHaveProperty("createdAt");
      expect(result).not.toHaveProperty("password");
      expect(result).not.toHaveProperty("passwordHash");

      // Verify user was created in database
      const user = await userRepository.findUserByUsername("testuser");
      expect(user).toBeDefined();
      expect(user.username).toBe("testuser");
      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe("password123");
    });

    it("should throw error when registering duplicate username", async () => {
      await authService.register("testuser", "password123", "viewer");

      await expect(
        authService.register("testuser", "differentpassword", "admin")
      ).rejects.toThrow("Username already exists");
    });

    it("should create admin user", async () => {
      const result = await authService.register("adminuser", "adminpass", "admin");

      expect(result.role).toBe("admin");

      const user = await userRepository.findUserByUsername("adminuser");
      expect(user.role).toBe("admin");
    });
  });

  describe("User Login", () => {
    beforeEach(async () => {
      // Create a test user before each login test
      await authService.register("testuser", "password123", "viewer");
    });

    it("should login with valid credentials and return token", async () => {
      const result = await authService.login("testuser", "password123");

      expect(result).toHaveProperty("token");
      expect(result).toHaveProperty("expiresAt");
      expect(result.user).toEqual({
        id: expect.any(Number),
        username: "testuser",
        role: "viewer",
      });

      // Verify token is valid
      const decoded = await authService.verifyToken(result.token);
      expect(decoded.username).toBe("testuser");
      expect(decoded.role).toBe("viewer");
    });

    it("should throw error for non-existent username", async () => {
      await expect(
        authService.login("nonexistent", "password123")
      ).rejects.toThrow("Invalid credentials");
    });

    it("should throw error for incorrect password", async () => {
      await expect(
        authService.login("testuser", "wrongpassword")
      ).rejects.toThrow("Invalid credentials");
    });

    it("should not reveal whether username or password was incorrect", async () => {
      let error1;
      let error2;

      try {
        await authService.login("nonexistent", "password123");
      } catch (e) {
        error1 = e.message;
      }

      try {
        await authService.login("testuser", "wrongpassword");
      } catch (e) {
        error2 = e.message;
      }

      // Both errors should have the same message
      expect(error1).toBe("Invalid credentials");
      expect(error2).toBe("Invalid credentials");
    });
  });

  describe("User Repository", () => {
    it("should create user with parameterized query", async () => {
      const user = await userRepository.createUser({
        username: "repotest",
        passwordHash: "hashedpassword",
        role: "viewer",
      });

      expect(user).toHaveProperty("id");
      expect(user.username).toBe("repotest");
      expect(user.role).toBe("viewer");
      expect(user).toHaveProperty("created_at");
      expect(user).toHaveProperty("updated_at");
    });

    it("should find user by username", async () => {
      await userRepository.createUser({
        username: "findme",
        passwordHash: "hashedpassword",
        role: "admin",
      });

      const user = await userRepository.findUserByUsername("findme");

      expect(user).toBeDefined();
      expect(user.username).toBe("findme");
      expect(user.role).toBe("admin");
      expect(user.password_hash).toBe("hashedpassword");
    });

    it("should return null for non-existent username", async () => {
      const user = await userRepository.findUserByUsername("nonexistent");
      expect(user).toBeNull();
    });

    it("should find user by ID", async () => {
      const created = await userRepository.createUser({
        username: "findbyid",
        passwordHash: "hashedpassword",
        role: "viewer",
      });

      const user = await userRepository.findUserById(created.id);

      expect(user).toBeDefined();
      expect(user.id).toBe(created.id);
      expect(user.username).toBe("findbyid");
      expect(user.role).toBe("viewer");
      // findUserById should not return password_hash
      expect(user).not.toHaveProperty("password_hash");
    });

    it("should return null for non-existent user ID", async () => {
      const user = await userRepository.findUserById(99999);
      expect(user).toBeNull();
    });
  });

  describe("Token Verification", () => {
    it("should verify valid token", async () => {
      await authService.register("tokentest", "password123", "admin");
      const loginResult = await authService.login("tokentest", "password123");

      const decoded = await authService.verifyToken(loginResult.token);

      expect(decoded.username).toBe("tokentest");
      expect(decoded.role).toBe("admin");
      expect(decoded).toHaveProperty("userId");
    });

    it("should reject invalid token", async () => {
      await expect(
        authService.verifyToken("invalid.token.here")
      ).rejects.toThrow("Invalid token");
    });
  });

  describe("Password Security", () => {
    it("should hash passwords with bcrypt (12 rounds)", async () => {
      await authService.register("secureuser", "mypassword", "viewer");

      const user = await userRepository.findUserByUsername("secureuser");

      // Bcrypt hashes start with $2b$ (or $2a$) and include the cost factor
      expect(user.password_hash).toMatch(/^\$2[ab]\$12\$/);
    });

    it("should create different hashes for same password", async () => {
      await authService.register("user1", "samepassword", "viewer");
      await authService.register("user2", "samepassword", "viewer");

      const user1 = await userRepository.findUserByUsername("user1");
      const user2 = await userRepository.findUserByUsername("user2");

      expect(user1.password_hash).not.toBe(user2.password_hash);
    });
  });
});
