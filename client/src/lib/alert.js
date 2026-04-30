/**
 * Multilingual WhatsApp and call link builder for emergency alerts.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

/**
 * @typedef {'en' | 'hi' | 'ta' | 'te'} Language
 */

const MESSAGES = {
  en: {
    flag: (score, hospital, distance) =>
      `🚨 STROKE RISK ALERT: ${Math.round(score * 100)}% risk detected!\n\n` +
      `Nearest hospital: ${hospital.name}\n` +
      `Distance: ${distance.toFixed(1)} km\n` +
      `Emergency: ${hospital.emergencyPhone}\n\n` +
      `Please seek immediate medical attention!`,
    warn: (score, hospital, distance) =>
      `⚠️ STROKE RISK WARNING: ${Math.round(score * 100)}% risk detected.\n\n` +
      `Nearest hospital: ${hospital.name}\n` +
      `Distance: ${distance.toFixed(1)} km\n` +
      `Emergency: ${hospital.emergencyPhone}\n\n` +
      `Please consult a doctor soon.`,
  },
  hi: {
    flag: (score, hospital, distance) =>
      `🚨 स्ट्रोक जोखिम चेतावनी: ${Math.round(score * 100)}% जोखिम!\n\n` +
      `निकटतम अस्पताल: ${hospital.name}\n` +
      `दूरी: ${distance.toFixed(1)} किमी\n` +
      `आपातकालीन: ${hospital.emergencyPhone}\n\n` +
      `कृपया तुरंत चिकित्सा सहायता लें!`,
    warn: (score, hospital, distance) =>
      `⚠️ स्ट्रोक जोखिम चेतावनी: ${Math.round(score * 100)}% जोखिम।\n\n` +
      `निकटतम अस्पताल: ${hospital.name}\n` +
      `दूरी: ${distance.toFixed(1)} किमी\n` +
      `आपातकालीन: ${hospital.emergencyPhone}\n\n` +
      `कृपया जल्दी डॉक्टर से मिलें।`,
  },
  ta: {
    flag: (score, hospital, distance) =>
      `🚨 ஸ்ட்ரோக் ஆபத்து எச்சரிக்கை: ${Math.round(score * 100)}% ஆபத்து!\n\n` +
      `அருகிலுள்ள மருத்துவமனை: ${hospital.name}\n` +
      `தூரம்: ${distance.toFixed(1)} கி.மீ\n` +
      `அவசரநிலை: ${hospital.emergencyPhone}\n\n` +
      `தயவுசெய்து உடனடி மருத்துவ உதவியைப் பெறுங்கள்!`,
    warn: (score, hospital, distance) =>
      `⚠️ ஸ்ட்ரோக் ஆபத்து எச்சரிக்கை: ${Math.round(score * 100)}% ஆபத்து.\n\n` +
      `அருகிலுள்ள மருத்துவமனை: ${hospital.name}\n` +
      `தூரம்: ${distance.toFixed(1)} கி.மீ\n` +
      `அவசரநிலை: ${hospital.emergencyPhone}\n\n` +
      `தயவுசெய்து விரைவில் மருத்துவரைச் சந்திக்கவும்.`,
  },
  te: {
    flag: (score, hospital, distance) =>
      `🚨 స్ట్రోక్ ఆపద హెచ్చరకు: ${Math.round(score * 100)}% ప్రమాదం!\n\n` +
      `దగ్గరలో ఉన్న ఆసుపత్రి: ${hospital.name}\n` +
      `దూరం: ${distance.toFixed(1)} కి.می.\n` +
      `అత్యవసరం: ${hospital.emergencyPhone}\n\n` +
      `దయచేసి వెంటనే వైద్య సహాయం పొందండి!`,
    warn: (score, hospital, distance) =>
      `⚠️ స్ట్రోక్ ఆపద హెచ్చరకు: ${Math.round(score * 100)}% ప్రమాదం.\n\n` +
      `దగ్గరలో ఉన్న ఆసుపత్రి: ${hospital.name}\n` +
      `దూరం: ${distance.toFixed(1)} కి.می.\n` +
      `అత్యవసరం: ${hospital.emergencyPhone}\n\n` +
      `దయచేసి త్వరలో డాక్టర్‌ను కలిసుకోండి.`,
  },
};

/**
 * Builds a WhatsApp deep link with pre-filled multilingual emergency message.
 * @param {Object} hospital - Hospital object with name, distance, emergencyPhone
 * @param {number} riskScore - Computed risk score (0-1)
 * @param {number} distance - Distance to hospital in km
 * @param {Language} lang - Language code (default: 'en')
 * @returns {string} wa.me/?text=... URL
 */
export function buildWhatsAppLink(hospital, riskScore, distance, lang = 'en') {
  const langData = MESSAGES[lang] || MESSAGES.en;
  const isFlag = riskScore > 0.55;
  const message = isFlag
    ? langData.flag(riskScore, hospital, distance)
    : langData.warn(riskScore, hospital, distance);

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Builds a tel: link with whitespace stripped from phone number.
 * @param {string} phone - Phone number
 * @returns {string} tel: URI
 */
export function buildCallLink(phone) {
  return `tel:${phone.replace(/\s/g, '')}`;
}