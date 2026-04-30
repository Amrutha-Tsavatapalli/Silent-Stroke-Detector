import { jest } from "@jest/globals";
import {
  requestIdMiddleware,
  requestLogger,
  logAuthEvent,
  logAuthorizationFailure,
  logDatabaseError,
  logSlowQuery,
  logExternalApiCall,
  logger
} from "../../src/middleware/logger.js";

// Mock logger methods
logger.info = jest.fn();
logger.warn = jest.fn();
logger.error = jest.fn();
logger.log = jest.fn();

describe("requestIdMiddleware", () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {};
    res = {
      setHeader: jest.fn()
    };
    next = jest.fn();
  });
  
  it("should generate and attach request ID", () => {
    requestIdMiddleware(req, res, next);
    
    expect(req.id).toBeDefined();
    expect(req.id).toMatch(/^req_/);
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", req.id);
    expect(next).toHaveBeenCalled();
  });
  
  it("should generate unique request IDs", () => {
    const req1 = {};
    const res1 = { setHeader: jest.fn() };
    const req2 = {};
    const res2 = { setHeader: jest.fn() };
    
    requestIdMiddleware(req1, res1, jest.fn());
    requestIdMiddleware(req2, res2, jest.fn());
    
    expect(req1.id).not.toEqual(req2.id);
  });
});

describe("requestLogger", () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {
      id: "test-request-id",
      method: "GET",
      path: "/api/test",
      query: {},
      ip: "127.0.0.1"
    };
    res = {
      send: function(data) { return this; }, // Make send return res for chaining
      statusCode: 200
    };
    next = jest.fn();
    jest.clearAllMocks();
  });
  
  it("should log incoming request", () => {
    requestLogger(req, res, next);
    
    expect(logger.info).toHaveBeenCalledWith(
      "Incoming request",
      expect.objectContaining({
        requestId: "test-request-id",
        method: "GET",
        path: "/api/test"
      })
    );
    expect(next).toHaveBeenCalled();
  });
  
  it("should log request completion with duration", () => {
    requestLogger(req, res, next);
    
    // Simulate response by calling the wrapped send
    res.send("response data");
    
    // logger.info is called once for incoming request
    // logger.log is called once for completion (with 'info' level for 200 status)
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith(
      "info",
      "Request completed",
      expect.objectContaining({
        requestId: "test-request-id",
        method: "GET",
        path: "/api/test",
        status: 200,
        duration: expect.stringMatching(/\d+ms/)
      })
    );
  });
  
  it("should log error level for 5xx status codes", () => {
    res.statusCode = 500;
    requestLogger(req, res, next);
    
    res.send("error");
    
    expect(logger.log).toHaveBeenCalledWith(
      "error",
      "Request completed",
      expect.any(Object)
    );
  });
  
  it("should log warn level for 4xx status codes", () => {
    res.statusCode = 404;
    requestLogger(req, res, next);
    
    res.send("not found");
    
    expect(logger.log).toHaveBeenCalledWith(
      "warn",
      "Request completed",
      expect.any(Object)
    );
  });
  
  it("should include user ID if authenticated", () => {
    req.user = { userId: 123 };
    requestLogger(req, res, next);
    
    expect(logger.info).toHaveBeenCalledWith(
      "Incoming request",
      expect.objectContaining({
        userId: 123
      })
    );
  });
});

describe("logAuthEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it("should log successful login event", () => {
    logAuthEvent("login", 1, "testuser", true);
    
    expect(logger.info).toHaveBeenCalledWith(
      "Authentication event",
      expect.objectContaining({
        event: "login",
        userId: 1,
        username: "testuser",
        success: true,
        timestamp: expect.any(String)
      })
    );
  });
  
  it("should log failed login event", () => {
    logAuthEvent("login", null, "testuser", false, { reason: "Invalid password" });
    
    expect(logger.info).toHaveBeenCalledWith(
      "Authentication event",
      expect.objectContaining({
        event: "login",
        userId: null,
        username: "testuser",
        success: false,
        reason: "Invalid password"
      })
    );
  });
  
  it("should log token validation event", () => {
    logAuthEvent("token_validation", 1, "testuser", true);
    
    expect(logger.info).toHaveBeenCalledWith(
      "Authentication event",
      expect.objectContaining({
        event: "token_validation",
        userId: 1,
        username: "testuser",
        success: true
      })
    );
  });
});

describe("logAuthorizationFailure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it("should log authorization failure", () => {
    const req = {
      id: "test-request-id",
      user: {
        userId: 1,
        username: "viewer",
        role: "viewer"
      },
      method: "POST",
      path: "/api/admin"
    };
    
    logAuthorizationFailure(req, "admin");
    
    expect(logger.warn).toHaveBeenCalledWith(
      "Authorization failure",
      expect.objectContaining({
        requestId: "test-request-id",
        userId: 1,
        username: "viewer",
        userRole: "viewer",
        requiredRole: "admin",
        method: "POST",
        path: "/api/admin",
        timestamp: expect.any(String)
      })
    );
  });
  
  it("should handle missing user info", () => {
    const req = {
      id: "test-request-id",
      method: "GET",
      path: "/api/admin"
    };
    
    logAuthorizationFailure(req, "admin");
    
    expect(logger.warn).toHaveBeenCalledWith(
      "Authorization failure",
      expect.objectContaining({
        userId: null,
        username: null,
        userRole: null
      })
    );
  });
});

describe("logDatabaseError", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it("should log database error with query details", () => {
    const error = new Error("Connection timeout");
    error.code = "ETIMEDOUT";
    const query = "SELECT * FROM users WHERE id = $1";
    const params = { id: 1 };
    
    logDatabaseError(error, query, params);
    
    expect(logger.error).toHaveBeenCalledWith(
      "Database error",
      expect.objectContaining({
        error: "Connection timeout",
        code: "ETIMEDOUT",
        query,
        params: expect.any(Object),
        stack: expect.any(String),
        timestamp: expect.any(String)
      })
    );
  });
  
  it("should mask sensitive data in params", () => {
    const error = new Error("Query failed");
    const query = "INSERT INTO users (username, password) VALUES ($1, $2)";
    const params = { username: "testuser", password: "secret123" };
    
    logDatabaseError(error, query, params);
    
    const loggedParams = logger.error.mock.calls[0][1].params;
    expect(loggedParams.password).toBe("***MASKED***");
  });
});

describe("logSlowQuery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it("should log slow queries (>500ms)", () => {
    const query = "SELECT * FROM screenings";
    const duration = 750;
    
    logSlowQuery(query, duration);
    
    expect(logger.warn).toHaveBeenCalledWith(
      "Slow query detected",
      expect.objectContaining({
        query,
        duration: "750ms",
        timestamp: expect.any(String)
      })
    );
  });
  
  it("should not log fast queries (<=500ms)", () => {
    const query = "SELECT * FROM screenings";
    const duration = 250;
    
    logSlowQuery(query, duration);
    
    expect(logger.warn).not.toHaveBeenCalled();
  });
  
  it("should mask sensitive data in params", () => {
    const query = "UPDATE users SET password = $1";
    const duration = 600;
    const params = { password: "newsecret" };
    
    logSlowQuery(query, duration, params);
    
    const loggedParams = logger.warn.mock.calls[0][1].params;
    expect(loggedParams.password).toBe("***MASKED***");
  });
});

describe("logExternalApiCall", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it("should log successful external API call", () => {
    logExternalApiCall("twilio", "send_sms", true, { to: "+1234567890" });
    
    expect(logger.log).toHaveBeenCalledWith(
      "info",
      "External API call",
      expect.objectContaining({
        service: "twilio",
        operation: "send_sms",
        success: true,
        timestamp: expect.any(String)
      })
    );
  });
  
  it("should log failed external API call", () => {
    logExternalApiCall("twilio", "send_sms", false, { error: "Invalid phone number" });
    
    expect(logger.log).toHaveBeenCalledWith(
      "error",
      "External API call",
      expect.objectContaining({
        service: "twilio",
        operation: "send_sms",
        success: false,
        error: "Invalid phone number"
      })
    );
  });
  
  it("should mask sensitive data in details", () => {
    logExternalApiCall("twilio", "send_sms", true, {
      authToken: "secret-token",
      to: "+1234567890"
    });
    
    const loggedDetails = logger.log.mock.calls[0][2];
    expect(loggedDetails.authToken).toBe("***MASKED***");
  });
});
