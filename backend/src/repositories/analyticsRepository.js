import { query } from "../db.js";

/**
 * AnalyticsRepository handles aggregate queries for screening analytics
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

/**
 * Gets daily screening counts for a date range
 * Excludes demo and test data
 * @param {string} startDate - Start date (ISO format)
 * @param {string} endDate - End date (ISO format)
 * @returns {Promise<Array>} Array of {date, count} objects
 */
export async function getDailyScreeningCounts(startDate, endDate) {
  const result = await query(
    `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM screenings
      WHERE created_at >= $1 
        AND created_at <= $2
        AND (scenario_label IS NULL OR (scenario_label != 'demo' AND scenario_label != 'test'))
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
    [startDate, endDate]
  );

  return result.rows;
}

/**
 * Gets average risk scores grouped by location
 * Excludes demo and test data
 * @param {string} startDate - Start date (ISO format)
 * @param {string} endDate - End date (ISO format)
 * @returns {Promise<Array>} Array of {location, avg_risk_score, screening_count} objects
 */
export async function getAverageRiskByLocation(startDate, endDate) {
  const result = await query(
    `
      SELECT 
        location,
        AVG(risk_score) as avg_risk_score,
        COUNT(*) as screening_count
      FROM screenings
      WHERE created_at >= $1 
        AND created_at <= $2
        AND (scenario_label IS NULL OR (scenario_label != 'demo' AND scenario_label != 'test'))
      GROUP BY location
      ORDER BY avg_risk_score DESC
    `,
    [startDate, endDate]
  );

  return result.rows;
}

/**
 * Calculates alert rate percentage (alerts triggered / total screenings)
 * Excludes demo and test data
 * @param {string} startDate - Start date (ISO format)
 * @param {string} endDate - End date (ISO format)
 * @returns {Promise<Object>} Object with {alert_rate, total_screenings, total_alerts}
 */
export async function getAlertRate(startDate, endDate) {
  const result = await query(
    `
      SELECT 
        COUNT(*) as total_screenings,
        SUM(CASE WHEN should_alert = true THEN 1 ELSE 0 END) as total_alerts,
        CASE 
          WHEN COUNT(*) > 0 THEN 
            (SUM(CASE WHEN should_alert = true THEN 1 ELSE 0 END)::float / COUNT(*)::float) * 100
          ELSE 0
        END as alert_rate
      FROM screenings
      WHERE created_at >= $1 
        AND created_at <= $2
        AND (scenario_label IS NULL OR (scenario_label != 'demo' AND scenario_label != 'test'))
    `,
    [startDate, endDate]
  );

  const row = result.rows[0];
  return {
    alert_rate: parseFloat(row.alert_rate) || 0,
    total_screenings: parseInt(row.total_screenings, 10),
    total_alerts: parseInt(row.total_alerts, 10),
  };
}

/**
 * Gets top N locations with highest average risk scores
 * Excludes demo and test data
 * @param {number} limit - Number of top locations to return
 * @param {string} startDate - Start date (ISO format)
 * @param {string} endDate - End date (ISO format)
 * @returns {Promise<Array>} Array of {location, avg_risk_score, screening_count} objects
 */
export async function getTopRiskLocations(limit, startDate, endDate) {
  const result = await query(
    `
      SELECT 
        location,
        AVG(risk_score) as avg_risk_score,
        COUNT(*) as screening_count
      FROM screenings
      WHERE created_at >= $1 
        AND created_at <= $2
        AND (scenario_label IS NULL OR (scenario_label != 'demo' AND scenario_label != 'test'))
      GROUP BY location
      ORDER BY avg_risk_score DESC
      LIMIT $3
    `,
    [startDate, endDate, limit]
  );

  return result.rows;
}
