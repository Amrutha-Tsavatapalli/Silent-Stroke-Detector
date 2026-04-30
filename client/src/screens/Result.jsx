import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { computeRiskScore } from '../lib/fusion.js';
import { getNearestHospital } from '../lib/routing.js';
import { buildWhatsAppLink, buildCallLink } from '../lib/alert.js';
import { updateSession } from '../lib/api.js';

const RESULT_COPY = {
  FLAG: {
    heading: 'High Risk Detected',
    subheading: 'Please seek immediate medical attention.',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  WARN: {
    heading: 'Moderate Risk Detected',
    subheading: 'Please consult a doctor soon.',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  CLEAR: {
    heading: 'No Significant Signs Detected',
    subheading: 'Continue to monitor. Seek care if symptoms appear.',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
};

export default function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [manualDistrict, setManualDistrict] = useState('');

  const {
    sessionId,
    language,
    faceScore,
    speechScore,
    rawVariance,
    armScore,
  } = location.state || {};

  const result = computeRiskScore(faceScore, rawVariance, armScore);
  const copy = RESULT_COPY[result.level];

  useEffect(() => {
    if (faceScore === undefined || speechScore === undefined || armScore === undefined) {
      navigate('/');
      return;
    }

    // Update session on server
    if (sessionId) {
      updateSession(sessionId, {
        faceScore,
        speechScore,
        armScore,
        riskScore: result.score,
        riskLevel: result.level,
      });
    }

    // Navigate to AllClear if CLEAR
    if (result.level === 'CLEAR') {
      navigate('/allclear', { state: location.state });
      return;
    }

    // Get location and hospitals
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const hosp = await getNearestHospital(position.coords.latitude, position.coords.longitude);
          setHospitals(hosp);
        } catch {
          setHospitals([]);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLocationError(true);
        setLoading(false);
      }
    );
  }, [navigate, sessionId, faceScore, speechScore, rawVariance, armScore, result, location.state]);

  const handleManualLookup = async () => {
    setLoading(true);
    try {
      const hosp = await getNearestHospital(13.0827, 80.2707); // Default to Chennai
      setHospitals(hosp);
    } catch {
      setHospitals([]);
    }
    setLoading(false);
  };

  const topHospital = hospitals[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className={`max-w-md mx-auto rounded-lg ${copy.bgColor} p-6 mb-4`}>
        <h1 className={`text-2xl font-bold ${copy.color} mb-2`}>{copy.heading}</h1>
        <p className="text-gray-700">{copy.subheading}</p>
        <p className="text-sm text-gray-500 mt-2">Risk Score: {Math.round(result.score * 100)}%</p>
      </div>

      {locationError && (
        <div className="max-w-md mx-auto bg-white rounded-lg shadow p-4 mb-4">
          <p className="text-gray-600 mb-3">Unable to get your location automatically.</p>
          <input
            type="text"
            placeholder="Enter your district"
            value={manualDistrict}
            onChange={(e) => setManualDistrict(e.target.value)}
            className="w-full p-2 border rounded mb-3"
          />
          <button
            onClick={handleManualLookup}
            className="w-full py-2 bg-brand text-white rounded-lg"
          >
            Look Up Hospital
          </button>
        </div>
      )}

      {topHospital ? (
        <div className="max-w-md mx-auto bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold text-gray-800 mb-3">Nearest Hospital</h2>
          <div className="space-y-2">
            <p className="font-medium">{topHospital.name}</p>
            <p className="text-sm text-gray-600">{topHospital.district}, {topHospital.state}</p>
            <p className="text-sm text-gray-600">{topHospital.distance?.toFixed(1)} km away</p>
            <div className="flex gap-2 mt-2">
              {topHospital.hasCt && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">CT Available</span>
              )}
              {topHospital.hasThrombolysis && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Thrombolysis</span>
              )}
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">Tier {topHospital.tier}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <a
              href={buildWhatsAppLink(topHospital, result.score, topHospital.distance, language)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 bg-green-500 text-white text-center rounded-lg font-medium hover:bg-green-600"
            >
              Share via WhatsApp
            </a>
            <a
              href={buildCallLink(topHospital.emergencyPhone)}
              className="block w-full py-3 bg-blue-500 text-white text-center rounded-lg font-medium hover:bg-blue-600"
            >
              Call {topHospital.emergencyPhone}
            </a>
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto bg-white rounded-lg shadow p-4 mb-4 text-center">
          <p className="text-gray-600 mb-3">No hospitals found nearby.</p>
          <a
            href="tel:108"
            className="block w-full py-3 bg-red-500 text-white text-center rounded-lg font-medium hover:bg-red-600"
          >
            Call Emergency 108
          </a>
        </div>
      )}

      <div className="max-w-md mx-auto text-center">
        <button
          onClick={() => navigate('/')}
          className="text-brand hover:underline"
        >
          Start New Check
        </button>
      </div>
    </div>
  );
}