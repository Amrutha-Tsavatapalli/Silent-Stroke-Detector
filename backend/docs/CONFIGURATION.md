# Configuration Management

This document describes the configuration management and validation system for the Silent Stroke Detector backend.

## Overview

The backend uses environment variables for configuration, with comprehensive validation on startup. If any required variables are missing or invalid, the application will log detailed error messages and exit with code 1.

## Required Environment Variables

### DATABASE_URL
- **Description**: PostgreSQL connection string
- **Format**: `postgresql://user:password@host:port/database` or `postgres://user:password@host:port/database`
- **Example**: `postgresql://postgres:password@localhost:5432/silent_stroke_detector`
- **Validation**: Must be a valid PostgreSQL connection string

### JWT_SECRET
- **Description**: Secret key for JWT token signing
- **Format**: String with minimum 32 characters
- **Example**: `this-is-a-very-secure-secret-key-with-at-least-32-characters`
- **Validation**: Must be at least 32 characters long
- **Security**: Never commit this value to version control. Use a secure random string in production.

## Optional Environment Variables

### PORT
- **Description**: Server port
- **Default**: `8080`
- **Example**: `8080`

### NODE_ENV
- **Description**: Environment mode
- **Default**: `development`
- **Options**: `development`, `staging`, `production`

### ALERT_THRESHOLD
- **Description**: Risk score threshold for triggering alerts
- **Default**: `0.7`
- **Range**: `0.0` to `1.0`
- **Validation**: Must be a number between 0 and 1

### CORS_ORIGINS
- **Description**: Comma-separated list of allowed CORS origins
- **Default**: `*` (allow all origins)
- **Example**: `http://localhost:3000,https://app.example.com`

### RATE_LIMIT_WINDOW_MS
- **Description**: Rate limiting window in milliseconds
- **Default**: `900000` (15 minutes)
- **Example**: `900000`

### RATE_LIMIT_MAX
- **Description**: Maximum requests per rate limit window
- **Default**: `100`
- **Example**: `100`

### LOG_LEVEL
- **Description**: Logging level
- **Default**: `info`
- **Options**: `debug`, `info`, `warn`, `error`

### Twilio Configuration (Optional for development, required for production)

#### TWILIO_ACCOUNT_SID
- **Description**: Twilio account identifier
- **Example**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### TWILIO_AUTH_TOKEN
- **Description**: Twilio authentication token
- **Example**: `your-twilio-auth-token`

#### TWILIO_PHONE_NUMBER
- **Description**: Twilio phone number for outbound calls/SMS
- **Example**: `+1234567890`

## Configuration Setup

### Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set the required variables:
   ```bash
   DATABASE_URL=postgresql://postgres:password@localhost:5432/silent_stroke_detector
   JWT_SECRET=your-secret-key-minimum-32-characters-long-change-in-production
   ```

3. Start the server:
   ```bash
   npm run dev
   ```

### Production

Set environment variables through your deployment platform (e.g., Railway, Heroku, AWS):

```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
export JWT_SECRET="your-production-secret-key-minimum-32-characters"
export NODE_ENV="production"
export TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export TWILIO_AUTH_TOKEN="your-twilio-auth-token"
export TWILIO_PHONE_NUMBER="+1234567890"
```

## Validation Behavior

### On Startup

The application validates all configuration on startup:

1. **Required variables**: Checks that `DATABASE_URL` and `JWT_SECRET` are present
2. **Format validation**: Validates `DATABASE_URL` format and `JWT_SECRET` length
3. **Range validation**: Validates `ALERT_THRESHOLD` is between 0 and 1
4. **Exit on error**: If validation fails, logs detailed errors and exits with code 1

### Example Error Output

```
Configuration validation failed:
  - Missing required environment variable: DATABASE_URL
  - JWT_SECRET must be at least 32 characters long (current length: 10)
  - ALERT_THRESHOLD must be between 0 and 1 (current value: 1.5)

Please check your environment variables and try again.
See .env.example for required configuration variables.
```

## Sensitive Value Masking

The configuration system automatically masks sensitive values in logs to prevent accidental exposure:

- Passwords
- Secrets (JWT_SECRET)
- Tokens (TWILIO_AUTH_TOKEN)
- API keys

### Example

```javascript
// Original config
{
  "port": 8080,
  "jwtSecret": "my-secret-key",
  "twilioAuthToken": "abc123"
}

// Logged config (in development mode)
{
  "port": 8080,
  "jwtSecret": "***MASKED***",
  "twilioAuthToken": "***MASKED***"
}
```

## Testing

The configuration validation is thoroughly tested:

### Unit Tests

```bash
npm run test:unit -- config.test.js
```

Tests the sensitive value masking functions.

### Integration Tests

```bash
npm run test:integration -- config.integration.test.js
```

Tests the complete validation flow with different environment variable combinations.

## Security Best Practices

1. **Never commit `.env` files**: Add `.env` to `.gitignore`
2. **Use strong secrets**: Generate JWT_SECRET with at least 32 random characters
3. **Rotate secrets regularly**: Change JWT_SECRET periodically in production
4. **Use secure secret stores**: In production, use AWS Secrets Manager, HashiCorp Vault, or similar
5. **Limit CORS origins**: In production, set `CORS_ORIGINS` to specific domains, not `*`
6. **Enable HTTPS**: Always use HTTPS in production (enforced by security headers)

## Troubleshooting

### "Missing required environment variable: DATABASE_URL"

**Solution**: Set the `DATABASE_URL` environment variable in your `.env` file or deployment platform.

### "JWT_SECRET must be at least 32 characters long"

**Solution**: Generate a longer secret key. You can use:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### "DATABASE_URL must be a valid PostgreSQL connection string"

**Solution**: Ensure your `DATABASE_URL` starts with `postgresql://` or `postgres://` and includes all required components (user, password, host, port, database).

### "ALERT_THRESHOLD must be between 0 and 1"

**Solution**: Set `ALERT_THRESHOLD` to a decimal value between 0.0 and 1.0 (e.g., `0.7`).

## References

- [Environment Variables Best Practices](https://12factor.net/config)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
