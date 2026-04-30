# Requirements Document

## Introduction

This document specifies requirements for enhancing the Silent Stroke Detector backend system. The existing system includes a Node.js/Express API with basic screening storage, hospital lookup, and health check endpoints. This enhancement adds comprehensive testing, missing features (authentication, notifications, analytics), API improvements, and documentation to create a production-ready medical screening platform.

## Glossary

- **API_Server**: The Node.js/Express backend service that handles HTTP requests
- **Database**: PostgreSQL database storing screening and alert data
- **Frontend_Client**: Python Streamlit application that consumes the API
- **Screening**: A stroke risk assessment session with facial and voice analysis
- **Alert_Event**: Emergency notification triggered when risk exceeds threshold
- **User**: Healthcare professional or administrator accessing the system
- **Patient**: Individual undergoing stroke screening
- **Hospital_Record**: Medical facility information including location and contact details
- **Authentication_Service**: Component managing user identity and access control
- **Notification_Service**: Component sending SMS and voice call alerts via Twilio
- **Analytics_Engine**: Component computing statistics and trends from screening data

## Requirements

### Requirement 1: User Authentication and Authorization

**User Story:** As a healthcare administrator, I want secure user authentication, so that only authorized personnel can access patient screening data.

#### Acceptance Criteria

1. THE Authentication_Service SHALL hash passwords using bcrypt with minimum 12 rounds
2. WHEN a user submits valid credentials, THE Authentication_Service SHALL generate a JWT token with 24-hour expiration
3. WHEN a user submits invalid credentials, THE Authentication_Service SHALL return an error without revealing whether username or password was incorrect
4. WHEN an API request includes a valid JWT token, THE API_Server SHALL authorize the request
5. WHEN an API request includes an expired or invalid JWT token, THE API_Server SHALL return HTTP 401 Unauthorized
6. THE Database SHALL store user records with username, hashed password, role, and creation timestamp
7. WHERE a user has role "admin", THE API_Server SHALL permit access to all endpoints
8. WHERE a user has role "viewer", THE API_Server SHALL permit read-only access to screening data

### Requirement 2: Patient History Tracking

**User Story:** As a healthcare provider, I want to view a patient's screening history, so that I can track changes in stroke risk over time.

#### Acceptance Criteria

1. THE API_Server SHALL provide an endpoint to retrieve all screenings for a specific patient name
2. WHEN retrieving patient history, THE API_Server SHALL return screenings ordered by creation timestamp descending
3. THE API_Server SHALL support pagination with configurable page size and offset
4. THE API_Server SHALL calculate and return the trend direction (improving, stable, worsening) based on the last 3 screenings
5. WHEN a patient has fewer than 2 screenings, THE API_Server SHALL return trend status as "insufficient_data"
6. THE API_Server SHALL include alert event history for each screening in the response

### Requirement 3: Analytics Dashboard Data

**User Story:** As a hospital administrator, I want aggregate analytics on screening data, so that I can identify patterns and allocate resources effectively.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL compute daily screening counts for a specified date range
2. THE Analytics_Engine SHALL compute average risk scores grouped by location
3. THE Analytics_Engine SHALL compute alert rate percentage (alerts triggered / total screenings)
4. THE Analytics_Engine SHALL identify the top 5 locations with highest average risk scores
5. WHEN computing analytics, THE Analytics_Engine SHALL exclude screenings with scenario_label "demo" or "test"
6. THE API_Server SHALL provide an endpoint returning analytics data in JSON format
7. WHEN the date range exceeds 365 days, THE API_Server SHALL return HTTP 400 Bad Request

### Requirement 4: Real-Time Alert Notifications

**User Story:** As an emergency responder, I want automatic SMS and voice call alerts for high-risk screenings, so that I can respond immediately to potential stroke cases.

#### Acceptance Criteria

1. WHEN a screening risk score exceeds the alert threshold, THE Notification_Service SHALL send an SMS to the nearest hospital
2. WHEN a screening priority is "CRITICAL", THE Notification_Service SHALL initiate a voice call to the nearest hospital
3. THE Notification_Service SHALL use Twilio API for SMS and voice call delivery
4. THE Notification_Service SHALL include patient name, location, risk score, and timestamp in alert messages
5. WHEN Twilio API returns an error, THE Notification_Service SHALL log the error and return failure status without crashing
6. THE Database SHALL store notification delivery status and Twilio message SID in alert_events table
7. THE API_Server SHALL provide an endpoint to manually trigger alert notifications for a specific screening ID

### Requirement 5: Enhanced Screening Retrieval

**User Story:** As a healthcare provider, I want to retrieve individual screening details by ID, so that I can review specific assessment results.

#### Acceptance Criteria

1. THE API_Server SHALL provide an endpoint to retrieve a single screening by ID
2. WHEN a screening ID exists, THE API_Server SHALL return the complete screening record including face_payload, voice_payload, and features_payload
3. WHEN a screening ID does not exist, THE API_Server SHALL return HTTP 404 Not Found
4. THE API_Server SHALL include associated alert events in the screening response
5. WHEN retrieving a screening, THE API_Server SHALL return the nearest hospital information based on the screening location

### Requirement 6: Advanced Screening Search and Filtering

**User Story:** As a researcher, I want to search and filter screenings by multiple criteria, so that I can analyze specific patient cohorts.

#### Acceptance Criteria

1. THE API_Server SHALL support filtering screenings by patient name (partial match, case-insensitive)
2. THE API_Server SHALL support filtering screenings by location (partial match, case-insensitive)
3. THE API_Server SHALL support filtering screenings by risk score range (min and max values)
4. THE API_Server SHALL support filtering screenings by date range (start and end timestamps)
5. THE API_Server SHALL support filtering screenings by alert status (alerted or not alerted)
6. THE API_Server SHALL support filtering screenings by priority level (LOW, MEDIUM, HIGH, CRITICAL)
7. WHEN multiple filters are provided, THE API_Server SHALL apply all filters using AND logic
8. THE API_Server SHALL return filtered results with pagination support

### Requirement 7: Hospital Management

**User Story:** As a system administrator, I want to manage hospital records, so that the system has accurate facility information for emergency routing.

#### Acceptance Criteria

1. THE API_Server SHALL provide an endpoint to create new hospital records
2. THE API_Server SHALL provide an endpoint to update existing hospital records by ID
3. THE API_Server SHALL provide an endpoint to delete hospital records by ID
4. THE API_Server SHALL provide an endpoint to list all hospitals with pagination
5. WHEN creating or updating a hospital, THE API_Server SHALL validate that name, phone, address, and coordinates are provided
6. WHEN creating a hospital with duplicate name and location, THE API_Server SHALL return HTTP 409 Conflict
7. THE Database SHALL store hospital records with name, phone, address, latitude, longitude, and capabilities
8. THE API_Server SHALL support searching hospitals by name or location (partial match, case-insensitive)

### Requirement 8: Integration Testing Suite

**User Story:** As a developer, I want automated integration tests for all API endpoints, so that I can verify system behavior and prevent regressions.

#### Acceptance Criteria

1. THE Test_Suite SHALL test all API endpoints with valid inputs and verify expected responses
2. THE Test_Suite SHALL test all API endpoints with invalid inputs and verify appropriate error responses
3. THE Test_Suite SHALL verify database state changes after create, update, and delete operations
4. THE Test_Suite SHALL test authentication flows including login, token validation, and authorization
5. THE Test_Suite SHALL test notification delivery using Twilio test credentials
6. THE Test_Suite SHALL use a separate test database that is reset before each test run
7. THE Test_Suite SHALL achieve minimum 80% code coverage for route handlers and services
8. THE Test_Suite SHALL run in under 30 seconds for the complete suite

### Requirement 9: API Documentation

**User Story:** As a frontend developer, I want comprehensive API documentation, so that I can integrate with the backend without reading source code.

#### Acceptance Criteria

1. THE API_Server SHALL serve OpenAPI 3.0 specification at /api/docs/openapi.json
2. THE API_Server SHALL serve Swagger UI at /api/docs for interactive API exploration
3. THE OpenAPI_Specification SHALL document all endpoints with request schemas, response schemas, and status codes
4. THE OpenAPI_Specification SHALL document all authentication requirements using security schemes
5. THE OpenAPI_Specification SHALL include example requests and responses for each endpoint
6. THE OpenAPI_Specification SHALL document all error responses with error code descriptions
7. THE Swagger_UI SHALL allow users to test endpoints directly from the browser

### Requirement 10: Request Validation and Error Handling

**User Story:** As a backend developer, I want consistent request validation and error handling, so that API consumers receive clear, actionable error messages.

#### Acceptance Criteria

1. THE API_Server SHALL validate all request bodies against defined schemas before processing
2. WHEN request validation fails, THE API_Server SHALL return HTTP 400 Bad Request with field-specific error messages
3. WHEN a database query fails, THE API_Server SHALL return HTTP 500 Internal Server Error without exposing database details
4. WHEN a resource is not found, THE API_Server SHALL return HTTP 404 Not Found with a descriptive message
5. WHEN a user lacks permission for an operation, THE API_Server SHALL return HTTP 403 Forbidden
6. THE API_Server SHALL log all errors with timestamp, request ID, and stack trace for debugging
7. THE API_Server SHALL return errors in consistent JSON format with "error" and "detail" fields

### Requirement 11: Rate Limiting and Security

**User Story:** As a security engineer, I want rate limiting and security headers, so that the API is protected against abuse and common attacks.

#### Acceptance Criteria

1. THE API_Server SHALL limit requests to 100 per 15-minute window per IP address
2. WHEN rate limit is exceeded, THE API_Server SHALL return HTTP 429 Too Many Requests
3. THE API_Server SHALL set Content-Security-Policy header to prevent XSS attacks
4. THE API_Server SHALL set X-Frame-Options header to DENY to prevent clickjacking
5. THE API_Server SHALL set X-Content-Type-Options header to nosniff
6. THE API_Server SHALL set Strict-Transport-Security header for HTTPS connections
7. THE API_Server SHALL sanitize all user inputs to prevent SQL injection
8. THE API_Server SHALL validate JWT signatures using RS256 algorithm

### Requirement 12: Database Migrations and Schema Versioning

**User Story:** As a DevOps engineer, I want database migration management, so that schema changes can be applied consistently across environments.

#### Acceptance Criteria

1. THE Migration_System SHALL track applied migrations in a schema_migrations table
2. THE Migration_System SHALL apply migrations in sequential order based on timestamp prefixes
3. THE Migration_System SHALL support rollback of the most recent migration
4. WHEN a migration fails, THE Migration_System SHALL halt execution and log the error
5. THE Migration_System SHALL create the users table with username, password_hash, role, and timestamps
6. THE Migration_System SHALL add notification_status and twilio_message_sid columns to alert_events table
7. THE Migration_System SHALL create the hospitals table with name, phone, address, latitude, longitude, and capabilities

### Requirement 13: Health Check and Monitoring

**User Story:** As a site reliability engineer, I want detailed health checks, so that I can monitor system status and dependencies.

#### Acceptance Criteria

1. THE API_Server SHALL provide a /health/live endpoint that returns HTTP 200 if the server is running
2. THE API_Server SHALL provide a /health/ready endpoint that verifies database connectivity
3. WHEN the database is unreachable, THE /health/ready endpoint SHALL return HTTP 503 Service Unavailable
4. THE API_Server SHALL provide a /health/metrics endpoint returning request count, average response time, and error rate
5. THE /health/metrics endpoint SHALL return metrics for the last 5 minutes
6. THE API_Server SHALL log response times for all requests
7. WHEN response time exceeds 1000ms, THE API_Server SHALL log a warning

### Requirement 14: Configuration Management

**User Story:** As a deployment engineer, I want environment-based configuration, so that the application can run in development, staging, and production with different settings.

#### Acceptance Criteria

1. THE API_Server SHALL load configuration from environment variables
2. THE API_Server SHALL support .env files for local development
3. THE API_Server SHALL validate required environment variables on startup
4. WHEN a required environment variable is missing, THE API_Server SHALL log an error and exit with code 1
5. THE API_Server SHALL support configuration for database URL, JWT secret, Twilio credentials, and alert threshold
6. THE API_Server SHALL support configuration for CORS allowed origins
7. THE API_Server SHALL mask sensitive values (passwords, API keys) in logs

### Requirement 15: Audit Logging

**User Story:** As a compliance officer, I want audit logs for all data modifications, so that I can track who changed what and when for regulatory compliance.

#### Acceptance Criteria

1. THE API_Server SHALL log all create, update, and delete operations with user ID, timestamp, and affected resource
2. THE Database SHALL store audit logs in an audit_trail table
3. THE Audit_Trail SHALL include operation type, table name, record ID, old values, new values, and user ID
4. THE API_Server SHALL provide an endpoint to retrieve audit logs with filtering by date range, user, and operation type
5. WHEN retrieving audit logs, THE API_Server SHALL require admin role authorization
6. THE Audit_Trail SHALL retain logs for minimum 7 years
7. THE API_Server SHALL not log sensitive fields (password_hash) in audit trail
