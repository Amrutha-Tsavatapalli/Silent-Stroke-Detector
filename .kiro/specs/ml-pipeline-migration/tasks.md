# Implementation Plan: ML Pipeline Migration

## Overview

Migrate the FAST Check stroke detection app from a Python server-side architecture to a browser-first PWA. The implementation proceeds in six phases: (1) hospital data and backend schema, (2) Node.js server migration, (3) React PWA scaffold, (4) core detection lib modules with property tests, (5) screen components wired to the lib layer, and (6) PWA offline capability and final integration. The Python FastAPI and Streamlit tools are left untouched throughout.

## Tasks

- [x] 1. Update hospital data and prepare static fallback
  - [x] 1.1 Enrich `data/hospitals.json` with new fields
    - Add `lat`, `lng`, `hasThrombolysis`, `hasCt`, `tier`, `state`, `district`, `emergencyPhone` fields to every entry in `data/hospitals.json`
    - Remove the old `lon` key (rename to `lng`) and `city` key (replace with `state` + `district`)
    - Ensure at least one entry has `hasThrombolysis: true` and `tier: 1` for routing tests
    - _Requirements: 8.7, 5.4_

  - [x] 1.2 Copy enriched JSON to `client/public/hospitals.json`
    - Create `client/public/hospitals.json` as a copy of the updated `data/hospitals.json`
    - This file is the offline fallback served by the service worker
    - _Requirements: 7.1, 5.9_

- [x] 2. Node.js backend migration (`server/`)
  - [x] 2.1 Scaffold `server/` directory and install dependencies
    - Create `server/package.json` with `express`, `pg`, `cors`, `express-rate-limit`, `dotenv` as dependencies and `vitest` as a dev dependency
    - Set `"type": "module"` in package.json
    - Create `server/.env.example` with `DATABASE_URL`, `PORT`, `FRONTEND_ORIGIN` placeholders
    - Create `server/src/index.js` as the Express entry point (no routes yet)
    - _Requirements: 9.1_

  - [x] 2.2 Write new PostgreSQL schema (`server/prisma/schema.sql`)
    - Create `server/prisma/schema.sql` with `scan_sessions`, `frame_logs`, `hospitals`, `feedback` tables exactly as specified in the design
    - Add CHECK constraints: `language IN ('en','hi','ta','te')`, `risk_level IN ('CLEAR','WARN','FLAG')`, score columns in `[0,1]`, `frame_ts >= 0`, `lat` in `[-90,90]`, `lng` in `[-180,180]`, `tier IN (1,2,3)`
    - Add indexes: `idx_frame_logs_session` on `frame_logs(session_id)`, `idx_hospitals_location` on `hospitals(lat, lng)`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12_

  - [x] 2.3 Write migration SQL from old schema to new schema
    - Create `server/prisma/migrate.sql` that reads from `screenings` and `alert_events` and inserts into `scan_sessions`
    - Map: `screenings.location → district`, `screenings.risk_score → risk_score`, `screenings.decision → risk_level`, `screenings.should_alert → alert_sent`; drop `patient_name`, `scenario_label`, `face_payload`, `voice_payload`, `features_payload`
    - Map: `alert_events.hospital_name` → look up `hospitals.id` by name and set `hospital_id`
    - _Requirements: 8.1, 8.12_

  - [x] 2.4 Write hospital seed script
    - Create `server/prisma/seed.js` that reads `data/hospitals.json` and bulk-inserts into the `hospitals` table using `pg`
    - Skip rows that already exist (upsert by name + district)
    - _Requirements: 8.7_

  - [x] 2.5 Implement `server/src/db.js` connection pool
    - Create a `pg.Pool` instance configured from `DATABASE_URL` env var
    - Export a `query(text, params)` helper
    - _Requirements: 9.1_

  - [x] 2.6 Implement sessions routes (`server/src/routes/sessions.js`)
    - `POST /api/sessions` — insert into `scan_sessions`, return `{ id, createdAt }` with HTTP 201
    - `PATCH /api/sessions/:id` — update score fields; return HTTP 204; return HTTP 404 if session not found
    - `POST /api/sessions/:id/frames` — bulk-insert `frames` array into `frame_logs`; return HTTP 201; return HTTP 404 if session not found
    - Validate `language` on POST; validate score ranges on PATCH; validate `frameTs >= 0` on frame insert
    - _Requirements: 9.1, 9.2, 9.3, 9.6_

  - [x] 2.7 Implement hospitals route (`server/src/routes/hospitals.js`)
    - `GET /api/hospitals/nearest?lat&lng` — query all hospitals, compute Haversine distance and `sortScore = distance * (has_thrombolysis ? 1 : 4)` in JS, return top 3 sorted ascending by `sortScore`
    - Return HTTP 400 if `lat` or `lng` are missing or out of range
    - _Requirements: 9.4, 5.1, 5.4, 5.6, 5.7_

  - [x] 2.8 Implement feedback route (`server/src/routes/feedback.js`)
    - `POST /api/feedback/:id` — insert into `feedback`; return HTTP 201; return HTTP 404 if session not found; return HTTP 409 if feedback already exists for session
    - _Requirements: 9.5, 9.6_

  - [x] 2.9 Add CORS and rate-limiting middleware
    - Create `server/src/middleware/cors.js` — restrict `Access-Control-Allow-Origin` to `FRONTEND_ORIGIN` env var
    - Create `server/src/middleware/ratelimit.js` — apply `express-rate-limit` to `POST /api/sessions`: max 10 requests per IP per hour
    - Wire both middleware into `server/src/index.js` before routes
    - _Requirements: 9.1_

  - [x] 2.10 Wire all routes into `server/src/index.js`
    - Mount `/api/sessions` → sessions router, `/api/hospitals` → hospitals router, `/api/feedback` → feedback router
    - Add global error handler (500 with `{ error, detail }`)
    - _Requirements: 9.1, 9.4_

- [x] 3. Checkpoint — Backend wiring
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. React PWA scaffold (`client/`)
  - [x] 4.1 Initialise Vite + React 18 project
    - Run `npm create vite@latest client -- --template react` (user runs this manually)
    - Install `tailwindcss`, `postcss`, `autoprefixer`, `react-router-dom`, `vite-plugin-pwa`, `@mediapipe/face_mesh`, `fast-check`, `vitest`, `@vitest/coverage-v8`
    - Configure `tailwind.config.js` and `postcss.config.js`
    - Configure `vite.config.js` with `vite-plugin-pwa` (manifest + service worker)
    - _Requirements: 3.1_

  - [x] 4.2 Create `client/public/manifest.json`
    - Set `name`, `short_name`, `start_url`, `display: standalone`, `orientation: portrait`, `theme_color: #0f6e56`, `background_color: #ffffff`, and icon entries for 192×192 and 512×512
    - _Requirements: 7.1_

  - [x] 4.3 Set up React Router v6 in `client/src/App.jsx`
    - Define routes: `/` → `Home`, `/scan` → `FaceScan`, `/speech` → `SpeechCheck`, `/arm` → `ArmCheck`, `/result` → `Result`, `/allclear` → `AllClear`
    - Pass session state (sessionId, language, scores) via React Router `state` or a top-level context
    - _Requirements: 3.1, 3.2_

  - [x] 4.4 Create `client/src/data/sentences.js`
    - Export a `SENTENCES` object keyed by language code (`en`, `hi`, `ta`, `te`)
    - Each key maps to an array of at least 3 speech prompt sentences appropriate for the language
    - _Requirements: 3.6_

- [ ] 5. Core lib modules with property-based tests
  - [x] 5.1 Implement `client/src/lib/asymmetry.js`
    - Export `LANDMARK_PAIRS` constant (7 pairs as specified in design)
    - Implement `getAsymmetryScore(landmarks)`: mirror left landmark across nose (index 1) x-axis, compute mean Euclidean distance across all 7 pairs
    - Implement `normaliseAsymmetryScore(rawScore)`: `clamp((rawScore - 0.005) / 0.035, 0, 1)`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 5.2 Write property tests for `asymmetry.js` (P1)
    - **Property P1: Asymmetry Score Bounds** — for all valid 468-landmark arrays, `getAsymmetryScore` returns a value `>= 0` and `normaliseAsymmetryScore(getAsymmetryScore(L))` is in `[0.0, 1.0]`
    - Use `fc.array(fc.record({ x: fc.float({min:0,max:1}), y: fc.float({min:0,max:1}), z: fc.float({min:-1,max:1}) }), { minLength: 468, maxLength: 468 })` to generate landmark arrays
    - Also write unit tests: symmetric landmarks → score near 0; boundary normalisation values (0.005 → 0.0, 0.040 → 1.0)
    - **Validates: Requirements 1.4, 1.8**

  - [x] 5.3 Implement `client/src/lib/fusion.js`
    - Implement `clamp(val, min, max)`
    - Implement `computeRiskScore(faceRaw, speechVariance, armBinary, speechBaseline = 500000)`:
      - `faceNorm = clamp((faceRaw - 0.005) / 0.035, 0, 1)`
      - `speechNorm = clamp(1 - (speechVariance / speechBaseline), 0, 1)`
      - `armNorm = armBinary`
      - `score = faceNorm * 0.40 + speechNorm * 0.40 + armNorm * 0.20`
      - Assign `level` per thresholds: FLAG > 0.55, WARN > 0.35, CLEAR ≤ 0.35
    - Return `{ level, score, faceNorm, speechNorm, armNorm }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 5.4 Write property tests for `fusion.js` (P2, P3, P4)
    - **Property P2: Fusion Score Bounds** — for all `(faceRaw >= 0, speechVariance >= 0, armBinary in {0,1})`, `score` is in `[0,1]` and `faceNorm`, `speechNorm` are in `[0,1]`
    - **Property P3: Fusion Level Consistency** — `score > 0.55 ↔ level === 'FLAG'`; `score > 0.35 && score <= 0.55 ↔ level === 'WARN'`; `score <= 0.35 ↔ level === 'CLEAR'`
    - **Property P4: Fusion Weight Correctness** — `score === faceNorm * 0.40 + speechNorm * 0.40 + armNorm * 0.20` within epsilon `1e-9`
    - Use `fc.float({ min: 0, max: 0.2 })` for faceRaw, `fc.float({ min: 0, max: 2000000 })` for speechVariance, `fc.constantFrom(0, 1)` for armBinary
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**

  - [x] 5.5 Implement `client/src/lib/routing.js`
    - Implement `haversine(lat1, lng1, lat2, lng2)` using Earth radius 6371 km
    - Implement `sortHospitals(userLat, userLng, hospitals)`: compute `distance` and `sortScore = distance * (hasThrombolysis ? 1 : 4)` for each hospital, sort ascending by `sortScore`, return top 3
    - Implement `getNearestHospital(lat, lng)`: try `GET /api/hospitals/nearest?lat&lng`; on failure fetch `/hospitals.json` and call `sortHospitals`; return empty array on total failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [x] 5.6 Write property tests for `routing.js` (P5, P6, P7, P8)
    - **Property P5: Haversine Identity** — `haversine(lat, lng, lat, lng) === 0` for all valid coordinates
    - **Property P6: Haversine Symmetry** — `|haversine(lat1,lng1,lat2,lng2) - haversine(lat2,lng2,lat1,lng1)| < 0.001` for all valid coordinate pairs
    - **Property P7: Hospital Routing Monotonicity** — for any non-empty hospital array, `sortHospitals` output is sorted ascending by `sortScore` (each element's `sortScore <= next element's sortScore`)
    - **Property P8: Thrombolysis Preference** — for two hospitals at equal distance where one has `hasThrombolysis=true` and the other `false`, the thrombolysis-capable hospital always ranks first
    - Use `fc.float({ min: -90, max: 90 })` for lat, `fc.float({ min: -180, max: 180 })` for lng
    - Also write unit test: Chennai (13.0827, 80.2707) to Mumbai (19.0760, 72.8777) ≈ 1340 km
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**

  - [x] 5.7 Implement `client/src/lib/speech.js`
    - Implement `computeSpectralCentroid(fftData, sampleRate, fftSize)`: convert dB to linear amplitude, compute amplitude-weighted mean frequency; return 0 if totalWeight === 0
    - Implement `normaliseSpeechScore(variance, baseline)`: `clamp(1 - (variance / baseline), 0, 1)`
    - Implement `getSpeechScore(durationMs = 8000)`: create `AudioContext`, `AnalyserNode` with `fftSize = 2048`, sample centroid every 100ms, compute variance, stop stream and close context before resolving
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8_

  - [x] 5.8 Write property tests for `speech.js` (P11)
    - **Property P11: Speech Normalisation Inversion** — for all `speechVariance >= speechBaseline > 0`, `normaliseSpeechScore(speechVariance, speechBaseline) === 0.0`; for `speechVariance === 0`, `normaliseSpeechScore(0, baseline) === 1.0`
    - Use `fc.float({ min: 1, max: 2000000 })` for baseline, `fc.float({ min: 0, max: 1 })` multiplied by baseline for variance (to generate values >= baseline)
    - Also write unit tests for `computeSpectralCentroid`: all-zero dB array → centroid 0; known weighted input → expected Hz value
    - **Validates: Requirements 2.5, 2.6**

  - [x] 5.9 Implement `client/src/lib/baseline.js`
    - Implement `updateBaseline(oldBaseline, oldStdDev, todayScore)`:
      - Compute `zScore = (todayScore - oldBaseline) / Math.max(oldStdDev, 0.001)`
      - If `zScore > 2.5`: return `{ newBaseline: oldBaseline, newStdDev: oldStdDev, isAnomaly: true }`
      - Otherwise: `newBaseline = 0.95 * oldBaseline + 0.05 * todayScore`; `newStdDev = 0.95 * oldStdDev + 0.05 * Math.abs(todayScore - newBaseline)`; return `{ newBaseline, newStdDev, isAnomaly: false }`
    - Implement `loadBaseline()` and `saveBaseline(baseline, stdDev)` using `localStorage`
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 5.10 Write property tests for `baseline.js` (P10)
    - **Property P10: Baseline Anomaly Guard** — for any `todayScore` where `(todayScore - baseline) / max(stdDev, 0.001) > 2.5`, `updateBaseline` returns `newBaseline === baseline` (no drift)
    - Use `fc.float({ min: 0.001, max: 0.1 })` for baseline, `fc.float({ min: 0, max: 0.01 })` for stdDev, generate `todayScore` as `baseline + 3 * max(stdDev, 0.001)` to guarantee anomaly condition
    - Also write unit test: normal score within 1σ → baseline drifts by 5%; anomalous score → baseline unchanged
    - **Validates: Requirements 12.2**

  - [x] 5.11 Implement `client/src/lib/alert.js`
    - Implement `buildWhatsAppLink(hospital, riskScore, distance, lang = 'en')`: build multilingual message for `en`, `hi`, `ta`, `te`; include risk score as percentage, hospital name, distance, emergency phone; URL-encode and prepend `https://wa.me/?text=`; fall back to `en` for unknown lang
    - Implement `buildCallLink(phone)`: return `tel:${phone.replace(/\s/g, '')}`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.12 Write unit tests for `alert.js`
    - Test: output starts with `https://wa.me/?text=`
    - Test: all 4 languages produce non-empty, URL-encoded messages
    - Test: unknown language falls back to English
    - Test: `buildCallLink` strips whitespace from phone number
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

  - [x] 5.13 Implement `client/src/lib/api.js`
    - Implement `createSession(language)`: `POST /api/sessions`; return `{ id, createdAt }`; fail silently (return null) on network error
    - Implement `updateSession(id, payload)`: `PATCH /api/sessions/:id`; fail silently on network error; queue payload in `localStorage` retry queue on failure
    - Implement `bulkInsertFrames(sessionId, frames)`: `POST /api/sessions/:id/frames`; fail silently on network error
    - Implement `getNearestHospitals(lat, lng)`: `GET /api/hospitals/nearest?lat&lng`; throw on error (caller handles fallback)
    - Implement `submitFeedback(sessionId, wasStroke, notes)`: `POST /api/feedback/:id`; fail silently on network error
    - Implement `retryQueue()`: read `localStorage` retry queue, attempt to flush pending `updateSession` calls
    - _Requirements: 7.3, 7.4, 7.6, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 6. Checkpoint — Lib modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Temporal aggregation utility with property test
  - [x] 7.1 Implement `aggregateFrameScores` in `client/src/lib/asymmetry.js`
    - Add `aggregateFrameScores(frameScores, minValidFrames = 200)`: filter to `faceDetected === true`, return `null` if count < `minValidFrames`, otherwise return median of valid `rawScore` values
    - _Requirements: 3.3, 10.5_

  - [x] 7.2 Write property test for temporal aggregation (P9)
    - **Property P9: Temporal Aggregation Null Safety** — for any array where all entries have `faceDetected: false`, `aggregateFrameScores(arr, 200)` returns `null`
    - Use `fc.array(fc.record({ rawScore: fc.float({min:0,max:0.1}), faceDetected: fc.constant(false) }), { minLength: 1, maxLength: 500 })` to generate all-invalid arrays
    - Also write unit test: exactly 200 valid frames → returns median; 199 valid frames → returns null
    - **Validates: Requirements 3.3, 10.5**

- [x] 8. Screen components
  - [x] 8.1 Implement `client/src/screens/Home.jsx`
    - Render language selection buttons for EN, HI, TA, TE
    - On language select: call `api.createSession(language)`, store `sessionId` in router state, navigate to `/scan`
    - If `createSession` returns null (offline): generate a local UUID, continue without a server session
    - _Requirements: 3.1, 3.2_

  - [x] 8.2 Implement `client/src/screens/FaceScan.jsx`
    - Initialise `@mediapipe/face_mesh` with WebGL backend on mount; on failure set `faceScore = 0.5` and navigate forward
    - Request camera via `getUserMedia({ video: { facingMode: 'user' } })`; on `NotAllowedError` show "Camera access needed" screen with skip option (score = 0.5)
    - Run `requestAnimationFrame` loop for 15 seconds; call `getAsymmetryScore` per frame; collect `FrameLog` objects
    - Batch-upload frame logs to backend every 2 seconds via `api.bulkInsertFrames`
    - After 15 seconds call `aggregateFrameScores(frameLogs, 200)`; if null show retry/skip prompt; if skip use score = 0.5
    - Show live feedback: frame count, current raw score
    - On complete navigate to `/speech` passing `faceScore` and `frameLogs` in router state
    - _Requirements: 1.1, 1.9, 3.3, 3.4, 3.5, 10.1, 10.2, 10.5, 10.6_

  - [x] 8.3 Implement `client/src/screens/SpeechCheck.jsx`
    - Display language-appropriate sentence from `sentences.js`
    - Request mic via `getUserMedia({ audio: true })`; on `NotAllowedError` show manual 1–5 rating UI; map rating to score (1→1.0, 2→0.75, 3→0.5, 4→0.25, 5→0.0)
    - On mic granted: call `getSpeechScore(8000)`, then `normaliseSpeechScore(variance, baseline)` where baseline is loaded from `localStorage` via `loadBaseline()` (default 500000)
    - On complete navigate to `/arm` passing `speechScore` and `rawVariance` in router state
    - _Requirements: 2.1, 3.6, 10.3, 10.4_

  - [x] 8.4 Implement `client/src/screens/ArmCheck.jsx`
    - Show illustrated instructions in selected language
    - Render two large tap targets: "Both raised equally" (→ armScore 0.0) and "One arm droops" (→ armScore 1.0)
    - No timer — wait for explicit tap; on tap navigate to `/result` passing `armScore` in router state
    - _Requirements: 3.7, 3.8, 3.9, 3.10_

  - [x] 8.5 Implement `client/src/screens/Result.jsx`
    - Receive `faceScore`, `speechScore`, `armScore`, `sessionId` from router state
    - Call `computeRiskScore(faceScore, speechVariance, armScore)` to get `{ level, score }`
    - Call `api.updateSession(sessionId, { faceScore, speechScore, armScore, riskScore: score, riskLevel: level })`
    - Request GPS via `navigator.geolocation`; on failure show district text input for manual lookup
    - Call `getNearestHospital(lat, lng)` (falls back to cached JSON offline); if empty array show `tel:108` link
    - Render result heading and subheading based on `level` (FLAG/WARN/CLEAR copy from design)
    - Render top hospital card with name, distance, `hasCt`, `hasThrombolysis`, `tier`
    - Render WhatsApp button using `buildWhatsAppLink` and call button using `buildCallLink`
    - If `level === 'CLEAR'` navigate to `/allclear`
    - _Requirements: 4.1, 4.4, 4.5, 4.6, 5.8, 5.9, 5.10, 6.1, 6.3, 10.7, 10.8_

  - [x] 8.6 Implement `client/src/screens/AllClear.jsx`
    - Show "No significant signs detected" message with calm reassurance copy
    - Offer "Check again" button (navigate to `/`) and "Submit feedback" link
    - _Requirements: 4.6_

- [ ] 9. PWA offline capability
  - [x] 9.1 Configure `vite-plugin-pwa` service worker in `vite.config.js`
    - Add `workbox` config to precache: app shell bundles, `hospitals.json`, MediaPipe WASM binaries
    - Set `runtimeCaching` for `hospitals.json` with `CacheFirst` strategy
    - Set `runtimeCaching` for API calls with `NetworkOnly` strategy (API failures handled in `api.js`)
    - _Requirements: 7.1, 7.2_

  - [x] 9.2 Implement offline retry queue in `client/src/lib/api.js`
    - On `updateSession` network failure: push `{ id, payload, timestamp }` to `localStorage` key `fastcheck_retry_queue`
    - Implement `retryQueue()`: read queue, attempt each item, remove successful items from queue
    - Call `retryQueue()` on app startup (in `App.jsx`) when `navigator.onLine === true`
    - Add `window.addEventListener('online', retryQueue)` listener in `App.jsx`
    - _Requirements: 7.4, 7.6_

- [x] 10. Checkpoint — Full integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Final wiring and integration tests
  - [x] 11.1 Wire `retryQueue` listener into `client/src/App.jsx`
    - Import `retryQueue` from `api.js`
    - Call `retryQueue()` on mount and on `online` event
    - _Requirements: 7.6_

  - [x] 11.2 Write integration tests for backend session flow
    - Test: `POST /api/sessions` → `PATCH /api/sessions/:id` → `POST /api/sessions/:id/frames` → verify DB state
    - Test: `POST /api/sessions` with invalid language → HTTP 400
    - Test: `PATCH /api/sessions/:id` with unknown UUID → HTTP 404
    - Test: `POST /api/feedback/:id` twice for same session → HTTP 409
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6_

  - [x] 11.3 Write integration tests for hospital routing endpoint
    - Seed 5 hospitals with known coordinates (including one with `hasThrombolysis=true`)
    - Test: `GET /api/hospitals/nearest?lat=13.08&lng=80.27` returns exactly 3 results sorted by `sortScore`
    - Test: thrombolysis-capable hospital ranks above equidistant non-capable hospital
    - _Requirements: 9.4, 5.4, 5.5, 5.6_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The Python FastAPI server (`api_server.py`), Streamlit app (`app.py`), and all modules under `src/stroke_detector/` are **not modified** by any task in this plan — Requirements 13.1–13.4
- Property tests P1–P11 are distributed close to their corresponding implementation tasks to catch regressions early
- The `server/` directory is a clean replacement for `backend/`; the old `backend/` directory is left in place until the migration is verified
- All API calls in `api.js` fail silently to preserve the offline-first user experience
- `fast-check` is the property-based test library for all `client/` tests; `vitest` is the test runner for both `client/` and `server/`
- MediaPipe WASM binaries (~4MB) should be cached by the service worker on first load to enable offline face scanning
- [ ] 13. ML Pipeline Robustness (Client)
  - [x] 13.1 Implement 3D pose estimation in `client/src/lib/asymmetry.js`
    - Add `computeHeadPose(landmarks)` function using MediaPipe face mesh landmarks
    - Calculate pitch (点头), yaw (摇头), roll (倾斜) angles from landmark positions
    - Use the nose tip and cheek landmarks to compute rotation angles
    - Return `{ pitch, yaw, roll }` in degrees
    - _Requirements: 1.2, 1.3_

  - [x] 13.2 Implement landmark normalization in `client/src/lib/asymmetry.js`
    - Add `normalizeLandmarks(landmarks, pitch, yaw, roll)` function
    - Apply Affine Transformation to rotate landmarks back to frontal pose
    - Use Procrustes Analysis to align facial shape to neutral pose
    - This prevents false positives when patient's head is tilted
    - _Requirements: 1.4, 1.5_

  - [x] 13.3 Update asymmetry calculation to use normalized landmarks
    - Modify `getAsymmetryScore` to first compute head pose, then normalize landmarks before computing distances
    - Add `getAsymmetryScoreWithNormalization(landmarks)` that chains pose estimation → normalization → asymmetry
    - Keep original `getAsymmetryScore` for backward compatibility
    - _Requirements: 1.6, 1.7, 1.8_

  - [ ]* 13.4 Write property tests for 3D pose estimation
    - Test: perfectly frontal face → pitch, yaw, roll ≈ 0
    - Test: head turned right → yaw changes proportionally
    - Test: head tilted → roll changes proportionally
    - Test: normalized landmarks from tilted face → asymmetry score similar to frontal face
    - **Validates: Requirements 1.3, 1.5**

  - [x] 13.5 Replace Spectral Centroid with MFCCs in `client/src/lib/speech.js`
    - Add `computeMFCCs(audioBuffer, numCoefficients = 13)` function
    - Implement Mel filterbank, DCT transformation
    - Return array of MFCC coefficients
    - Add `computeMFCCVariance(mfccs)` to compute variance across time frames
    - Replace `computeSpectralCentroid` usage with MFCC-based scoring
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 13.6 Evaluate ONNX WASM model integration for speech
    - Research lightweight ONNX models for speech/voice analysis
    - Test Whisper tiny encoder or custom CNN for slurred speech detection
    - Create `client/src/lib/speech-onnx.js` prototype if feasible
    - Document performance characteristics and accuracy improvements
    - _Requirements: 2.7, 2.8_

  - [x] 13.7 Create Web Worker for MediaPipe and Web Audio processing
    - Create `client/src/workers/face-mesh.worker.js`
    - Move MediaPipe Face Mesh initialization and frame processing to worker
    - Create `client/src/workers/audio.worker.js`
    - Move Web Audio processing (MFCC computation) to worker
    - Implement message passing for results between main thread and workers
    - _Requirements: 3.4, 3.5_

  - [ ] 13.8 Write integration tests for Web Worker communication
    - Test: worker receives landmarks, returns asymmetry score
    - Test: worker receives audio buffer, returns MFCC variance
    - Test: worker handles errors gracefully
    - _Requirements: 3.5_

- [ ] 14. Data & Routing Layer Enhancements
  - [x] 14.1 Implement Background Sync Service Worker
    - Create `client/public/sw-sync.js` service worker
    - Implement periodic sync using `PeriodicSyncManager` (when available) or fallback to `background-sync`
    - Fetch latest `hospitals.json` from server endpoint
    - Store in IndexedDB using `localForage`
    - Add version checking to prevent stale data
    - _Requirements: 7.1, 7.2_

  - [x] 14.2 Create hospital data API endpoint
    - Add `GET /api/hospitals/version` endpoint returning `{ version, timestamp, count }`
    - Add `GET /api/hospitals/data` endpoint returning full hospital dataset
    - Implement ETag support for conditional fetching
    - _Requirements: 7.1, 7.3_

  - [x] 14.3 Update `client/src/lib/routing.js` to use IndexedDB
    - Modify `getNearestHospital` to check IndexedDB first, then fallback to `/hospitals.json`
    - Add `syncHospitalsFromServer()` function to manually trigger sync
    - Add `getHospitalVersion()` to check data freshness
    - _Requirements: 7.1, 7.4, 7.6_

  - [x] 14.4 Implement geohashing for spatial indexing
    - Add `geohash.encode(lat, lng, precision = 6)` function in `server/src/services/hospitalService.js`
    - Add `geohash.encodeBoundingBox(lat, lng, radiusKm)` to get neighboring geohashes
    - Modify `GET /api/hospitals/nearest` to use geohash-based query instead of full-table scan
    - Add geohash index to hospitals table
    - _Requirements: 5.3, 5.4, 5.5_

  - [ ] 14.5 Write property tests for geohashing
    - Test: encoding same coordinates produces same hash
    - Test: neighboring geohashes have similar prefixes
    - Test: bounding box contains all points within radius
    - **Validates: Requirements 5.3, 5.5**

- [ ] 15. Backend & Telemetry (server/)
  - [x] 15.1 Implement automated alert webhooks
    - Add `POST /api/alerts/send` endpoint
    - Integrate WhatsApp Business API for WhatsApp alerts
    - Integrate Twilio SMS API as fallback
    - Send alert to emergency contact and nearest hospital on FLAG result
    - Include patient location, risk score, and timestamp in message
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 15.2 Add alert configuration to database
    - Create `alert_configs` table with `session_id`, `hospital_id`, `emergency_phone`, `whatsapp_webhook_url`, `sms_webhook_url`, `sent_at`, `status`
    - Store alert configuration when user enables auto-alerts
    - Track delivery status for each alert
    - _Requirements: 6.4, 6.5_

  - [x] 15.3 Expand scan_sessions table for telemetry
    - Add `raw_face_scores` JSONB column to store continuous face asymmetry scores
    - Add `raw_speech_scores` JSONB column to store speech variance/MFCC values over time
    - Add `raw_arm_scores` JSONB column for arm check timestamps
    - Add `processing_time_ms` column for performance tracking
    - _Requirements: 11.1, 11.2_

  - [x] 15.4 Implement telemetry API endpoint
    - Add `GET /api/telemetry/summary` endpoint
    - Return aggregate statistics: mean, median, stddev for each score type
    - Add `GET /api/telemetry/thresholds` endpoint returning current fusion thresholds
    - Add `PATCH /api/telemetry/thresholds` to update thresholds (admin only)
    - _Requirements: 11.3, 11.4_

  - [x] 15.5 Implement dynamic threshold adjustment
    - Add `adjustThresholds()` function in `server/src/services/telemetryService.js`
    - Analyze recent scan session data to detect score distribution shifts
    - Use statistical process control (SPC) to detect model drift
    - Automatically adjust `0.35` and `0.55` thresholds based on feedback data
    - Log all threshold changes with justification
    - _Requirements: 11.5, 11.6_

  - [ ] 15.6 Write integration tests for alert webhooks
    - Test: FLAG result triggers WhatsApp message
    - Test: FLAG result triggers SMS fallback
    - Test: alert includes correct patient data
    - Test: duplicate alerts are prevented
    - _Requirements: 6.2, 6.3_

- [ ] 16. Legacy Deprecation (src/ & backend/)
  - [x] 16.1 Add deprecation warnings to Python Streamlit app
    - Modify `app.py` to display prominent deprecation banner
    - Add message: "This application will be archived. Please use the new PWA at [URL]"
    - Add migration guide link
    - Set end-of-life date (6 months from now)
    - _Requirements: 13.1, 13.2_

  - [x] 16.2 Add deprecation warnings to FastAPI backend
    - Modify `api_server.py` to add deprecation headers
    - Add `Deprecation` header and `Link` header to all responses
    - Add `/api/v1/migration` endpoint with migration guide
    - Log deprecation warnings for each API call
    - _Requirements: 13.3_

  - [x] 16.3 Create Docker configuration for legacy services
    - Create `backend/Dockerfile` for FastAPI service
    - Create `src/Dockerfile` for Streamlit app
    - Create `docker-compose.yml` to run both services together
    - Include all dependencies and environment setup
    - Add health check endpoints
    - _Requirements: 13.4_

  - [x] 16.4 Document legacy API mapping
    - Create `docs/LEGACY_API_MAPPING.md`
    - Map each old endpoint to new Node.js server equivalent
    - Document deprecated fields and their replacements
    - Provide migration checklist for external consumers
    - _Requirements: 13.2, 13.3_

  - [x] 16.5 Archive legacy code
    - Create tagged release for legacy codebase
    - Move `src/stroke_detector/` to `archive/legacy-python/`
    - Move `backend/` to `archive/legacy-backend/`
    - Update README to point to new PWA and Node.js server
    - _Requirements: 13.1_

- [x] 17. Checkpoint — New features complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Final integration and deployment
  - [ ] 18.1 End-to-end test of new features
    - Test 3D pose normalization with tilted head
    - Test MFCC-based speech scoring
    - Test background sync of hospital data
    - Test geohash-based nearest hospital query
    - Test automated alert webhooks (with test mode)
    - Test dynamic threshold adjustment

  - [ ] 18.2 Performance validation
    - Verify Web Worker offloading improves UI frame rate
    - Measure MediaPipe processing time with/without worker
    - Measure hospital query time with geohashing vs full scan
    - Verify IndexedDB sync doesn't block UI

  - [ ] 18.3 Production deployment checklist
    - Deploy updated Node.js server with telemetry endpoints
    - Deploy PWA with new lib modules and workers
    - Configure WhatsApp Business API / Twilio credentials
    - Enable periodic background sync in service worker
    - Set up monitoring for telemetry data

- [x] 19. Final checkpoint — All phases complete
  - Ensure all tests pass, ask the user if questions arise.