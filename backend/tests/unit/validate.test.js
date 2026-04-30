import { jest } from "@jest/globals";
import Joi from "joi";
import { validate } from "../../src/middleware/validate.js";

describe("validate middleware", () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });
  
  describe("Valid request body", () => {
    it("should call next() when request body is valid", () => {
      const schema = Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
      });
      
      req.body = {
        username: "testuser",
        password: "password123"
      };
      
      const middleware = validate(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it("should strip unknown fields from request body", () => {
      const schema = Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
      });
      
      req.body = {
        username: "testuser",
        password: "password123",
        extraField: "should be removed"
      };
      
      const middleware = validate(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.body).toEqual({
        username: "testuser",
        password: "password123"
      });
      expect(req.body.extraField).toBeUndefined();
    });
  });
  
  describe("Invalid request body", () => {
    it("should return 400 when required field is missing", () => {
      const schema = Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
      });
      
      req.body = {
        username: "testuser"
        // password is missing
      };
      
      const middleware = validate(schema);
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Bad Request",
        detail: "Request validation failed",
        fields: expect.objectContaining({
          password: expect.stringContaining("required")
        })
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    it("should return 400 with multiple field errors", () => {
      const schema = Joi.object({
        username: Joi.string().required(),
        password: Joi.string().min(8).required(),
        email: Joi.string().email().required()
      });
      
      req.body = {
        password: "short",
        email: "invalid-email"
      };
      
      const middleware = validate(schema);
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Bad Request",
        detail: "Request validation failed",
        fields: expect.objectContaining({
          username: expect.any(String),
          password: expect.any(String),
          email: expect.any(String)
        })
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    it("should return 400 when field type is invalid", () => {
      const schema = Joi.object({
        age: Joi.number().required()
      });
      
      req.body = {
        age: "not a number"
      };
      
      const middleware = validate(schema);
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Bad Request",
        detail: "Request validation failed",
        fields: expect.objectContaining({
          age: expect.stringContaining("number")
        })
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe("Nested object validation", () => {
    it("should validate nested objects", () => {
      const schema = Joi.object({
        user: Joi.object({
          name: Joi.string().required(),
          age: Joi.number().required()
        }).required()
      });
      
      req.body = {
        user: {
          name: "John",
          age: 30
        }
      };
      
      const middleware = validate(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it("should return field-specific errors for nested objects", () => {
      const schema = Joi.object({
        user: Joi.object({
          name: Joi.string().required(),
          age: Joi.number().required()
        }).required()
      });
      
      req.body = {
        user: {
          name: "John"
          // age is missing
        }
      };
      
      const middleware = validate(schema);
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Bad Request",
        detail: "Request validation failed",
        fields: expect.objectContaining({
          "user.age": expect.stringContaining("required")
        })
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe("Optional fields", () => {
    it("should allow optional fields to be missing", () => {
      const schema = Joi.object({
        username: Joi.string().required(),
        nickname: Joi.string().optional()
      });
      
      req.body = {
        username: "testuser"
        // nickname is optional and missing
      };
      
      const middleware = validate(schema);
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
