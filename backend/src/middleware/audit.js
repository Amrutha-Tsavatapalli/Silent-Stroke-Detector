import { auditService } from "../services/auditService.js";

/**
 * Audit middleware that logs create, update, and delete operations
 * Requirements: 15.1
 * 
 * This middleware should be applied to routes that modify data
 * It captures the operation details and logs them to the audit trail
 * 
 * @param {string} tableName - Name of the table being modified
 * @param {string} operation - Operation type (CREATE, UPDATE, DELETE)
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Log hospital creation
 * router.post('/hospitals', authenticate, authorize('admin'), 
 *   auditMiddleware('hospitals', 'CREATE'), 
 *   handler
 * );
 */
export function auditMiddleware(tableName, operation) {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    // Override res.json to capture response data
    res.json = function (data) {
      // Only log if operation was successful (2xx status code)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Extract user ID from authenticated user
        const userId = req.user?.userId;

        if (userId) {
          // Determine record ID and values based on operation
          let recordId = null;
          let oldValues = null;
          let newValues = null;

          if (operation === "CREATE") {
            // For CREATE, get ID from response data
            recordId = data.id || data.hospitalId || data.screeningId;
            newValues = data;
          } else if (operation === "UPDATE") {
            // For UPDATE, get ID from params and values from request/response
            recordId = parseInt(req.params.id);
            oldValues = req.oldValues || null; // Should be set by route handler
            newValues = data;
          } else if (operation === "DELETE") {
            // For DELETE, get ID from params
            recordId = parseInt(req.params.id);
            oldValues = req.oldValues || null; // Should be set by route handler
          }

          // Log the operation asynchronously (don't block response)
          if (recordId) {
            auditService
              .logOperation(userId, operation, tableName, recordId, oldValues, newValues)
              .catch((error) => {
                console.error("Failed to log audit trail:", error.message);
              });
          }
        }
      }

      // Call original res.json with data
      return originalJson(data);
    };

    next();
  };
}

/**
 * Helper middleware to capture old values before update/delete operations
 * Should be used before the actual operation handler
 * 
 * @param {Function} fetchOldValues - Async function that fetches the old record
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.put('/hospitals/:id', authenticate, authorize('admin'),
 *   captureOldValues(async (req) => await getHospitalById(req.params.id)),
 *   auditMiddleware('hospitals', 'UPDATE'),
 *   handler
 * );
 */
export function captureOldValues(fetchOldValues) {
  return async (req, res, next) => {
    try {
      const oldValues = await fetchOldValues(req);
      req.oldValues = oldValues;
      next();
    } catch (error) {
      // If we can't fetch old values, continue anyway
      console.error("Failed to capture old values for audit:", error.message);
      next();
    }
  };
}
