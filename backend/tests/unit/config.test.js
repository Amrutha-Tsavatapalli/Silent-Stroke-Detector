import { maskSensitiveValue, maskSensitiveObject } from "../../src/config.js";

describe("Configuration Validation", () => {
  describe("maskSensitiveValue", () => {
    it("should mask password fields", () => {
      expect(maskSensitiveValue("password", "secret123")).toBe("***MASKED***");
      expect(maskSensitiveValue("user_password", "secret123")).toBe(
        "***MASKED***"
      );
      expect(maskSensitiveValue("PASSWORD", "secret123")).toBe("***MASKED***");
    });

    it("should mask secret fields", () => {
      expect(maskSensitiveValue("secret", "mysecret")).toBe("***MASKED***");
      expect(maskSensitiveValue("jwt_secret", "mysecret")).toBe("***MASKED***");
      expect(maskSensitiveValue("SECRET_KEY", "mysecret")).toBe("***MASKED***");
    });

    it("should mask token fields", () => {
      expect(maskSensitiveValue("token", "abc123")).toBe("***MASKED***");
      expect(maskSensitiveValue("auth_token", "abc123")).toBe("***MASKED***");
      expect(maskSensitiveValue("access_token", "abc123")).toBe("***MASKED***");
    });

    it("should mask API key fields", () => {
      expect(maskSensitiveValue("api_key", "key123")).toBe("***MASKED***");
      expect(maskSensitiveValue("apikey", "key123")).toBe("***MASKED***");
      expect(maskSensitiveValue("API_KEY", "key123")).toBe("***MASKED***");
    });

    it("should not mask non-sensitive fields", () => {
      expect(maskSensitiveValue("username", "john")).toBe("john");
      expect(maskSensitiveValue("email", "john@example.com")).toBe(
        "john@example.com"
      );
      expect(maskSensitiveValue("port", "8080")).toBe("8080");
      expect(maskSensitiveValue("database_url", "postgres://localhost")).toBe(
        "postgres://localhost"
      );
    });

    it("should handle null and undefined values", () => {
      expect(maskSensitiveValue("password", null)).toBe(null);
      expect(maskSensitiveValue("password", undefined)).toBe(undefined);
      expect(maskSensitiveValue("password", "")).toBe("");
    });
  });

  describe("maskSensitiveObject", () => {
    it("should mask sensitive fields in an object", () => {
      const obj = {
        username: "john",
        password: "secret123",
        email: "john@example.com",
        jwt_secret: "mysecret",
        port: 8080,
      };

      const masked = maskSensitiveObject(obj);

      expect(masked.username).toBe("john");
      expect(masked.password).toBe("***MASKED***");
      expect(masked.email).toBe("john@example.com");
      expect(masked.jwt_secret).toBe("***MASKED***");
      expect(masked.port).toBe(8080);
    });

    it("should handle empty objects", () => {
      const masked = maskSensitiveObject({});
      expect(masked).toEqual({});
    });

    it("should handle objects with only sensitive fields", () => {
      const obj = {
        password: "secret123",
        token: "abc123",
        api_key: "key123",
      };

      const masked = maskSensitiveObject(obj);

      expect(masked.password).toBe("***MASKED***");
      expect(masked.token).toBe("***MASKED***");
      expect(masked.api_key).toBe("***MASKED***");
    });

    it("should handle objects with only non-sensitive fields", () => {
      const obj = {
        username: "john",
        email: "john@example.com",
        port: 8080,
      };

      const masked = maskSensitiveObject(obj);

      expect(masked).toEqual(obj);
    });

    it("should not mutate the original object", () => {
      const obj = {
        username: "john",
        password: "secret123",
      };

      const masked = maskSensitiveObject(obj);

      expect(obj.password).toBe("secret123");
      expect(masked.password).toBe("***MASKED***");
    });
  });
});
