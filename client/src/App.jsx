import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import { retryQueue } from './lib/api.js';
import { initializeSync } from './lib/sw-register.js';

const Home = lazy(() => import('./screens/Home'));
const FaceScan = lazy(() => import('./screens/FaceScan'));
const SpeechCheck = lazy(() => import('./screens/SpeechCheck'));
const ArmCheck = lazy(() => import('./screens/ArmCheck'));
const Result = lazy(() => import('./screens/Result'));
const AllClear = lazy(() => import('./screens/AllClear'));

export default function App() {
  useEffect(() => {
    // Retry queued session updates on app startup when online
    if (navigator.onLine) {
      retryQueue();
    }

    // Retry when connectivity is restored
    const handleOnline = () => retryQueue();
    window.addEventListener('online', handleOnline);

    // Initialize service worker and background sync
    initializeSync({ autoSync: true, registerPeriodic: true });

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <BrowserRouter>
      <SessionProvider>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-screen text-brand">
              Loading…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/scan" element={<FaceScan />} />
            <Route path="/speech" element={<SpeechCheck />} />
            <Route path="/arm" element={<ArmCheck />} />
            <Route path="/result" element={<Result />} />
            <Route path="/allclear" element={<AllClear />} />
          </Routes>
        </Suspense>
      </SessionProvider>
    </BrowserRouter>
  );
}
