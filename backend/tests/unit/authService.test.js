import { jest } from "@jest/globals";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthService } from "../../src/services/authService.js";

describe("AuthService", () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe("generateToken", () => {
    it("should generate valid JWT token with correct payload", () => {
      const token = authService.generateToken(1, "testuser", "viewer");

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      // Decode token to verify payload
      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe(1);
      expect(decoded.username).toBe("testuser");
      expect(decoded.role).toBe("viewer");
      expect(decoded.exp).toBeDefined();
    });
  });

  describe("verifyToken", () => {
    it("should verify valid token and return payload", async () => {
      const token = authService.generateToken(1, "testuser", "viewer");

      const result = await authService.verifyToken(token);

      expect(result).toEqual({
        userId: 1,
        username: "testuser",
        role: "viewer",
      });
    });

    it("should throw error for invalid token", async () => {
      await expect(
        authService.verifyToken("invalid-token")
      ).rejects.toThrow("Invalid token");
    });

    it("should throw error for expired token", async () => {
      // Create a token that expires immediately
      const expiredToken = jwt.sign(
        { userId: 1, username: "testuser", role: "viewer" },
        process.env.JWT_SECRET,
        { expiresIn: "0s" }
      );

      // Wait a moment to ensure token is expired
      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(
        authService.verifyToken(expiredToken)
      ).rejects.toThrow("Token has expired");
    });
  });

  describe("password hashing", () => {
    it("should produce different hashes for same password", async () => {
      const password = "password123";
      const hash1 = await bcrypt.hash(password, 12);
      const hash2 = await bcrypt.hash(password, 12);

      expect(hash1).not.toBe(hash2);
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });
  });
});
