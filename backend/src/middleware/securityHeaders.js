/**
 * Security Headers Middleware
 * Sets security-related HTTP headers to protect against common web vulnerabilities
 */

/**
 * Middleware that sets security headers on all responses
 * 
 * Headers set:
 * - Content-Security-Policy: Prevents XSS attacks by restricting resource loading
 * - X-Frame-Options: Prevents clickjacking by denying iframe embedding
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - Strict-Transport-Security: Enforces HTTPS connections
 * - X-XSS-Protection: Enables browser XSS filtering
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const securityHeaders = (req, res, next) => {
  // Prevent XSS attacks by restricting resource loading to same origin
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // Prevent clickjacking by denying iframe embedding
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enforce HTTPS for one year including subdomains
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Enable browser XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
};
