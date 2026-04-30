import twilio from "twilio";
import { config } from "../config.js";
import { query } from "../db.js";

/**
 * NotificationService handles SMS and voice call alerts via Twilio
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export class NotificationService {
  constructor() {
    // Initialize Twilio client if credentials are available
    if (
      config.twilioAccountSid &&
      config.twilioAuthToken &&
      config.twilioPhoneNumber
    ) {
      this.client = twilio(config.twilioAccountSid, config.twilioAuthToken);
      this.fromNumber = config.twilioPhoneNumber;
    } else {
      console.warn(
        "Twilio credentials not configured. Notification service will run in mock mode."
      );
      this.client = null;
    }
  }

  /**
   * Sends an SMS alert for a high-risk screening
   * @param {Object} screening - Screening data with patient info and risk score
   * @param {Object} hospital - Hospital data with phone number
   * @returns {Promise<Object>} Result with success status and message SID
   */
  async sendSmsAlert(screening, hospital) {
    const message = this._formatAlertMessage(screening, hospital);

    try {
      if (!this.client) {
        // Mock mode - log message instead of sending
        console.log("MOCK SMS ALERT:", {
          to: hospital.phone,
          message,
        });
        return {
          success: true,
          messageSid: "MOCK_SID_" + Date.now(),
          status: "sent",
        };
      }

      // Send SMS via Twilio
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: hospital.phone,
      });

      console.log(`SMS alert sent successfully. SID: ${result.sid}`);

      return {
        success: true,
        messageSid: result.sid,
        status: result.status,
      };
    } catch (error) {
      console.error("Failed to send SMS alert:", error.message);

      return {
        success: false,
        messageSid: null,
        status: "failed",
        error: error.message,
      };
    }
  }

  /**
   * Initiates a voice call alert for critical priority screenings
   * @param {Object} screening - Screening data with patient info and risk score
   * @param {Object} hospital - Hospital data with phone number
   * @returns {Promise<Object>} Result with success status and call SID
   */
  async initiateVoiceCall(screening, hospital) {
    const message = this._formatAlertMessage(screening, hospital);

    try {
      if (!this.client) {
        // Mock mode - log call instead of making it
        console.log("MOCK VOICE CALL:", {
          to: hospital.phone,
          message,
        });
        return {
          success: true,
          messageSid: "MOCK_CALL_SID_" + Date.now(),
          status: "initiated",
        };
      }

      // Initiate voice call via Twilio with TwiML
      const twiml = `<Response><Say voice="alice">${message}</Say></Response>`;

      const result = await this.client.calls.create({
        twiml,
        from: this.fromNumber,
        to: hospital.phone,
      });

      console.log(`Voice call initiated successfully. SID: ${result.sid}`);

      return {
        success: true,
        messageSid: result.sid,
        status: result.status,
      };
    } catch (error) {
      console.error("Failed to initiate voice call:", error.message);

      return {
        success: false,
        messageSid: null,
        status: "failed",
        error: error.message,
      };
    }
  }

  /**
   * Triggers alert notification for a specific screening
   * Sends SMS for high-risk screenings, voice call for critical priority
   * @param {number} screeningId - Screening ID
   * @returns {Promise<Object>} Result with success status and notification details
   */
  async triggerAlertForScreening(screeningId) {
    try {
      // Fetch screening data
      const screeningResult = await query(
        `
        SELECT id, patient_name, location, risk_score, priority, created_at,
               fusion, alert
        FROM screenings
        WHERE id = $1
      `,
        [screeningId]
      );

      if (screeningResult.rows.length === 0) {
        const error = new Error("Screening not found");
        error.statusCode = 404;
        throw error;
      }

      const screening = screeningResult.rows[0];

      // Find nearest hospital based on location
      // For now, we'll use a simple query to get any hospital
      // In production, this should use geolocation
      const hospitalResult = await query(
        `
        SELECT id, name, phone, address, latitude, longitude
        FROM hospitals
        LIMIT 1
      `
      );

      if (hospitalResult.rows.length === 0) {
        throw new Error("No hospitals available in database");
      }

      const hospital = hospitalResult.rows[0];

      // Determine notification type based on priority
      let notificationResult;
      if (screening.priority === "CRITICAL") {
        notificationResult = await this.initiateVoiceCall(screening, hospital);
      } else {
        notificationResult = await this.sendSmsAlert(screening, hospital);
      }

      // Store notification status in alert_events table
      await this._storeNotificationStatus(
        screeningId,
        notificationResult.messageSid,
        notificationResult.status,
        notificationResult.error
      );

      return {
        success: notificationResult.success,
        messageSid: notificationResult.messageSid,
        status: notificationResult.status,
        hospital: {
          name: hospital.name,
          phone: hospital.phone,
        },
        notificationType:
          screening.priority === "CRITICAL" ? "voice_call" : "sms",
      };
    } catch (error) {
      console.error(
        `Failed to trigger alert for screening ${screeningId}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Formats alert message with patient info and risk details
   * @private
   */
  _formatAlertMessage(screening, hospital) {
    const timestamp = new Date(screening.created_at).toLocaleString();
    const riskScore = (screening.risk_score * 100).toFixed(1);

    return `STROKE ALERT: Patient ${screening.patient_name} at ${screening.location} has high stroke risk (${riskScore}%). Priority: ${screening.priority}. Time: ${timestamp}. Please respond immediately.`;
  }

  /**
   * Stores notification delivery status in alert_events table
   * @private
   */
  async _storeNotificationStatus(
    screeningId,
    messageSid,
    status,
    errorMessage
  ) {
    try {
      await query(
        `
        INSERT INTO alert_events (
          screening_id, 
          notification_status, 
          twilio_message_sid, 
          error_message,
          created_at
        )
        VALUES ($1, $2, $3, $4, NOW())
      `,
        [screeningId, status, messageSid, errorMessage || null]
      );
    } catch (error) {
      console.error("Failed to store notification status:", error.message);
      // Don't throw - notification was sent, just logging failed
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
