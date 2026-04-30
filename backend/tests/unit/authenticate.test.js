import { jest } from "@jest/globals";
import { authenticate } from "../../src/middleware/authenticate.js";
import { authService } from "../../src/services/authService.js";

// Mock authService.verifyToken
const mockVerifyToken = jest.fn();
authService.verifyToken = mockVerifyToken;

describe("authenticate middleware", () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });
  
  describe("Missing Authorization header", () => {
    it("should return 401 when Authorization header is missing", async () => {
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        detail: "Missing Authorization header"
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe("Invalid Authorization header format", () => {
    it("should return 401 when Authorization header doesn't start with Bearer", async () => {
      req.headers.authorization = "Basic abc123";
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        detail: "Invalid Authorization header format. Expected: Bearer <token>"
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    it("should return 401 when Authorization header has wrong format", async () => {
      req.headers.authorization = "BearerToken";
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        detail: "Invalid Authorization header format. Expected: Bearer <token>"
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    it("should return 401 when token is empty", async () => {
      req.headers.authorization = "Bearer ";
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        detail: "Missing token"
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe("Valid token", () => {
    it("should attach user info to req.user and call next() for valid token", async () => {
      const mockDecoded = {
        userId: 1,
        username: "testuser",
        role: "admin"
      };
      
      mockVerifyToken.mockResolvedValue(mockDecoded);
      req.headers.authorization = "Bearer validtoken123";
      
      await authenticate(req, res, next);
      
      expect(mockVerifyToken).toHaveBeenCalledWith("validtoken123");
      expect(req.user).toEqual({
        userId: 1,
        username: "testuser",
        role: "admin"
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
  
  describe("Invalid or expired token", () => {
    it("should return 401 when token is expired", async () => {
      const error = new Error("Token has expired");
      error.statusCode = 401;
      
      mockVerifyToken.mockRejectedValue(error);
      req.headers.authorization = "Bearer expiredtoken";
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        detail: "Token has expired"
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    it("should return 401 when token is invalid", async () => {
      const error = new Error("Invalid token");
      error.statusCode = 401;
      
      mockVerifyToken.mockRejectedValue(error);
      req.headers.authorization = "Bearer invalidtoken";
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        detail: "Invalid token"
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    it("should return 401 for unexpected errors", async () => {
      const error = new Error("Unexpected error");
      
      mockVerifyToken.mockRejectedValue(error);
      req.headers.authorization = "Bearer sometoken";
      
      await authenticate(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        detail: "Invalid or expired token"
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
