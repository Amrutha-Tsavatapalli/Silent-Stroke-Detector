/**
 * Global test setup file
 * This file runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long-for-testing';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/silent_stroke_detector_test';
process.env.TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Twilio test account SID format
process.env.TWILIO_AUTH_TOKEN = 'test-auth-token-xxxxxxxxxxxxxxxx';
process.env.TWILIO_PHONE_NUMBER = '+15005550006'; // Twilio test number
process.env.ALERT_THRESHOLD = '0.7';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
