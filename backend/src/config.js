import dotenv from "dotenv";

dotenv.config();

/**
 * Validates that a required environment variable is present
 * @param {string} name - Environment variable name
 * @param {string} value - Environment variable value
 * @returns {string} The validated value
 * @throws {Error} If the value is missing
 */
function validateRequired(name, value) {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Validates JWT_SECRET is at least 32 characters
 * @param {string} secret - JWT secret
 * @returns {string} The validated secret
 * @throws {Error} If the secret is too short
 */
function validateJwtSecret(secret) {
  validateRequired("JWT_SECRET", secret);
  if (secret.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters long (current length: ${secret.length})`
    );
  }
  return secret;
}

/**
 * Validates DATABASE_URL format
 * @param {string} url - Database URL
 * @returns {string} The validated URL
 * @throws {Error} If the URL format is invalid
 */
function validateDatabaseUrl(url) {
  validateRequired("DATABASE_URL", url);
  
  // Check if it's a valid PostgreSQL connection string
  const postgresUrlPattern = /^postgres(ql)?:\/\/.+/i;
  if (!postgresUrlPattern.test(url)) {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL connection string (e.g., postgresql://user:password@host:port/database)"
    );
  }
  
  return url;
}

/**
 * Validates ALERT_THRESHOLD is between 0 and 1
 * @param {string} threshold - Alert threshold value
 * @returns {number} The validated threshold as a number
 * @throws {Error} If the threshold is out of range
 */
function validateAlertThreshold(threshold) {
  const value = Number(threshold);
  
  if (isNaN(value)) {
    throw new Error("ALERT_THRESHOLD must be a valid number");
  }
  
  if (value < 0 || value > 1) {
    throw new Error(
      `ALERT_THRESHOLD must be between 0 and 1 (current value: ${value})`
    );
  }
  
  return value;
}

/**
 * Masks sensitive values for logging
 * @param {string} key - Configuration key
 * @param {any} value - Configuration value
 * @returns {any} Masked value if sensitive, original value otherwise
 */
export function maskSensitiveValue(key, value) {
  const sensitiveKeys = [
    "password",
    "secret",
    "token",
    "auth_token",
    "api_key",
    "apikey",
    "jwt",
    "auth",
  ];
  
  const lowerKey = key.toLowerCase();
  const isSensitive = sensitiveKeys.some((sensitiveKey) =>
    lowerKey.includes(sensitiveKey)
  );
  
  if (isSensitive && value) {
    return "***MASKED***";
  }
  
  return value;
}

/**
 * Masks sensitive values in an object for logging
 * @param {Object} obj - Object to mask
 * @returns {Object} Object with sensitive values masked
 */
export function maskSensitiveObject(obj) {
  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    masked[key] = maskSensitiveValue(key, value);
  }
  return masked;
}

/**
 * Validates all configuration and returns the config object
 * Exits with code 1 if validation fails
 */
function validateConfig() {
  const errors = [];
  
  try {
    // Required variables
    const databaseUrl = validateDatabaseUrl(process.env.DATABASE_URL);
    const jwtSecret = validateJwtSecret(process.env.JWT_SECRET);
    
    // Optional variables with validation
    const alertThreshold = validateAlertThreshold(
      process.env.ALERT_THRESHOLD || "0.7"
    );
    
    // Optional variables without validation
    const port = Number(process.env.PORT || 8080);
    const nodeEnv = process.env.NODE_ENV || "development";
    const corsOrigins = process.env.CORS_ORIGINS || "*";
    const rateLimitWindowMs = Number(
      process.env.RATE_LIMIT_WINDOW_MS || 900000
    );
    const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 100);
    const logLevel = process.env.LOG_LEVEL || "info";
    
    // Twilio configuration (required for production, optional for development)
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || "";
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || "";
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || "";
    
    // Warn if Twilio credentials are missing in production
    if (nodeEnv === "production") {
      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        console.warn(
          "WARNING: Twilio credentials are not configured. Notifications will not work."
        );
      }
    }
    
    return {
      port,
      nodeEnv,
      databaseUrl,
      jwtSecret,
      alertThreshold,
      corsOrigins,
      rateLimitWindowMs,
      rateLimitMax,
      logLevel,
      twilioAccountSid,
      twilioAuthToken,
      twilioPhoneNumber,
    };
  } catch (error) {
    errors.push(error.message);
  }
  
  if (errors.length > 0) {
    console.error("Configuration validation failed:");
    errors.forEach((error) => console.error(`  - ${error}`));
    console.error("\nPlease check your environment variables and try again.");
    console.error(
      "See .env.example for required configuration variables.\n"
    );
    process.exit(1);
  }
}

// Validate configuration on module load
const validatedConfig = validateConfig();

// Log configuration (with sensitive values masked) in development
if (validatedConfig.nodeEnv === "development") {
  console.log("Configuration loaded:");
  console.log(JSON.stringify(maskSensitiveObject(validatedConfig), null, 2));
}

export const config = validatedConfig;
