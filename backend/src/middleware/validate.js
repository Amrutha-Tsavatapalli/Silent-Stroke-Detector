/**
 * Validation middleware factory that validates request bodies against Joi schemas
 * 
 * Requirements: 10.1, 10.2
 * 
 * @param {Object} schema - Joi schema to validate against
 * @returns {Function} Express middleware function
 * 
 * @example
 * import Joi from 'joi';
 * 
 * const loginSchema = Joi.object({
 *   username: Joi.string().required(),
 *   password: Joi.string().required()
 * });
 * 
 * app.post('/api/auth/login', validate(loginSchema), handler);
 */
export function validate(schema) {
  return (req, res, next) => {
    // Validate request body against schema
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Collect all errors, not just the first one
      stripUnknown: true, // Remove unknown fields (reject unexpected fields)
      presence: "required" // Make all fields required by default unless marked optional
    });
    
    if (error) {
      // Extract field-specific error messages
      const fields = {};
      error.details.forEach((detail) => {
        const fieldName = detail.path.join(".");
        fields[fieldName] = detail.message;
      });
      
      return res.status(400).json({
        error: "Bad Request",
        detail: "Request validation failed",
        fields
      });
    }
    
    // Replace req.body with validated and sanitized value
    req.body = value;
    
    next();
  };
}
