/**
 * Authorization middleware factory that checks user roles
 * Creates middleware that verifies if the authenticated user has one of the allowed roles
 * 
 * Requirements: 1.7, 1.8
 * 
 * @param {...string} allowedRoles - Roles that are permitted to access the endpoint
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Only allow admin users
 * app.get('/api/admin', authenticate, authorize('admin'), handler);
 * 
 * @example
 * // Allow both admin and viewer users
 * app.get('/api/data', authenticate, authorize('admin', 'viewer'), handler);
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    // Check if user is authenticated (should be set by authenticate middleware)
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        detail: "Authentication required"
      });
    }
    
    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Forbidden",
        detail: `Access denied. Required role: ${allowedRoles.join(" or ")}`
      });
    }
    
    // User has permission, proceed to next middleware
    next();
  };
}
