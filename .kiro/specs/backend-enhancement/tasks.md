# Implementation Plan: Backend Enhancement

## Overview

This implementation plan transforms the Silent Stroke Detector backend from a basic screening storage API into a production-ready medical platform. The work includes JWT authentication, role-based authorization, Twilio notifications, analytics engine, advanced search, comprehensive testing, OpenAPI documentation, database migrations, audit logging, and security hardening.

## Tasks

- [x] 1. Set up project infrastructure and dependencies
  - Install production dependencies: bcrypt, jsonwebtoken, joi, express-rate-limit, twilio, swagger-ui-express, yamljs, node-pg-migrate, winston
  - Install development dependencies: jest, supertest, @types/jest, eslint, prettier
  - Create project structure: src/middleware/, src/services/, src/repositories/, src/docs/, migrations/, tests/
  - Set up Jest configuration for integration and unit tests
  - Create .env.example with all required environment variables
  - _Requirements: 14.1, 14.2, 14.3_

- [x] 2. Implement configuration management and validation
  - Create config validation module that checks required environment variables on startup
  - Implement environment variable loading with dotenv
  - Add validation for JWT_SECRET (minimum 32 characters), DATABASE_URL format, ALERT_THRESHOLD range (0-1)
  - Implement sensitive value masking for logs (passwords, tokens, API keys)
  - Exit with code 1 if required variables are missing
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.7_

- [x] 3. Set up database migrations system
  - Configure node-pg-migrate with migrations directory
  - Create schema_migrations table to track applied migrations
  - Add npm scripts for migrate up, down, and status commands
  - _Requirements: 12.1, 12.2_

- [x] 4. Create database migration for users table
  - Write migration to create users table with id, username, password_hash, role, created_at, updated_at
  - Add CHECK constraint for role (admin, viewer)
  - Add UNIQUE constraint on username
  - Create index on username column
  - Include rollback migration
  - _Requirements: 12.5, 1.6_

- [x] 5. Create database migration for hospitals table
  - Write migration to create hospitals table with id, name, phone, address, latitude, longitude, capabilities, timestamps
  - Add UNIQUE constraint on (name, latitude, longitude)
  - Create indexes on location coordinates and name
  - Include rollback migration
  - _Requirements: 12.7, 7.7_

- [x] 6. Create database migration to enhance alert_events table
  - Add notification_status column (default 'pending')
  - Add twilio_message_sid column
  - Add error_message column
  - Include rollback migration
  - _Requirements: 12.6, 4.6_

- [x] 7. Create database migration for audit_trail table
  - Write migration to create audit_trail table with id, user_id, operation, table_name, record_id, old_values, new_values, created_at
  - Add CHECK constraint for operation (CREATE, UPDATE, DELETE)
  - Add foreign key reference to users table
  - Create indexes on user_id, created_at, and (table_name, record_id)
  - Include rollback migration
  - _Requirements: 15.2, 15.3_

- [x] 8. Create database migration for performance indexes
  - Add indexes on screenings table: patient_name, location, created_at DESC, risk_score, should_alert, priority
  - _Requirements: 2.1, 2.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 9. Implement authentication service
  - Create AuthService class with register, login, verifyToken, generateToken methods
  - Implement password hashing with bcrypt (12 rounds)
  - Implement JWT token generation with 24-hour expiration using RS256 algorithm
  - Implement JWT token verification with signature validation
  - Include user ID, username, role in JWT payload
  - _Requirements: 1.1, 1.2, 1.3, 11.8_

- [x] 10. Create user repository
  - Implement createUser method with parameterized queries
  - Implement findUserByUsername method
  - Implement findUserById method
  - Use parameterized queries to prevent SQL injection
  - _Requirements: 1.6, 11.7_

- [ ]* 11. Write unit tests for authentication service
  - Test password hashing produces different hashes for same password
  - Test password verification with correct and incorrect passwords
  - Test JWT token generation includes correct payload
  - Test JWT token verification with valid, expired, and invalid tokens
  - Mock user repository
  - _Requirements: 8.1, 8.2_

- [x] 12. Implement authentication middleware
  - Create authenticate middleware that extracts JWT from Authorization header
  - Verify token signature and expiration
  - Attach user info to req.user
  - Return 401 Unauthorized for missing, invalid, or expired tokens
  - _Requirements: 1.4, 1.5_

- [x] 13. Implement authorization middleware
  - Create authorize middleware factory that accepts allowed roles
  - Check if req.user.role is in allowed roles
  - Return 403 Forbidden if user lacks permission
  - _Requirements: 1.7, 1.8_

- [x] 14. Create authentication endpoints
  - Implement POST /api/auth/register endpoint with username, password, role validation
  - Implement POST /api/auth/login endpoint that returns JWT token and user info
  - Add Joi validation schemas for request bodies
  - Return 409 Conflict for duplicate username
  - Return 401 Unauthorized for invalid credentials without revealing which field was incorrect
  - _Requirements: 1.1, 1.2, 1.3_

- [ ]* 15. Write integration tests for authentication endpoints
  - Test user registration with valid data returns 201
  - Test user registration with duplicate username returns 409
  - Test login with valid credentials returns token
  - Test login with invalid credentials returns 401
  - Test protected endpoint with valid token succeeds
  - Test protected endpoint with expired token returns 401
  - Test protected endpoint with invalid token returns 401
  - Use test database reset before each test
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 16. Implement validation middleware
  - Create validate middleware factory that accepts Joi schema
  - Validate req.body against schema
  - Return 400 Bad Request with field-specific error messages on validation failure
  - Reject unexpected fields
  - _Requirements: 10.1, 10.2_

- [x] 17. Implement error handling middleware
  - Create global error handler that catches all errors
  - Return consistent JSON format with "error" and "detail" fields
  - Return 500 Internal Server Error for database errors without exposing details
  - Return 404 Not Found for resource not found errors
  - Log all errors with timestamp, request ID, user ID, method, path, stack trace
  - Mask sensitive data in error logs
  - _Requirements: 10.3, 10.4, 10.6, 10.7_

- [x] 18. Implement structured logging with Winston
  - Configure Winston with JSON format for structured logging
  - Add request ID generation middleware
  - Log all HTTP requests with method, path, status, duration
  - Log authentication events (login, token validation)
  - Log authorization failures
  - Log database errors and slow queries (> 500ms)
  - Log external API calls
  - Mask sensitive values (passwords, tokens, API keys) in logs
  - _Requirements: 13.6, 13.7, 14.7_

- [x] 19. Enhance screening repository with new methods
  - Implement getScreeningById method
  - Implement getScreeningsByPatient method with pagination
  - Implement searchScreenings method with filters (patientName, location, riskScoreMin, riskScoreMax, startDate, endDate, shouldAlert, priority)
  - Use parameterized queries with ILIKE for case-insensitive partial matching
  - Apply multiple filters with AND logic
  - _Requirements: 5.1, 5.2, 2.1, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 20. Implement patient trend calculation
  - Create method to calculate trend direction (improving, stable, worsening) based on last 3 screenings
  - Return "insufficient_data" when patient has fewer than 2 screenings
  - Compare risk scores to determine trend
  - _Requirements: 2.4, 2.5_

- [x] 21. Create enhanced screening endpoints
  - Implement GET /api/screenings/:id endpoint that returns complete screening with alert events and nearest hospital
  - Implement GET /api/screenings/patient/:patientName endpoint with pagination and trend calculation
  - Implement GET /api/screenings/search endpoint with multiple filter support
  - Add authentication middleware to all endpoints
  - Return 404 Not Found when screening ID doesn't exist
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 2.1, 2.2, 2.3, 2.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ]* 22. Write integration tests for screening endpoints
  - Test GET /api/screenings/:id with existing ID returns complete record
  - Test GET /api/screenings/:id with non-existent ID returns 404
  - Test GET /api/screenings/patient/:patientName returns screenings ordered by date descending
  - Test patient trend calculation with 3+ screenings
  - Test patient trend returns "insufficient_data" with < 2 screenings
  - Test search with multiple filters applies AND logic
  - Test search with risk score range filter
  - Test search with date range filter
  - Test search with alert status filter
  - Test search with priority filter
  - Test pagination works correctly
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 23. Implement hospital repository
  - Create HospitalRepository class with CRUD methods
  - Implement createHospital method with duplicate check
  - Implement updateHospital method
  - Implement deleteHospital method
  - Implement listHospitals method with pagination
  - Implement searchHospitals method with ILIKE on name and address
  - Implement findNearestHospital method using Haversine formula for distance calculation
  - Use parameterized queries for all operations
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 24. Create hospital management endpoints
  - Implement POST /api/hospitals endpoint with admin authorization
  - Implement PUT /api/hospitals/:id endpoint with admin authorization
  - Implement DELETE /api/hospitals/:id endpoint with admin authorization
  - Implement GET /api/hospitals endpoint with pagination
  - Implement GET /api/hospitals/search endpoint with query parameter
  - Implement GET /api/hospitals/nearest endpoint with latitude/longitude parameters
  - Add Joi validation for required fields (name, phone, address, coordinates)
  - Return 409 Conflict for duplicate hospital (same name and location)
  - Return 404 Not Found when hospital ID doesn't exist
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8_

- [ ]* 25. Write integration tests for hospital endpoints
  - Test create hospital with valid data returns 201
  - Test create hospital with duplicate name and location returns 409
  - Test update hospital returns updated record
  - Test delete hospital returns success
  - Test list hospitals with pagination
  - Test search hospitals by name
  - Test search hospitals by location
  - Test find nearest hospital by coordinates
  - Test admin can access all hospital endpoints
  - Test viewer cannot create/update/delete hospitals (403)
  - _Requirements: 8.1, 8.2, 8.3, 8.6_

- [x] 26. Migrate hospital data from JSON to database
  - Create script to read hospitals.json file
  - Insert hospital records into database using hospital repository
  - Handle duplicates gracefully
  - Log migration progress and results
  - _Requirements: 7.7_

- [x] 27. Implement notification service with Twilio integration
  - Create NotificationService class with sendSmsAlert and initiateVoiceCall methods
  - Configure Twilio client with account SID, auth token, and phone number from environment
  - Implement SMS message formatting with patient name, location, risk score, timestamp
  - Implement voice call initiation for CRITICAL priority screenings
  - Handle Twilio API errors gracefully without crashing
  - Log errors and return failure status on API errors
  - Store Twilio message SID in alert_events table
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 28. Create alert notification endpoint
  - Implement POST /api/screenings/:id/alert endpoint with admin authorization
  - Retrieve screening by ID and nearest hospital
  - Call notification service to send SMS or voice call based on priority
  - Update alert_events table with notification status and message SID
  - Return success status and message SID
  - Return 404 Not Found if screening doesn't exist
  - Return 500 Internal Server Error if Twilio API fails
  - _Requirements: 4.7, 4.6_

- [ ]* 29. Write integration tests for notification service
  - Test SMS alert sends successfully with Twilio test credentials
  - Test voice call initiates for CRITICAL priority
  - Test notification status stored in database
  - Test Twilio message SID stored in database
  - Test Twilio API error handling doesn't crash service
  - Test error message stored in alert_events on failure
  - Mock Twilio client for predictable testing
  - _Requirements: 8.1, 8.2, 8.5_

- [x] 30. Implement analytics repository
  - Create AnalyticsRepository class with aggregate query methods
  - Implement getDailyScreeningCounts method using COUNT and GROUP BY date
  - Implement getAverageRiskByLocation method using AVG and GROUP BY location
  - Implement getAlertRate method calculating (alerts / total screenings)
  - Implement getTopRiskLocations method using AVG, GROUP BY, ORDER BY, LIMIT
  - Exclude screenings with scenario_label "demo" or "test" in all queries
  - Use date range filters in WHERE clauses
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 31. Implement analytics service
  - Create AnalyticsService class that orchestrates analytics repository
  - Implement getAnalyticsSummary method that combines all analytics data
  - Validate date range doesn't exceed 365 days
  - Return structured JSON with dailyCounts, avgRiskByLocation, alertRate, topRiskLocations
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_

- [x] 32. Create analytics endpoint
  - Implement GET /api/analytics endpoint with admin authorization
  - Require startDate and endDate query parameters
  - Validate date range doesn't exceed 365 days (return 400 if exceeded)
  - Call analytics service to compute and return analytics data
  - _Requirements: 3.6, 3.7_

- [ ]* 33. Write integration tests for analytics endpoints
  - Test analytics returns correct daily screening counts
  - Test analytics returns correct average risk by location
  - Test analytics returns correct alert rate percentage
  - Test analytics returns top 5 risk locations
  - Test analytics excludes demo and test data
  - Test analytics with date range exceeding 365 days returns 400
  - Test analytics requires admin authorization
  - Create test data with known values for verification
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 34. Implement audit service
  - Create AuditService class with logOperation and getAuditLogs methods
  - Implement logOperation to insert records into audit_trail table
  - Capture operation type (CREATE, UPDATE, DELETE), table name, record ID, old/new values
  - Mask sensitive fields (password_hash) before storing in audit trail
  - Implement getAuditLogs with filters for date range, user ID, operation type, table name
  - _Requirements: 15.1, 15.3, 15.7_

- [x] 35. Create audit middleware
  - Create middleware that intercepts create, update, delete operations
  - Extract user ID from req.user
  - Capture old values before update/delete operations
  - Capture new values after create/update operations
  - Call audit service to log operation
  - _Requirements: 15.1_

- [x] 36. Create audit log endpoint
  - Implement GET /api/audit endpoint with admin authorization
  - Support filtering by date range, user ID, operation type, table name
  - Return paginated audit log records
  - _Requirements: 15.4, 15.5_

- [ ]* 37. Write integration tests for audit logging
  - Test create operation logged with new values
  - Test update operation logged with old and new values
  - Test delete operation logged with old values
  - Test sensitive fields masked in audit trail
  - Test audit log retrieval with date range filter
  - Test audit log retrieval with user filter
  - Test audit log retrieval with operation type filter
  - Test audit logs require admin authorization
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 38. Implement rate limiting
  - Configure express-rate-limit with 100 requests per 15-minute window per IP
  - Create separate rate limiter for auth endpoints (10 requests per 15 minutes)
  - Apply general rate limiter to all /api routes
  - Apply auth rate limiter to /api/auth routes
  - Exclude health check endpoints from rate limiting
  - Return 429 Too Many Requests when limit exceeded
  - _Requirements: 11.1, 11.2_

- [ ]* 39. Write integration tests for rate limiting
  - Test requests within limit succeed
  - Test requests exceeding limit return 429
  - Test auth endpoints have stricter limits
  - Test health check endpoints bypass rate limiting
  - _Requirements: 8.1, 8.2, 9.1_

- [x] 40. Implement security headers middleware
  - Set Content-Security-Policy header to "default-src 'self'"
  - Set X-Frame-Options header to DENY
  - Set X-Content-Type-Options header to nosniff
  - Set Strict-Transport-Security header for HTTPS
  - Set X-XSS-Protection header to "1; mode=block"
  - _Requirements: 11.3, 11.4, 11.5, 11.6_

- [ ] 41. Configure CORS with environment-based origins
  - Implement CORS middleware with origin validation
  - Load allowed origins from CORS_ORIGINS environment variable
  - Allow all origins in development
  - Restrict to specific domains in production
  - Enable credentials support
  - _Requirements: 14.6_

- [ ] 42. Enhance health check endpoints
  - Implement GET /health/live endpoint that returns 200 if server is running
  - Implement GET /health/ready endpoint that verifies database connectivity with SELECT 1 query
  - Return 503 Service Unavailable if database is unreachable
  - Implement GET /health/metrics endpoint that returns request count, average response time, error rate, uptime
  - Track metrics for last 5 minutes
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ]* 43. Write integration tests for health check endpoints
  - Test /health/live returns 200
  - Test /health/ready returns 200 when database is connected
  - Test /health/ready returns 503 when database is disconnected
  - Test /health/metrics returns valid data structure
  - Test health endpoints don't require authentication
  - _Requirements: 8.1, 8.2, 8.8_

- [ ] 44. Create OpenAPI specification
  - Write openapi.yaml file with API metadata (title, version, description)
  - Define security schemes for JWT bearer authentication
  - Document all endpoints with request/response schemas
  - Include example requests and responses for each endpoint
  - Document all status codes (200, 201, 400, 401, 403, 404, 409, 429, 500, 503)
  - Document authentication requirements using security schemes
  - Define reusable schemas for Screening, Hospital, User, Alert, Analytics, Audit
  - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6_

- [ ] 45. Set up Swagger UI
  - Install swagger-ui-express and yamljs dependencies
  - Configure Swagger UI to serve at /api/docs
  - Serve OpenAPI JSON at /api/docs/openapi.json
  - Enable try-it-out functionality
  - Add JWT token input for authentication testing
  - _Requirements: 9.2, 9.7_

- [ ]* 46. Verify API documentation completeness
  - Test all endpoints documented in OpenAPI spec
  - Test all request/response schemas are accurate
  - Test example requests work in Swagger UI
  - Test authentication flow works in Swagger UI
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 47. Checkpoint - Run all tests and verify coverage
  - Run complete test suite with npm test
  - Generate coverage report with npm run test:coverage
  - Verify minimum 80% code coverage for routes and services
  - Verify all tests pass
  - Verify test suite runs in under 30 seconds
  - Fix any failing tests or coverage gaps
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 8.7, 8.8_

- [ ] 48. Create comprehensive README documentation
  - Document setup instructions (install dependencies, configure environment, run migrations)
  - Document all environment variables with descriptions
  - Document API endpoints with examples
  - Document testing instructions (run tests, generate coverage)
  - Document deployment instructions for development, staging, production
  - Document database migration commands
  - Document Twilio setup and test credentials
  - _Requirements: 14.1, 14.2, 14.5_

- [ ] 49. Final integration and verification
  - Apply all database migrations to clean database
  - Seed test data (users, hospitals, screenings)
  - Test complete authentication flow (register, login, access protected endpoints)
  - Test complete screening workflow (create, retrieve, search, patient history)
  - Test complete hospital workflow (create, update, delete, search, nearest)
  - Test notification workflow (trigger alert, verify Twilio call)
  - Test analytics workflow (compute metrics, verify accuracy)
  - Test audit logging (verify all operations logged)
  - Test rate limiting (exceed limits, verify 429 response)
  - Test health checks (verify all endpoints respond correctly)
  - Test API documentation (verify Swagger UI works, test endpoints)
  - _Requirements: All requirements_

- [ ] 50. Final checkpoint - Production readiness verification
  - Verify all 15 requirements implemented and tested
  - Verify 80% code coverage achieved
  - Verify all tests pass in under 30 seconds
  - Verify OpenAPI documentation complete and accurate
  - Verify authentication and authorization work correctly
  - Verify Twilio notifications send successfully
  - Verify analytics queries return accurate results
  - Verify database migrations apply cleanly
  - Verify audit logging captures all operations
  - Verify health checks and metrics work correctly
  - Verify rate limiting prevents abuse
  - Verify security headers properly configured
  - Verify configuration validation works on startup
  - Verify error handling consistent across all endpoints
  - Verify system ready for staging deployment
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- All implementation uses JavaScript/Node.js with Express framework
- Testing uses Jest and Supertest for integration tests
- Database uses PostgreSQL with parameterized queries for security
- External integrations use Twilio for SMS and voice notifications
- Documentation uses OpenAPI 3.0 with Swagger UI
