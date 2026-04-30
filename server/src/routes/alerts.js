/**
 * Alerts Router - Automated alert webhook endpoints
 * 
 * Provides POST /api/alerts/send endpoint for sending emergency
 * alerts to hospitals and emergency contacts via WhatsApp/SMS.
 * 
 * Requirements: 6.1, 6.2, 6.3
 */

import { Router } from 'express';
import { sendAlert, getAlertServiceStatus } from '../services/alertService.js';
import db from '../db.js';

const router = Router();

/**
 * Validates the alert request payload.
 * 
 * @param {Object} body - Request body
 * @returns {Object} Validation result { valid: boolean, error?: string }
 */
function validateAlertRequest(body) {
  const { sessionId, hospitalId, emergencyPhone, riskScore, distance, language } = body;

  if (!sessionId) {
    return { valid: false, error: 'sessionId is required' };
  }

  if (!hospitalId && !emergencyPhone) {
    return { valid: false, error: 'At least one of hospitalId or emergencyPhone is required' };
  }

  if (riskScore === undefined || riskScore === null) {
    return { valid: false, error: 'riskScore is required' };
  }

  if (typeof riskScore !== 'number' || riskScore < 0 || riskScore > 1) {
    return { valid: false, error: 'riskScore must be a number between 0 and 1' };
  }

  if (distance !== undefined && (typeof distance !== 'number' || distance < 0)) {
    return { valid: false, error: 'distance must be a non-negative number' };
  }

  if (language && !['en', 'hi', 'ta', 'te'].includes(language)) {
    return { valid: false, error: 'language must be one of: en, hi, ta, te' };
  }

  return { valid: true };
}

/**
 * Fetches hospital details by ID.
 * 
 * @param {string} hospitalId - Hospital UUID
 * @returns {Promise<Object|null>} Hospital object or null if not found
 */
async function getHospitalById(hospitalId) {
  try {
    const result = await db(
      `SELECT id, name, state, district, lat, lng, emergency_phone, has_thrombolysis, has_ct, tier
       FROM hospitals WHERE id = $1`,
      [hospitalId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      state: row.state,
      district: row.district,
      lat: Number(row.lat),
      lng: Number(row.lng),
      emergencyPhone: row.emergency_phone,
      hasThrombolysis: row.has_thrombolysis,
      hasCt: row.has_ct,
      tier: row.tier,
    };
  } catch (error) {
    console.error('[AlertsRouter] Error fetching hospital:', error.message);
    return null;
  }
}

/**
 * POST /api/alerts/send
 * 
 * Sends an emergency alert to a hospital and/or emergency contact.
 * 
 * Request body:
 * {
 *   sessionId: string,        // UUID of the scan session
 *   hospitalId: string,       // UUID of the hospital (optional)
 *   emergencyPhone: string,   // Emergency contact phone number (optional)
 *   riskScore: number,        // Risk score 0-1
 *   distance: number,         // Distance to hospital in km (optional)
 *   language: string,         // Language code 'en'|'hi'|'ta'|'te' (default: 'en')
 *   lat: number,              // Patient latitude (optional)
 *   lng: number               // Patient longitude (optional)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   deliveryStatus: {
 *     hospitalWhatsapp: { success: boolean, messageId?: string, error?: string },
 *     hospitalSMS: { success: boolean, messageId?: string, error?: string },
 *     emergencyWhatsapp: { success: boolean, messageId?: string, error?: string },
 *     emergencySMS: { success: boolean, messageId?: string, error?: string }
 *   },
 *   serviceStatus: { whatsapp: boolean, twilio: boolean }
 * }
 */
router.post('/send', async (req, res) => {
  try {
    // Validate request body
    const validation = validateAlertRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { sessionId, hospitalId, emergencyPhone, riskScore, distance = 0, language = 'en', lat, lng } = req.body;

    // Verify session exists
    const sessionResult = await db('SELECT id FROM scan_sessions WHERE id = $1', [sessionId]);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get hospital details if hospitalId provided
    let hospital = null;
    if (hospitalId) {
      hospital = await getHospitalById(hospitalId);
      if (!hospital) {
        return res.status(404).json({ error: 'Hospital not found' });
      }
    }

    // Get alert service configuration status
    const serviceStatus = getAlertServiceStatus();

    // If no services are configured, return early with status
    if (!serviceStatus.whatsapp && !serviceStatus.twilio) {
      return res.status(200).json({
        success: false,
        message: 'Alert services not configured',
        deliveryStatus: {
          hospitalWhatsapp: { success: false, error: 'WhatsApp not configured' },
          hospitalSMS: { success: false, error: 'Twilio not configured' },
          emergencyWhatsapp: { success: false, error: 'WhatsApp not configured' },
          emergencySMS: { success: false, error: 'Twilio not configured' },
        },
        serviceStatus,
      });
    }

    // Send the alert
    const deliveryStatus = await sendAlert({
      hospital,
      emergencyPhone,
      riskScore,
      distance,
      language,
      lat,
      lng,
    });

    // Determine overall success
    const anySuccess = 
      deliveryStatus.hospitalWhatsapp?.success ||
      deliveryStatus.hospitalSMS?.success ||
      deliveryStatus.emergencyWhatsapp?.success ||
      deliveryStatus.emergencySMS?.success;

    res.status(200).json({
      success: anySuccess,
      deliveryStatus,
      serviceStatus,
    });
  } catch (error) {
    console.error('[AlertsRouter] Error sending alert:', error);
    res.status(500).json({ error: 'Failed to send alert', detail: error.message });
  }
});

/**
 * GET /api/alerts/status
 * 
 * Returns the configuration status of alert services.
 * 
 * Response:
 * {
 *   whatsapp: boolean,
 *   twilio: boolean
 * }
 */
router.get('/status', (req, res) => {
  const status = getAlertServiceStatus();
  res.status(200).json(status);
});

export default router;