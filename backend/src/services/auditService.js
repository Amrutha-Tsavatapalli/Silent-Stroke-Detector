import { query } from "../db.js";

/**
 * AuditService handles audit trail logging for compliance
 * Requirements: 15.1, 15.3, 15.7
 */
export class AuditService {
  /**
   * Logs an operation to the audit trail
   * @param {number} userId - User ID performing the operation
   * @param {string} operation - Operation type (CREATE, UPDATE, DELETE)
   * @param {string} tableName - Name of the table affected
   * @param {number} recordId - ID of the affected record
   * @param {Object} oldValues - Old values (for UPDATE and DELETE)
   * @param {Object} newValues - New values (for CREATE and UPDATE)
   * @returns {Promise<Object>} Created audit log entry
   */
  async logOperation(
    userId,
    operation,
    tableName,
    recordId,
    oldValues = null,
    newValues = null
  ) {
    // Mask sensitive fields before storing
    const maskedOldValues = oldValues ? this._maskSensitiveFields(oldValues) : null;
    const maskedNewValues = newValues ? this._maskSensitiveFields(newValues) : null;

    const result = await query(
      `
        INSERT INTO audit_trail (
          user_id, 
          operation, 
          table_name, 
          record_id, 
          old_values, 
          new_values, 
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, user_id, operation, table_name, record_id, old_values, new_values, created_at
      `,
      [
        userId,
        operation,
        tableName,
        recordId,
        maskedOldValues ? JSON.stringify(maskedOldValues) : null,
        maskedNewValues ? JSON.stringify(maskedNewValues) : null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Retrieves audit logs with optional filters
   * @param {Object} filters - Filter options
   * @param {string} filters.startDate - Start date for filtering
   * @param {string} filters.endDate - End date for filtering
   * @param {number} filters.userId - User ID to filter by
   * @param {string} filters.operation - Operation type to filter by
   * @param {string} filters.tableName - Table name to filter by
   * @param {number} limit - Maximum number of records to return
   * @param {number} offset - Number of records to skip
   * @returns {Promise<Object>} Object with items array and total count
   */
  async getAuditLogs(filters = {}, limit = 50, offset = 0) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // Build WHERE clause based on filters
    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(filters.endDate);
    }

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }

    if (filters.operation) {
      conditions.push(`operation = $${paramIndex++}`);
      values.push(filters.operation);
    }

    if (filters.tableName) {
      conditions.push(`table_name = $${paramIndex++}`);
      values.push(filters.tableName);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get audit logs
    values.push(limit, offset);
    const result = await query(
      `
        SELECT 
          id, user_id, operation, table_name, record_id, 
          old_values, new_values, created_at
        FROM audit_trail
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `,
      values
    );

    // Get total count
    const countResult = await query(
      `
        SELECT COUNT(*) as total
        FROM audit_trail
        ${whereClause}
      `,
      values.slice(0, -2) // Remove limit and offset from count query
    );

    return {
      items: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  /**
   * Masks sensitive fields in audit log data
   * @private
   * @param {Object} data - Data object to mask
   * @returns {Object} Data with sensitive fields masked
   */
  _maskSensitiveFields(data) {
    if (!data || typeof data !== "object") {
      return data;
    }

    const masked = { ...data };
    const sensitiveFields = [
      "password",
      "password_hash",
      "passwordHash",
      "token",
      "secret",
      "auth_token",
      "authToken",
    ];

    for (const key of Object.keys(masked)) {
      if (
        sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))
      ) {
        masked[key] = "***MASKED***";
      }
    }

    return masked;
  }
}

// Export singleton instance
export const auditService = new AuditService();
