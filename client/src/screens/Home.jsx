import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { createSession } from '../lib/api.js';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
];

export default function Home() {
  const navigate = useNavigate();
  const { setSessionId, setLanguage } = useSession();

  const handleLanguageSelect = async (langCode) => {
    setLanguage(langCode);

    // Try to create a session on the server
    const session = await createSession(langCode);

    if (session) {
      setSessionId(session.id);
      navigate('/scan', { state: { sessionId: session.id, language: langCode } });
    } else {
      // Offline: generate a local UUID
      const localId = crypto.randomUUID();
      setSessionId(localId);
      navigate('/scan', { state: { sessionId: localId, language: langCode, offline: true } });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-brand mb-2">FAST Check</h1>
        <p className="text-gray-600">Stroke detection in minutes</p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
          Select your language
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageSelect(lang.code)}
              className="flex flex-col items-center p-4 border-2 border-gray-200 rounded-lg hover:border-brand hover:bg-brand/5 transition-colors"
            >
              <span className="text-3xl mb-2">{lang.flag}</span>
              <span className="font-medium text-gray-700">{lang.name}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 text-sm text-gray-500 text-center max-w-xs">
        This is not a medical diagnosis. In case of emergency, call 108.
      </p>
    </div>
  );
}