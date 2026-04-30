import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SENTENCES } from '../data/sentences.js';
import { getSpeechScore, normaliseSpeechScore } from '../lib/speech.js';
import { loadBaseline } from '../lib/baseline.js';

const DEFAULT_BASELINE = 500000;

export default function SpeechCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('idle'); // idle, recording, processing, error, manual
  const [manualRating, setManualRating] = useState(0);
  const [error, setError] = useState(null);

  const { sessionId, language, faceScore, frameLogs } = location.state || {};
  const sentences = SENTENCES[language] || SENTENCES.en;
  const currentSentence = sentences[Math.floor(Math.random() * sentences.length)];

  useEffect(() => {
    if (!sessionId || faceScore === undefined) {
      navigate('/');
      return;
    }
  }, [sessionId, faceScore, navigate]);

  const handleStartRecording = async () => {
    setStatus('recording');

    try {
      const rawVariance = await getSpeechScore(8000);
      const baselineData = loadBaseline();
      const baseline = baselineData?.baseline || DEFAULT_BASELINE;
      const speechScore = normaliseSpeechScore(rawVariance, baseline);

      navigate('/arm', {
        state: {
          sessionId,
          language,
          faceScore,
          frameLogs,
          speechScore,
          rawVariance,
        },
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setStatus('manual');
      } else {
        setError('recording_failed');
        setStatus('error');
      }
    }
  };

  const handleManualRating = (rating) => {
    setManualRating(rating);
    // Map rating to score: 1→1.0, 2→0.75, 3→0.5, 4→0.25, 5→0.0
    const scoreMap = { 1: 1.0, 2: 0.75, 3: 0.5, 4: 0.25, 5: 0.0 };
    const speechScore = scoreMap[rating];

    navigate('/arm', {
      state: {
        sessionId,
        language,
        faceScore,
        frameLogs,
        speechScore,
        rawVariance: 0,
      },
    });
  };

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Recording Failed</h2>
          <p className="text-gray-600 mb-4">
            {error === 'recording_failed'
              ? 'Unable to record audio. Please try again.'
              : 'An error occurred during speech recording.'}
          </p>
          <button
            onClick={() => setStatus('manual')}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90"
          >
            Use Manual Rating
          </button>
        </div>
      </div>
    );
  }

  if (status === 'manual') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            Rate Speech Clarity
          </h2>
          <p className="text-gray-600 mb-6 text-center">
            How clearly did the person speak?
          </p>

          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => handleManualRating(rating)}
                className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                  manualRating === rating
                    ? 'border-brand bg-brand/5'
                    : 'border-gray-200 hover:border-brand/50'
                }`}
              >
                <span className="font-medium text-gray-700">
                  {rating}: {rating === 1 ? 'Very slurred' : rating === 5 ? 'Very clear' : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
          Speech Check
        </h2>

        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <p className="text-lg text-gray-700 text-center font-medium">
            "{currentSentence}"
          </p>
        </div>

        {status === 'idle' && (
          <button
            onClick={handleStartRecording}
            className="w-full py-3 bg-brand text-white rounded-lg font-medium hover:bg-brand/90 transition-colors"
          >
            Start Recording
          </button>
        )}

        {status === 'recording' && (
          <div className="text-center">
            <div className="animate-pulse mb-4">
              <div className="w-16 h-16 bg-red-500 rounded-full mx-auto flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
            <p className="text-gray-600">Recording... Speak the sentence above.</p>
          </div>
        )}

        {status === 'processing' && (
          <div className="text-center">
            <p className="text-gray-600">Processing audio...</p>
          </div>
        )}
      </div>

      <p className="mt-6 text-sm text-gray-500 text-center max-w-xs">
        The app will listen for 8 seconds. Please read the sentence clearly.
      </p>
    </div>
  );
}