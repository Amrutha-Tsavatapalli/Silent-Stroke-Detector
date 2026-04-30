import React, { createContext, useState, useContext } from 'react';

/**
 * SessionContext holds shared state across all FAST Check screens:
 * - sessionId: UUID returned by the backend (or locally generated when offline)
 * - language: selected language code ('en' | 'hi' | 'ta' | 'te')
 * - scores: accumulated scores from each check step
 */
export const SessionContext = createContext(null);

/**
 * SessionProvider wraps the app and provides session state to all screens.
 * Import and use `useSession()` in any screen to access or update session data.
 */
export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [language, setLanguage] = useState('en');
  const [scores, setScores] = useState({
    faceScore: null,
    speechScore: null,
    speechVariance: null,
    armScore: null,
    riskScore: null,
    riskLevel: null,
  });

  function updateScores(partial) {
    setScores((prev) => ({ ...prev, ...partial }));
  }

  const value = {
    sessionId,
    setSessionId,
    language,
    setLanguage,
    scores,
    updateScores,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Convenience hook — throws if used outside a SessionProvider.
 */
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}
