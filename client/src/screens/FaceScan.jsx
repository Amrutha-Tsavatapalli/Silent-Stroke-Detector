import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaceMesh } from '@mediapipe/face_mesh';
import { getAsymmetryScore, aggregateFrameScores } from '../lib/asymmetry.js';
import { bulkInsertFrames } from '../lib/api.js';

const SCAN_DURATION_MS = 15000;
const MIN_VALID_FRAMES = 200;
const BATCH_INTERVAL_MS = 2000;

export default function FaceScan() {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceMeshRef = useRef(null);
  const frameLogsRef = useRef([]);
  const batchTimerRef = useRef(null);
  const startTimeRef = useRef(null);

  const [status, setStatus] = useState('initializing'); // initializing, scanning, processing, error
  const [frameCount, setFrameCount] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [error, setError] = useState(null);
  const [showSkipPrompt, setShowSkipPrompt] = useState(false);

  const { sessionId, language } = location.state || {};

  useEffect(() => {
    let mounted = true;

    async function initCamera() {
      try {
        // Request camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Initialize MediaPipe Face Mesh
        const faceMesh = new FaceMesh({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results) => {
          if (!mounted) return;

          const now = Date.now();
          const elapsed = now - startTimeRef.current;

          if (elapsed >= SCAN_DURATION_MS) {
            return; // Scan complete
          }

          // Draw to canvas
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

          // Process face
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            const rawScore = getAsymmetryScore(landmarks);

            frameLogsRef.current.push({
              frameTs: elapsed,
              rawScore,
              faceDetected: true,
            });

            setCurrentScore(rawScore);
            setFrameCount((c) => c + 1);
          } else {
            frameLogsRef.current.push({
              frameTs: elapsed,
              rawScore: 0,
              faceDetected: false,
            });
          }
        });

        faceMeshRef.current = faceMesh;

        // Start processing
        startTimeRef.current = Date.now();
        setStatus('scanning');

        // Batch upload every 2 seconds
        batchTimerRef.current = setInterval(async () => {
          if (sessionId && frameLogsRef.current.length > 0) {
            const framesToUpload = [...frameLogsRef.current];
            await bulkInsertFrames(sessionId, framesToUpload);
          }
        }, BATCH_INTERVAL_MS);

        // Process frames
        async function processFrame() {
          if (!mounted || !videoRef.current || !faceMeshRef.current) return;

          await faceMeshRef.current.send({ image: videoRef.current });

          const elapsed = Date.now() - startTimeRef.current;
          if (elapsed < SCAN_DURATION_MS) {
            requestAnimationFrame(processFrame);
          } else {
            // Scan complete
            clearInterval(batchTimerRef.current);
            setStatus('processing');

            const faceScore = aggregateFrameScores(frameLogsRef.current, MIN_VALID_FRAMES);

            if (faceScore === null) {
              setShowSkipPrompt(true);
            } else {
              navigate('/speech', {
                state: {
                  sessionId,
                  language,
                  faceScore,
                  frameLogs: frameLogsRef.current,
                },
              });
            }
          }
        }

        requestAnimationFrame(processFrame);
      } catch (err) {
        if (!mounted) return;
        if (err.name === 'NotAllowedError') {
          setError('camera_denied');
        } else {
          setError('initialization_failed');
        }
        setStatus('error');
      }
    }

    initCamera();

    return () => {
      mounted = false;
      if (batchTimerRef.current) {
        clearInterval(batchTimerRef.current);
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, [navigate, sessionId, language]);

  const handleSkip = () => {
    const faceScore = 0.5;
    navigate('/speech', {
      state: { sessionId, language, faceScore, frameLogs: [] },
    });
  };

  const handleRetry = () => {
    window.location.reload();
  };

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-4">
            {error === 'camera_denied' ? 'Camera Access Needed' : 'Initialization Failed'}
          </h2>
          <p className="text-gray-600 mb-4">
            {error === 'camera_denied'
              ? 'Please enable camera access in your browser settings to continue.'
              : 'Unable to initialize face detection. Please try again.'}
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleSkip}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Skip Face Check
            </button>
            {error === 'camera_denied' && (
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showSkipPrompt) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md text-center">
          <h2 className="text-xl font-semibold text-orange-600 mb-4">
            Face Not Clearly Visible
          </h2>
          <p className="text-gray-600 mb-4">
            We couldn't detect enough valid frames. Please position the face clearly in the
            camera and try again.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleSkip}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Skip Anyway
            </button>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
      <div className="relative">
        <video
          ref={videoRef}
          className="w-80 h-60 rounded-lg object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="absolute top-0 left-0 w-80 h-60 rounded-lg" />

        <div className="absolute top-2 left-2 bg-black/50 text-white px-3 py-1 rounded text-sm">
          {frameCount} frames
        </div>
        <div className="absolute top-2 right-2 bg-black/50 text-white px-3 py-1 rounded text-sm">
          Score: {currentScore.toFixed(4)}
        </div>
      </div>

      <div className="mt-4 text-white text-center">
        <p className="text-lg font-medium">
          {status === 'initializing'
            ? 'Initializing camera...'
            : status === 'scanning'
            ? 'Scanning face...'
            : 'Processing results...'}
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Keep the face centered in the frame
        </p>
      </div>
    </div>
  );
}