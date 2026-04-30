import { useNavigate, useLocation } from 'react-router-dom';
import { submitFeedback } from '../lib/api.js';

export default function AllClear() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = location.state || {};

  const handleFeedback = async (wasStroke) => {
    if (sessionId) {
      await submitFeedback(sessionId, wasStroke);
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md text-center">
        <div className="text-6xl mb-4">✓</div>
        <h1 className="text-2xl font-bold text-green-600 mb-4">
          No Significant Signs Detected
        </h1>
        <p className="text-gray-600 mb-6">
          The FAST check did not detect significant signs of stroke. However, if symptoms
          appear or worsen, seek medical attention immediately.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-brand text-white rounded-lg font-medium hover:bg-brand/90"
          >
            Check Again
          </button>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-500 mb-3">Was this assessment accurate?</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleFeedback(true)}
                className="flex-1 py-2 border-2 border-red-200 text-red-600 rounded-lg hover:bg-red-50"
              >
                It was a stroke
              </button>
              <button
                onClick={() => handleFeedback(false)}
                className="flex-1 py-2 border-2 border-green-200 text-green-600 rounded-lg hover:bg-green-50"
              >
                Not a stroke
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-8 text-sm text-gray-500 text-center max-w-xs">
        This is not a medical diagnosis. In case of emergency, call 108.
      </p>
    </div>
  );
}