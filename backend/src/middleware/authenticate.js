import { authService } from "../services/authService.js";

/**
 * Authentication middleware that verifies JWT tokens
 * Extracts token from Authorization header, verifies it, and attaches user info to req.user
 * 
 * Requirements: 1.4, 1.5
 */
export async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: "Unauthorized",
        detail: "Missing Authorization header"
      });
    }
    
    // Check if header follows "Bearer <token>" format
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        error: "Unauthorized",
        detail: "Invalid Authorization header format. Expected: Bearer <token>"
      });
    }
    
    const token = parts[1];
    
    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        detail: "Missing token"
      });
    }
    
    // Verify token signature and expiration
    const decoded = await authService.verifyToken(token);
    
    // Attach user info to request object
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    // Handle token verification errors
    if (error.statusCode === 401) {
      return res.status(401).json({
        error: "Unauthorized",
        detail: error.message
      });
    }
    
    // Handle unexpected errors
    return res.status(401).json({
      error: "Unauthorized",
      detail: "Invalid or expired token"
    });
  }
}
