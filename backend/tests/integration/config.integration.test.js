import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../..");

/**
 * Helper function to run a Node.js script with specific environment variables
 * and capture its output and exit code
 */
function runWithEnv(env) {
  return new Promise((resolve) => {
    // Create a clean environment with only the specified variables
    const cleanEnv = {
      NODE_ENV: env.NODE_ENV || "test",
      PATH: process.env.PATH, // Keep PATH for Node.js to work
    };
    
    // Add the specified environment variables
    Object.keys(env).forEach((key) => {
      if (env[key] !== undefined) {
        cleanEnv[key] = env[key];
      }
    });

    const child = spawn("node", [join(projectRoot, "src/config.js")], {
      env: cleanEnv,
      cwd: projectRoot,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

describe("Configuration Validation Integration", () => {
  const validEnv = {
    DATABASE_URL: "postgresql://user:password@localhost:5432/testdb",
    JWT_SECRET: "this-is-a-valid-secret-with-at-least-32-characters",
    ALERT_THRESHOLD: "0.7",
    NODE_ENV: "test",
  };

  describe("Required environment variables", () => {
    it("should exit with code 1 when DATABASE_URL is missing", async () => {
      const env = {
        JWT_SECRET: validEnv.JWT_SECRET,
        ALERT_THRESHOLD: validEnv.ALERT_THRESHOLD,
        NODE_ENV: "test",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Configuration validation failed");
      expect(result.stderr).toContain("DATABASE_URL");
    });

    it("should exit with code 1 when JWT_SECRET is missing", async () => {
      const env = {
        DATABASE_URL: validEnv.DATABASE_URL,
        ALERT_THRESHOLD: validEnv.ALERT_THRESHOLD,
        NODE_ENV: "test",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Configuration validation failed");
      expect(result.stderr).toContain("JWT_SECRET");
    });
  });

  describe("JWT_SECRET validation", () => {
    it("should exit with code 1 when JWT_SECRET is too short", async () => {
      const env = {
        ...validEnv,
        JWT_SECRET: "short", // Less than 32 characters
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Configuration validation failed");
      expect(result.stderr).toContain("JWT_SECRET must be at least 32 characters");
    });

    it("should succeed when JWT_SECRET is exactly 32 characters", async () => {
      const env = {
        ...validEnv,
        JWT_SECRET: "12345678901234567890123456789012", // Exactly 32 characters
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(0);
    });

    it("should succeed when JWT_SECRET is more than 32 characters", async () => {
      const env = {
        ...validEnv,
        JWT_SECRET: "this-is-a-very-long-secret-key-with-more-than-32-characters",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(0);
    });
  });

  describe("DATABASE_URL validation", () => {
    it("should exit with code 1 when DATABASE_URL format is invalid", async () => {
      const env = {
        ...validEnv,
        DATABASE_URL: "invalid-url",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Configuration validation failed");
      expect(result.stderr).toContain("DATABASE_URL must be a valid PostgreSQL connection string");
    });

    it("should succeed with postgresql:// protocol", async () => {
      const env = {
        ...validEnv,
        DATABASE_URL: "postgresql://user:password@localhost:5432/testdb",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(0);
    });

    it("should succeed with postgres:// protocol", async () => {
      const env = {
        ...validEnv,
        DATABASE_URL: "postgres://user:password@localhost:5432/testdb",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(0);
    });
  });

  describe("ALERT_THRESHOLD validation", () => {
    it("should exit with code 1 when ALERT_THRESHOLD is below 0", async () => {
      const env = {
        ...validEnv,
        ALERT_THRESHOLD: "-0.1",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Configuration validation failed");
      expect(result.stderr).toContain("ALERT_THRESHOLD must be between 0 and 1");
    });

    it("should exit with code 1 when ALERT_THRESHOLD is above 1", async () => {
      const env = {
        ...validEnv,
        ALERT_THRESHOLD: "1.5",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Configuration validation failed");
      expect(result.stderr).toContain("ALERT_THRESHOLD must be between 0 and 1");
    });

    it("should exit with code 1 when ALERT_THRESHOLD is not a number", async () => {
      const env = {
        ...validEnv,
        ALERT_THRESHOLD: "not-a-number",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Configuration validation failed");
      expect(result.stderr).toContain("ALERT_THRESHOLD must be a valid number");
    });

    it("should succeed when ALERT_THRESHOLD is 0", async () => {
      const env = {
        ...validEnv,
        ALERT_THRESHOLD: "0",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(0);
    });

    it("should succeed when ALERT_THRESHOLD is 1", async () => {
      const env = {
        ...validEnv,
        ALERT_THRESHOLD: "1",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(0);
    });

    it("should succeed when ALERT_THRESHOLD is between 0 and 1", async () => {
      const env = {
        ...validEnv,
        ALERT_THRESHOLD: "0.75",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(0);
    });

    it("should use default value 0.7 when ALERT_THRESHOLD is not provided", async () => {
      const env = {
        DATABASE_URL: validEnv.DATABASE_URL,
        JWT_SECRET: validEnv.JWT_SECRET,
        NODE_ENV: "test",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(0);
    });
  });

  describe("Valid configuration", () => {
    it("should succeed with all required variables", async () => {
      const result = await runWithEnv(validEnv);

      expect(result.code).toBe(0);
    });

    it("should succeed with optional Twilio variables", async () => {
      const env = {
        ...validEnv,
        TWILIO_ACCOUNT_SID: "test-account-sid",
        TWILIO_AUTH_TOKEN: "test-auth-token",
        TWILIO_PHONE_NUMBER: "+1234567890",
      };

      const result = await runWithEnv(env);

      expect(result.code).toBe(0);
    });
  });
});
