import React, { createContext, useContext, useState } from 'react';

export const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [language, setLanguage] = useState('en');
  const [scores, setScores] = useState({
    faceScore: null,
    speechScore: null,
    armScore: null,
    rawVariance: null,
  });

  return (
    <SessionContext.Provider
      value={{ sessionId, setSessionId, language, setLanguage, scores, setScores }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
