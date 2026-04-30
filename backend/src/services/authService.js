import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import * as userRepository from "../repositories/userRepository.js";

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRATION = "24h";

/**
 * AuthService handles user authentication operations
 */
export class AuthService {
  /**
   * Registers a new user
   * @param {string} username - Unique username
   * @param {string} password - Plain text password
   * @param {string} role - User role (admin or viewer)
   * @returns {Promise<Object>} Created user object with id, username, role
   * @throws {Error} If username already exists
   */
  async register(username, password, role) {
    // Check if user already exists
    const existingUser = await userRepository.findUserByUsername(username);
    if (existingUser) {
      const error = new Error("Username already exists");
      error.statusCode = 409;
      throw error;
    }

    // Hash password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user in database
    const user = await userRepository.createUser({
      username,
      passwordHash,
      role,
    });

    // Return user without password hash
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.created_at,
    };
  }

  /**
   * Authenticates a user and returns a JWT token
   * @param {string} username - Username
   * @param {string} password - Plain text password
   * @returns {Promise<Object>} Object with token, expiresAt, and user info
   * @throws {Error} If credentials are invalid
   */
  async login(username, password) {
    // Find user by username
    const user = await userRepository.findUserByUsername(username);
    if (!user) {
      const error = new Error("Invalid credentials");
      error.statusCode = 401;
      throw error;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      const error = new Error("Invalid credentials");
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT token
    const token = this.generateToken(user.id, user.username, user.role);

    // Calculate expiration time (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  /**
   * Generates a JWT token for a user
   * @param {number} userId - User ID
   * @param {string} username - Username
   * @param {string} role - User role
   * @returns {string} JWT token
   */
  generateToken(userId, username, role) {
    const payload = {
      userId,
      username,
      role,
    };

    // Sign token with RS256 algorithm (or HS256 if RS256 keys not available)
    // Note: For production, RS256 with public/private key pair is recommended
    // For now, using HS256 with JWT_SECRET
    const token = jwt.sign(payload, config.jwtSecret, {
      algorithm: "HS256",
      expiresIn: TOKEN_EXPIRATION,
    });

    return token;
  }

  /**
   * Verifies a JWT token and returns the decoded payload
   * @param {string} token - JWT token to verify
   * @returns {Promise<Object>} Decoded token payload with userId, username, role
   * @throws {Error} If token is invalid or expired
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        algorithms: ["HS256"],
      });

      return {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
      };
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        const err = new Error("Token has expired");
        err.statusCode = 401;
        throw err;
      } else if (error.name === "JsonWebTokenError") {
        const err = new Error("Invalid token");
        err.statusCode = 401;
        throw err;
      }
      throw error;
    }
  }
}

// Export a singleton instance
export const authService = new AuthService();
