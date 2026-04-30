import { jest } from "@jest/globals";
import { errorHandler, notFoundHandler } from "../../src/middleware/errorHandler.js";

// Mock console.error to avoid cluttering test output
console.error = jest.fn();

describe("errorHandler middleware", () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {
      method: "GET",
      path: "/api/test",
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });
  
  describe("Generic errors", () => {
    it("should return 500 for generic errors", () => {
      const error = new Error("Something went wrong");
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Internal Server Error",
        detail: "An unexpected error occurred"
      });
      expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", expect.any(String));
    });
  });
  
  describe("Custom status code errors", () => {
    it("should return 401 for unauthorized errors", () => {
      const error = new Error("Invalid token");
      error.statusCode = 401;
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        detail: "Invalid token"
      });
    });
    
    it("should return 403 for forbidden errors", () => {
      const error = new Error("Access denied");
      error.statusCode = 403;
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden",
        detail: "Access denied"
      });
    });
    
    it("should return 404 for not found errors", () => {
      const error = new Error("Resource not found");
      error.statusCode = 404;
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Not Found",
        detail: "Resource not found"
      });
    });
    
    it("should return 409 for conflict errors", () => {
      const error = new Error("Username already exists");
      error.statusCode = 409;
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: "Conflict",
        detail: "Username already exists"
      });
    });
    
    it("should return 400 for bad request errors", () => {
      const error = new Error("Invalid input");
      error.statusCode = 400;
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Bad Request",
        detail: "Invalid input"
      });
    });
  });
  
  describe("Database errors", () => {
    it("should return 409 for unique constraint violations (23505)", () => {
      const error = new Error("duplicate key value violates unique constraint");
      error.code = "23505";
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: "Conflict",
        detail: "Resource already exists"
      });
    });
    
    it("should return 400 for foreign key violations (23503)", () => {
      const error = new Error("foreign key constraint violation");
      error.code = "23503";
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Bad Request",
        detail: "Invalid reference to related resource"
      });
    });
    
    it("should return 400 for not null violations (23502)", () => {
      const error = new Error("null value in column violates not-null constraint");
      error.code = "23502";
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Bad Request",
        detail: "Missing required field"
      });
    });
    
    it("should return 400 for other constraint violations", () => {
      const error = new Error("check constraint violation");
      error.code = "23514";
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Bad Request",
        detail: "Database constraint violation"
      });
    });
    
    it("should return 503 for database connection errors", () => {
      const error = new Error("Connection refused");
      error.code = "ECONNREFUSED";
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: "Service Unavailable",
        detail: "Database connection failed"
      });
    });
  });
  
  describe("JWT errors", () => {
    it("should return 401 for JsonWebTokenError", () => {
      const error = new Error("jwt malformed");
      error.name = "JsonWebTokenError";
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        detail: "Invalid token"
      });
    });
    
    it("should return 401 for TokenExpiredError", () => {
      const error = new Error("jwt expired");
      error.name = "TokenExpiredError";
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        detail: "Token has expired"
      });
    });
  });
  
  describe("Validation errors", () => {
    it("should return 400 for ValidationError", () => {
      const error = new Error("Validation failed");
      error.name = "ValidationError";
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Bad Request",
        detail: "Validation failed"
      });
    });
  });
  
  describe("Not found errors", () => {
    it("should return 404 when error message contains 'not found'", () => {
      const error = new Error("User not found");
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Not Found",
        detail: "User not found"
      });
    });
  });
  
  describe("Logging", () => {
    it("should log error with request details", () => {
      const error = new Error("Test error");
      req.user = { userId: 1 };
      req.id = "test-request-id";
      
      errorHandler(error, req, res, next);
      
      expect(console.error).toHaveBeenCalledWith(
        "Error occurred:",
        expect.stringContaining("test-request-id")
      );
    });
    
    it("should mask sensitive data in logs", () => {
      const error = new Error("Test error");
      req.body = {
        username: "testuser",
        password: "secret123"
      };
      
      errorHandler(error, req, res, next);
      
      expect(console.error).toHaveBeenCalled();
      const loggedData = console.error.mock.calls[0][1];
      expect(loggedData).toContain("***MASKED***");
    });
  });
  
  describe("Request ID", () => {
    it("should use existing request ID if present", () => {
      const error = new Error("Test error");
      req.id = "existing-request-id";
      
      errorHandler(error, req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", "existing-request-id");
    });
    
    it("should generate request ID if not present", () => {
      const error = new Error("Test error");
      
      errorHandler(error, req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", expect.stringMatching(/^req_/));
    });
  });
});

describe("notFoundHandler middleware", () => {
  let req, res;
  
  beforeEach(() => {
    req = {
      method: "GET",
      path: "/api/nonexistent"
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });
  
  it("should return 404 with route information", () => {
    notFoundHandler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Not Found",
      detail: "Route GET /api/nonexistent not found"
    });
  });
});
