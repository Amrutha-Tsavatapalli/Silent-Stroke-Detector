/**
 * Unit tests for security headers middleware
 */

import { jest } from '@jest/globals';
import { securityHeaders } from '../../src/middleware/securityHeaders.js';

describe('Security Headers Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      setHeader: jest.fn()
    };
    next = jest.fn();
  });

  test('should set Content-Security-Policy header to default-src self', () => {
    securityHeaders(req, res, next);
    
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      "default-src 'self'"
    );
  });

  test('should set X-Frame-Options header to DENY', () => {
    securityHeaders(req, res, next);
    
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Frame-Options',
      'DENY'
    );
  });

  test('should set X-Content-Type-Options header to nosniff', () => {
    securityHeaders(req, res, next);
    
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      'nosniff'
    );
  });

  test('should set Strict-Transport-Security header for HTTPS', () => {
    securityHeaders(req, res, next);
    
    expect(res.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  });

  test('should set X-XSS-Protection header to 1; mode=block', () => {
    securityHeaders(req, res, next);
    
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-XSS-Protection',
      '1; mode=block'
    );
  });

  test('should set all five security headers', () => {
    securityHeaders(req, res, next);
    
    expect(res.setHeader).toHaveBeenCalledTimes(5);
  });

  test('should call next middleware', () => {
    securityHeaders(req, res, next);
    
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  test('should set headers before calling next', () => {
    const callOrder = [];
    
    res.setHeader = jest.fn(() => callOrder.push('setHeader'));
    next = jest.fn(() => callOrder.push('next'));
    
    securityHeaders(req, res, next);
    
    expect(callOrder[callOrder.length - 1]).toBe('next');
    expect(callOrder.filter(call => call === 'setHeader').length).toBe(5);
  });
});
