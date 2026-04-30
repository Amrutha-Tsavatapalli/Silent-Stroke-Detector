/**
 * Alert Service - Automated alert webhooks for emergency notifications
 * 
 * Sends alerts via WhatsApp Business API with Twilio SMS fallback.
 * Used when a FLAG result is detected to notify emergency contacts
 * and nearest hospitals.
 * 
 * Requirements: 6.1, 6.2, 6.3
 */

import fetch from 'node-fetch';

// Environment variables
const WHATSAPP_BUSINESS_TOKEN = process.env.WHATSAPP_BUSINESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// WhatsApp API base URL
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Multilingual alert message templates
 */
const ALERT_MESSAGES = {
  en: {
    flag: (data) =>
      `🚨 STROKE EMERGENCY ALERT\n\n` +
      `Risk Score: ${Math.round(data.riskScore * 100)}%\n` +
      `Patient Location: ${data.lat?.toFixed(4)}, ${data.lng?.toFixed(4)}\n` +
      `Time: ${data.timestamp}\n\n` +
      `Nearest Hospital: ${data.hospitalName}\n` +
      `Distance: ${data.distance?.toFixed(1)} km\n` +
      `Hospital Phone: ${data.hospitalPhone}\n\n` +
      `URGENT: Please prepare to receive the patient immediately!`,
    warn: (data) =>
      `⚠️ STROKE RISK WARNING\n\n` +
      `Risk Score: ${Math.round(data.riskScore * 100)}%\n` +
      `Patient Location: ${data.lat?.toFixed(4)}, ${data.lng?.toFixed(4)}\n` +
      `Time: ${data.timestamp}\n\n` +
      `Nearest Hospital: ${data.hospitalName}\n` +
      `Distance: ${data.distance?.toFixed(1)} km\n` +
      `Hospital Phone: ${data.hospitalPhone}\n\n` +
      `Please advise patient to seek medical attention.`,
  },
  hi: {
    flag: (data) =>
      `🚨 स्ट्रोक आपातकालीन चेतावनी\n\n` +
      `जोखिम स्कोर: ${Math.round(data.riskScore * 100)}%\n` +
      `मरीज का स्थान: ${data.lat?.toFixed(4)}, ${data.lng?.toFixed(4)}\n` +
      `समय: ${data.timestamp}\n\n` +
      `निकटतम अस्पताल: ${data.hospitalName}\n` +
      `दूरी: ${data.distance?.toFixed(1)} किमी\n` +
      `अस्पताल फोन: ${data.hospitalPhone}\n\n` +
      `तुरंत: कृपया मरीज को तुरंत देखभाल के लिए तैयार करें!`,
    warn: (data) =>
      `⚠️ स्ट्रोक जोखिम चेतावनी\n\n` +
      `जोखिम स्कोर: ${Math.round(data.riskScore * 100)}%\n` +
      `मरीज का स्थान: ${data.lat?.toFixed(4)}, ${data.lng?.toFixed(4)}\n` +
      `समय: ${data.timestamp}\n\n` +
      `निकटतम अस्पताल: ${data.hospitalName}\n` +
      `दूरी: ${data.distance?.toFixed(1)} किमी\n` +
      `अस्पताल फोन: ${data.hospitalPhone}\n\n` +
      `कृपया मरीज को चिकित्सा सहायता लेने के लिए सलाह दें।`,
  },
  ta: {
    flag: (data) =>
      `🚨 ஸ்ட்ரோக் அவசரநிலை எச்சரிக்கை\n\n` +
      `ஆபத்து மதிப்பெண்: ${Math.round(data.riskScore * 100)}%\n` +
      `நோயாளி இடம்: ${data.lat?.toFixed(4)}, ${data.lng?.toFixed(4)}\n` +
      `நேரம்: ${data.timestamp}\n\n` +
      `அருகிலுள்ள மருத்துவமனை: ${data.hospitalName}\n` +
      `தூரம்: ${data.distance?.toFixed(1)} கி.மீ\n` +
      `மருத்துவமனை தொலைபேசி: ${data.hospitalPhone}\n\n` +
      `அவசரம்: தயவுசெய்து நோயாளியை உடனடியாகப் பராமரிக்கத் தயாராகுங்கள்!`,
    warn: (data) =>
      `⚠️ ஸ்ட்ரோக் ஆபத்து எச்சரிக்கை\n\n` +
      `ஆபத்து மதிப்பெண்: ${Math.round(data.riskScore * 100)}%\n` +
      `நோயாளி இடம்: ${data.lat?.toFixed(4)}, ${data.lng?.toFixed(4)}\n` +
      `நேரம்: ${data.timestamp}\n\n` +
      `அருகிலுள்ள மருத்துவமனை: ${data.hospitalName}\n` +
      `தூரம்: ${data.distance?.toFixed(1)} கி.மீ\n` +
      `மருத்துவமனை தொலைபேசி: ${data.hospitalPhone}\n\n` +
      `தயவுசெய்து நோயாளி மருத்துவ உதவியை நாடும்படி அறிவுறுத்துங்கள்.`,
  },
  te: {
    flag: (data) =>
      `🚨 స్ట్రోక్ అత్యవసరం హెచ్చరకు\n\n` +
      `ప్రమాదం స్కోరు: ${Math.round(data.riskScore * 100)}%\n` +
      `రోగిloc: ${data.lat?.toFixed(4)}, ${data.lng?.toFixed(4)}\n` +
      `సమయం: ${data.timestamp}\n\n` +
      `దగ్గరలో ఉన్న ఆసుపత్రి: ${data.hospitalName}\n` +
      `దూరం: ${data.distance?.toFixed(1)} కి.می.\n` +
      `ఆసుపత్రి ఫోన్: ${data.hospitalPhone}\n\n` +
      `అత్యవసరం: దయచేసి వెంటనే రోగిని చేరదిసేలా సిద్ధం చేయండి!`,
    warn: (data) =>
      `⚠️ స్ట్రోక్ ఆపద హెచ్చరకు\n\n` +
      `ప్రమాదం స్కోరు: ${Math.round(data.riskScore * 100)}%\n` +
      `రోగిloc: ${data.lat?.toFixed(4)}, ${data.lng?.toFixed(4)}\n` +
      `సమయం: ${data.timestamp}\n\n` +
      `దగ్గరలో ఉన్న ఆసుపత్రి: ${data.hospitalName}\n` +
      `దూరం: ${data.distance?.toFixed(1)} కి.می.\n` +
      `ఆసుపత్రి ఫోন: ${data.hospitalPhone}\n\n` +
      `దయచేసి రోగి వైద్య సహాయం పొందేలా చెబుతారు.`,
  },
};

/**
 * Builds a multilingual alert message for the given hospital and risk data.
 * 
 * @param {Object} hospital - Hospital object with name, emergencyPhone, distance
 * @param {number} riskScore - Computed risk score (0-1)
 * @param {number} distance - Distance to hospital in km
 * @param {string} lang - Language code ('en', 'hi', 'ta', 'te')
 * @param {number} lat - Patient latitude
 * @param {number} lng - Patient longitude
 * @returns {string} Formatted alert message
 */
export function buildAlertMessage(hospital, riskScore, distance, lang = 'en', lat, lng) {
  const langData = ALERT_MESSAGES[lang] || ALERT_MESSAGES.en;
  const isFlag = riskScore > 0.55;
  
  const data = {
    riskScore,
    hospitalName: hospital?.name || 'Unknown',
    hospitalPhone: hospital?.emergencyPhone || 'Unknown',
    distance,
    timestamp: new Date().toISOString(),
    lat,
    lng,
  };
  
  return isFlag ? langData.flag(data) : langData.warn(data);
}

/**
 * Sends a WhatsApp message via the WhatsApp Business API.
 * 
 * @param {string} phone - Recipient phone number (with country code, e.g., +1234567890)
 * @param {string} message - Message body to send
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendWhatsAppMessage(phone, message) {
  // Check if WhatsApp credentials are configured
  if (!WHATSAPP_BUSINESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('[AlertService] WhatsApp credentials not configured, skipping WhatsApp');
    return { success: false, error: 'WhatsApp not configured' };
  }

  try {
    const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_BUSINESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/^\+/, ''), // Remove + prefix if present
        type: 'text',
        text: { body: message },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[AlertService] WhatsApp API error:', data);
      return { success: false, error: data.error?.message || 'WhatsApp API error' };
    }

    console.log(`[AlertService] WhatsApp message sent to ${phone}`);
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error('[AlertService] WhatsApp send error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sends an SMS message via the Twilio API.
 * 
 * @param {string} phone - Recipient phone number (with country code, e.g., +1234567890)
 * @param {string} message - Message body to send
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendSMS(phone, message) {
  // Check if Twilio credentials are configured
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn('[AlertService] Twilio credentials not configured, skipping SMS');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        From: TWILIO_PHONE_NUMBER,
        Body: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[AlertService] Twilio API error:', data);
      return { success: false, error: data.message || 'Twilio API error' };
    }

    console.log(`[AlertService] SMS sent to ${phone}`);
    return { success: true, messageId: data.sid };
  } catch (error) {
    console.error('[AlertService] Twilio send error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sends an alert to both a hospital and emergency contact.
 * Tries WhatsApp first, falls back to SMS if WhatsApp fails.
 * 
 * @param {Object} options - Alert options
 * @param {Object} options.hospital - Hospital object with name, emergencyPhone, distance
 * @param {string} options.emergencyPhone - Emergency contact phone number
 * @param {number} options.riskScore - Computed risk score (0-1)
 * @param {number} options.distance - Distance to hospital in km
 * @param {string} options.language - Language code ('en', 'hi', 'ta', 'te')
 * @param {number} options.lat - Patient latitude
 * @param {number} options.lng - Patient longitude
 * @returns {Promise<{hospitalWhatsapp: *, hospitalSMS: *, emergencyWhatsapp: *, emergencySMS: *}>}
 */
export async function sendAlert({ hospital, emergencyPhone, riskScore, distance, language = 'en', lat, lng }) {
  // Build the alert message
  const message = buildAlertMessage(hospital, riskScore, distance, language, lat, lng);
  
  const results = {
    hospitalWhatsapp: null,
    hospitalSMS: null,
    emergencyWhatsapp: null,
    emergencySMS: null,
  };

  // Send to hospital
  if (hospital?.emergencyPhone) {
    // Try WhatsApp first
    const hospitalWhatsappResult = await sendWhatsAppMessage(hospital.emergencyPhone, message);
    results.hospitalWhatsapp = hospitalWhatsappResult;
    
    // Fall back to SMS if WhatsApp failed
    if (!hospitalWhatsappResult.success) {
      const hospitalSMSResult = await sendSMS(hospital.emergencyPhone, message);
      results.hospitalSMS = hospitalSMSResult;
    }
  }

  // Send to emergency contact
  if (emergencyPhone) {
    // Try WhatsApp first
    const emergencyWhatsappResult = await sendWhatsAppMessage(emergencyPhone, message);
    results.emergencyWhatsapp = emergencyWhatsappResult;
    
    // Fall back to SMS if WhatsApp failed
    if (!emergencyWhatsappResult.success) {
      const emergencySMSResult = await sendSMS(emergencyPhone, message);
      results.emergencySMS = emergencySMSResult;
    }
  }

  return results;
}

/**
 * Checks if alert service is properly configured.
 * 
 * @returns {Object} Configuration status
 */
export function getAlertServiceStatus() {
  return {
    whatsapp: !!(WHATSAPP_BUSINESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID),
    twilio: !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER),
  };
}

export default {
  buildAlertMessage,
  sendWhatsAppMessage,
  sendSMS,
  sendAlert,
  getAlertServiceStatus,
};