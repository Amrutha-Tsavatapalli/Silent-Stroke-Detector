import { jest } from "@jest/globals";
import { authorize } from "../../src/middleware/authorize.js";

describe("authorize middleware", () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });
  
  describe("User not authenticated", () => {
    it("should return 401 when req.user is not set", () => {
      const middleware = authorize("admin");
      
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        detail: "Authentication required"
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe("Single role authorization", () => {
    it("should call next() when user has the required role", () => {
      req.user = {
        userId: 1,
        username: "admin",
        role: "admin"
      };
      
      const middleware = authorize("admin");
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it("should return 403 when user does not have the required role", () => {
      req.user = {
        userId: 2,
        username: "viewer",
        role: "viewer"
      };
      
      const middleware = authorize("admin");
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden",
        detail: "Access denied. Required role: admin"
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe("Multiple roles authorization", () => {
    it("should call next() when user has one of the allowed roles (admin)", () => {
      req.user = {
        userId: 1,
        username: "admin",
        role: "admin"
      };
      
      const middleware = authorize("admin", "viewer");
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it("should call next() when user has one of the allowed roles (viewer)", () => {
      req.user = {
        userId: 2,
        username: "viewer",
        role: "viewer"
      };
      
      const middleware = authorize("admin", "viewer");
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it("should return 403 when user does not have any of the allowed roles", () => {
      req.user = {
        userId: 3,
        username: "guest",
        role: "guest"
      };
      
      const middleware = authorize("admin", "viewer");
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden",
        detail: "Access denied. Required role: admin or viewer"
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe("Edge cases", () => {
    it("should handle empty role list", () => {
      req.user = {
        userId: 1,
        username: "admin",
        role: "admin"
      };
      
      const middleware = authorize();
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
