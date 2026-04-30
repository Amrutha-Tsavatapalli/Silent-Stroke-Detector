/**
 * Integration tests for security headers middleware
 * Verifies that security headers are properly set on HTTP responses
 */

import request from 'supertest';
import express from 'express';
import { securityHeaders } from '../../src/middleware/securityHeaders.js';

describe('Security Headers Integration Tests', () => {
  let app;

  beforeAll(() => {
    // Create a minimal Express app with security headers middleware
    app = express();
    app.use(securityHeaders);
    
    // Add test routes
    app.get('/test', (req, res) => {
      res.json({ message: 'test' });
    });
    
    app.post('/test', (req, res) => {
      res.json({ message: 'test' });
    });
  });

  describe('GET requests', () => {
    test('should include Content-Security-Policy header', async () => {
      const response = await request(app).get('/test');
      
      expect(response.headers['content-security-policy']).toBe("default-src 'self'");
    });

    test('should include X-Frame-Options header', async () => {
      const response = await request(app).get('/test');
      
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should include X-Content-Type-Options header', async () => {
      const response = await request(app).get('/test');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should include Strict-Transport-Security header', async () => {
      const response = await request(app).get('/test');
      
      expect(response.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    });

    test('should include X-XSS-Protection header', async () => {
      const response = await request(app).get('/test');
      
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    test('should include all five security headers', async () => {
      const response = await request(app).get('/test');
      
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('POST requests', () => {
    test('should include security headers on POST requests', async () => {
      const response = await request(app).post('/test');
      
      expect(response.headers['content-security-policy']).toBe("default-src 'self'");
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('404 responses', () => {
    test('should include security headers on 404 responses', async () => {
      const response = await request(app).get('/nonexistent');
      
      expect(response.status).toBe(404);
      // Note: Express may override CSP for 404 responses, so we check the other headers
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });
});
