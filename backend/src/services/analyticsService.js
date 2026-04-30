import * as analyticsRepository from "../repositories/analyticsRepository.js";

/**
 * AnalyticsService orchestrates analytics computations
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7
 */
export class AnalyticsService {
  /**
   * Gets comprehensive analytics summary for a date range
   * @param {string} startDate - Start date (ISO format)
   * @param {string} endDate - End date (ISO format)
   * @returns {Promise<Object>} Analytics summary with daily counts, risk by location, alert rate, and top locations
   * @throws {Error} If date range exceeds 365 days
   */
  async getAnalyticsSummary(startDate, endDate) {
    // Validate date range doesn't exceed 365 days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    if (daysDiff > 365) {
      const error = new Error("Date range cannot exceed 365 days");
      error.statusCode = 400;
      throw error;
    }

    if (daysDiff < 0) {
      const error = new Error("Start date must be before end date");
      error.statusCode = 400;
      throw error;
    }

    // Fetch all analytics data in parallel
    const [dailyCounts, avgRiskByLocation, alertRate, topRiskLocations] =
      await Promise.all([
        analyticsRepository.getDailyScreeningCounts(startDate, endDate),
        analyticsRepository.getAverageRiskByLocation(startDate, endDate),
        analyticsRepository.getAlertRate(startDate, endDate),
        analyticsRepository.getTopRiskLocations(5, startDate, endDate),
      ]);

    return {
      dateRange: {
        startDate,
        endDate,
        days: daysDiff,
      },
      dailyCounts,
      avgRiskByLocation,
      alertRate,
      topRiskLocations,
    };
  }

  /**
   * Gets daily screening counts
   * @param {string} startDate - Start date (ISO format)
   * @param {string} endDate - End date (ISO format)
   * @returns {Promise<Array>} Daily screening counts
   */
  async getDailyScreeningCounts(startDate, endDate) {
    return analyticsRepository.getDailyScreeningCounts(startDate, endDate);
  }

  /**
   * Gets average risk scores by location
   * @param {string} startDate - Start date (ISO format)
   * @param {string} endDate - End date (ISO format)
   * @returns {Promise<Array>} Average risk by location
   */
  async getAverageRiskByLocation(startDate, endDate) {
    return analyticsRepository.getAverageRiskByLocation(startDate, endDate);
  }

  /**
   * Gets alert rate percentage
   * @param {string} startDate - Start date (ISO format)
   * @param {string} endDate - End date (ISO format)
   * @returns {Promise<Object>} Alert rate statistics
   */
  async getAlertRate(startDate, endDate) {
    return analyticsRepository.getAlertRate(startDate, endDate);
  }

  /**
   * Gets top risk locations
   * @param {number} limit - Number of locations to return
   * @param {string} startDate - Start date (ISO format)
   * @param {string} endDate - End date (ISO format)
   * @returns {Promise<Array>} Top risk locations
   */
  async getTopRiskLocations(limit, startDate, endDate) {
    return analyticsRepository.getTopRiskLocations(limit, startDate, endDate);
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
