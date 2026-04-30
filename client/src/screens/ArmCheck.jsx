import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const INSTRUCTIONS = {
  en: {
    title: 'Arm Check',
    instruction: 'Ask the person to raise both arms equally.',
    both: 'Both raised equally',
    one: 'One arm droops',
  },
  hi: {
    title: 'बांह जांच',
    instruction: 'व्यक्ति से दोनों बांहें समान रूप से उठाने को कहें।',
    both: 'दोनों बांहें समान उठीं',
    one: 'एक बांह गिर गई',
  },
  ta: {
    title: 'கை சரிபார்ப்பு',
    instruction: 'நபர் இரு கைகளையும் சமமாக உயர்த்தும்படி கேட்கவும்.',
    both: 'இரு கைகளும் சமமாக உயர்ந்தன',
    one: 'ஒரு கை கீழே விழுந்தது',
  },
  te: {
    title: 'చేతి పరీక్ష',
    instruction: ' వ్యక్తి రెండు చేతులను సమానంగా లేపమని ask.',
    both: 'రెండు చేతులు సమానంగా లేచాయి',
    one: 'ఒక చేతి క్రింద పడింది',
  },
};

export default function ArmCheck() {
  const navigate = useNavigate();
  const location = useLocation();

  const { sessionId, language, faceScore, frameLogs, speechScore, rawVariance } =
    location.state || {};

  const text = INSTRUCTIONS[language] || INSTRUCTIONS.en;

  useEffect(() => {
    if (faceScore === undefined || speechScore === undefined) {
      navigate('/');
    }
  }, [faceScore, speechScore, navigate]);

  const handleArmTap = (armScore) => {
    navigate('/result', {
      state: {
        sessionId,
        language,
        faceScore,
        frameLogs,
        speechScore,
        rawVariance,
        armScore,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">
          {text.title}
        </h2>
        <p className="text-gray-600 mb-8 text-center">{text.instruction}</p>

        <div className="space-y-4">
          <button
            onClick={() => handleArmTap(0.0)}
            className="w-full py-6 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors text-lg"
          >
            ✓ {text.both}
          </button>

          <button
            onClick={() => handleArmTap(1.0)}
            className="w-full py-6 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors text-lg"
          >
            ✗ {text.one}
          </button>
        </div>
      </div>

      <p className="mt-8 text-sm text-gray-500 text-center max-w-xs">
        Ask the person to close their eyes and raise both arms with palms up for 10 seconds.
      </p>
    </div>
  );
}