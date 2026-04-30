# Requirements Document

## Introduction

This document specifies the requirements for migrating the FAST Check stroke detection ML pipeline from a Python server-side architecture (MediaPipe + librosa + FastAPI) to a browser-first Progressive Web App (PWA). The migration moves all ML inference on-device into the browser using MediaPipe JS (WASM/WebGL) and the Web Audio API, enabling offline capability, multilingual support, and privacy-preserving operation for rural India use cases. The Node.js backend schema is also migrated from `screenings`/`alert_events` to `scan_sessions`/`frame_logs`/`hospitals`/`feedback`. The Python FastAPI and Streamlit tools are retained unchanged as a secondary demo path.

## Glossary

- **PWA**: Progressive Web App — a web application installable on mobile devices with offline capability via service workers.
- **FaceScan**: The React screen component that manages the 15-second camera session and MediaPipe JS face mesh processing.
- **SpeechCheck**: The React screen component that manages the 8-second microphone session and Web Audio API spectral analysis.
- **ArmCheck**: The React screen component that presents the binary manual arm-weakness confirmation.
- **FusionEngine**: The client-side JavaScript module (`fusion.js`) that computes the weighted risk score from the three normalised signals.
- **AsymmetryScorer**: The client-side JavaScript module (`asymmetry.js`) that computes facial asymmetry from MediaPipe landmark arrays.
- **SpeechScorer**: The client-side JavaScript module (`speech.js`) that computes spectral centroid variance from Web Audio API data.
- **HospitalRouter**: The client-side JavaScript module (`routing.js`) that ranks hospitals by stroke-capability-weighted Haversine distance.
- **AlertBuilder**: The client-side JavaScript module (`alert.js`) that constructs multilingual WhatsApp deep links.
- **APIClient**: The client-side JavaScript module (`api.js`) that wraps all backend fetch calls and fails silently when offline.
- **SessionStore**: The Node.js Express backend that persists scan sessions, frame logs, hospital data, and feedback to PostgreSQL.
- **ServiceWorker**: The PWA service worker that caches `hospitals.json` and queues offline session data for retry.
- **ScanSession**: A single end-to-end FAST check run, stored in the `scan_sessions` PostgreSQL table.
- **FrameLog**: A per-frame asymmetry measurement stored in the `frame_logs` PostgreSQL table.
- **RiskLevel**: One of three discrete outcomes — `CLEAR`, `WARN`, or `FLAG` — derived from the fused risk score.
- **SpeechBaseline**: The stored spectral centroid variance from a healthy reference recording, used to normalise the speech score.
- **Haversine**: The great-circle distance formula used to compute distances between GPS coordinates.
- **sortScore**: The capability-weighted distance used to rank hospitals: `distance × (hasThrombolysis ? 1 : 4)`.
- **hasThrombolysis**: A boolean hospital attribute indicating availability of thrombolytic stroke treatment.

---

## Requirements

### Requirement 1: Browser-First On-Device Face Asymmetry Detection

**User Story:** As a family member using the FAST Check app, I want facial asymmetry to be analysed directly on my device without sending video to a server, so that the check works offline and patient privacy is preserved.

#### Acceptance Criteria

1. WHEN the FaceScan screen initialises, THE FaceScan SHALL load the MediaPipe Face Mesh WASM module using the WebGL backend.
2. WHEN MediaPipe Face Mesh produces a result for a video frame, THE AsymmetryScorer SHALL compute a raw asymmetry score from the 468 normalised landmarks without transmitting any video data to any server.
3. WHEN the AsymmetryScorer receives a landmark array of length 468, THE AsymmetryScorer SHALL compute the mean Euclidean distance across 7 mirrored anatomical landmark pairs using landmark index 1 as the nose-tip centre reference.
4. THE AsymmetryScorer SHALL return a raw asymmetry score that is greater than or equal to 0.0 for any valid landmark input.
5. WHEN the raw asymmetry score is less than or equal to 0.005, THE AsymmetryScorer SHALL normalise it to 0.0.
6. WHEN the raw asymmetry score is greater than or equal to 0.040, THE AsymmetryScorer SHALL normalise it to 1.0.
7. WHILE the raw asymmetry score is between 0.005 and 0.040 exclusive, THE AsymmetryScorer SHALL produce a normalised score that increases monotonically using the formula `clamp((rawScore - 0.005) / 0.035, 0.0, 1.0)`.
8. THE AsymmetryScorer SHALL return a normalised score in the range [0.0, 1.0] for any non-negative raw input.
9. WHEN MediaPipe Face Mesh fails to initialise due to a network error or missing WASM support, THE FaceScan SHALL skip the face check and set the face score to 0.5 (neutral).

---

### Requirement 2: Browser-First On-Device Speech Slur Detection

**User Story:** As a family member using the FAST Check app, I want speech clarity to be analysed directly on my device without sending audio to a server, so that the check works offline and patient privacy is preserved.

#### Acceptance Criteria

1. WHEN the SpeechCheck screen starts recording, THE SpeechScorer SHALL create a Web Audio API `AnalyserNode` with `fftSize = 2048` and sample spectral centroid values every 100 milliseconds for the configured duration.
2. WHEN computing a spectral centroid from an FFT frame, THE SpeechScorer SHALL compute the amplitude-weighted mean frequency in Hz across all frequency bins, converting dB values to linear amplitude before weighting.
3. IF the total linear amplitude across all FFT bins is zero, THEN THE SpeechScorer SHALL return a centroid of 0.0 Hz for that frame.
4. THE SpeechScorer SHALL return a non-negative spectral centroid variance for any valid audio recording.
5. WHEN the spectral centroid variance equals zero, THE SpeechScorer SHALL normalise the speech score to 1.0 (maximum risk).
6. WHEN the spectral centroid variance is greater than or equal to the SpeechBaseline, THE SpeechScorer SHALL normalise the speech score to 0.0 (no risk).
7. THE SpeechScorer SHALL stop the audio stream and close the AudioContext before resolving the speech score promise.
8. THE SpeechScorer SHALL not transmit any audio data to any server at any point during or after recording.

---

### Requirement 3: Three-Step FAST Check Flow

**User Story:** As a family member, I want to be guided through a structured three-step check (face, speech, arm) so that I can assess stroke risk systematically without medical training.

#### Acceptance Criteria

1. WHEN a user opens the app, THE PWA SHALL present a language selection screen before starting any scan.
2. WHEN a language is selected, THE PWA SHALL create a new ScanSession on the SessionStore and receive a session UUID before proceeding to the face scan step.
3. WHEN the face scan step begins, THE FaceScan SHALL run for 15 seconds, processing video frames at approximately 30 frames per second.
4. WHEN the face scan step completes, THE FaceScan SHALL upload all collected FrameLog records to the SessionStore in batches every 2 seconds during the scan.
5. WHEN the face scan step completes, THE FaceScan SHALL pass the aggregated face score and frame logs to the next step before navigating to the speech check screen.
6. WHEN the speech check step begins, THE SpeechCheck SHALL display a language-appropriate prompt sentence and record audio for 8 seconds.
7. WHEN the arm check step begins, THE ArmCheck SHALL display illustrated instructions in the selected language and present two tap targets: "Both raised equally" and "One arm droops".
8. WHEN the user taps "Both raised equally", THE ArmCheck SHALL produce an arm score of 0.0.
9. WHEN the user taps "One arm droops", THE ArmCheck SHALL produce an arm score of 1.0.
10. THE ArmCheck SHALL not proceed automatically — it SHALL wait for an explicit user tap before completing.

---

### Requirement 4: Client-Side Weighted Risk Fusion

**User Story:** As a family member, I want the app to combine all three check results into a single risk level so that I can immediately understand whether to seek emergency care.

#### Acceptance Criteria

1. WHEN all three check steps are complete, THE FusionEngine SHALL compute a weighted risk score using the formula: `score = faceNorm × 0.40 + speechNorm × 0.40 + armNorm × 0.20`.
2. THE FusionEngine SHALL produce a risk score in the range [0.0, 1.0] for any valid combination of face, speech, and arm inputs.
3. THE FusionEngine SHALL produce normalised component scores (faceNorm, speechNorm, armNorm) each in the range [0.0, 1.0].
4. WHEN the computed risk score is greater than 0.55, THE FusionEngine SHALL assign RiskLevel `FLAG`.
5. WHEN the computed risk score is greater than 0.35 and less than or equal to 0.55, THE FusionEngine SHALL assign RiskLevel `WARN`.
6. WHEN the computed risk score is less than or equal to 0.35, THE FusionEngine SHALL assign RiskLevel `CLEAR`.
7. WHEN the FusionEngine assigns a RiskLevel, THE FusionEngine SHALL ensure the level is consistent with the computed score at all times (no level can be assigned to a score outside its defined threshold range).
8. WHEN fusion is complete, THE PWA SHALL send a PATCH request to the SessionStore with faceScore, speechScore, armScore, riskScore, and riskLevel.

---

### Requirement 5: Haversine Hospital Routing with Stroke-Capability Weighting

**User Story:** As a family member, I want the app to recommend the nearest stroke-capable hospital so that I can get the patient to appropriate care as quickly as possible.

#### Acceptance Criteria

1. WHEN computing the distance between two GPS coordinates, THE HospitalRouter SHALL use the Haversine formula with Earth radius 6371 km and return a non-negative distance in kilometres.
2. WHEN the origin and destination coordinates are identical, THE HospitalRouter SHALL return a distance of exactly 0.0 km.
3. WHEN computing distance from point A to point B, THE HospitalRouter SHALL return the same value as computing distance from point B to point A (within floating-point epsilon of 0.001 km).
4. WHEN ranking hospitals, THE HospitalRouter SHALL compute a sortScore for each hospital as `distance × (hasThrombolysis ? 1 : 4)`.
5. WHEN two hospitals are at equal distance and one has `hasThrombolysis = true` and the other has `hasThrombolysis = false`, THE HospitalRouter SHALL rank the thrombolysis-capable hospital first.
6. THE HospitalRouter SHALL return the top 3 hospitals sorted in ascending order by sortScore.
7. THE HospitalRouter SHALL return at most 3 hospitals regardless of the size of the input hospital list.
8. WHEN the backend API is reachable, THE HospitalRouter SHALL fetch the hospital list from `GET /api/hospitals/nearest`.
9. WHEN the backend API is unreachable, THE HospitalRouter SHALL fall back to the cached `hospitals.json` file and run Haversine locally.
10. IF both the backend API and the cached `hospitals.json` are unavailable, THEN THE HospitalRouter SHALL return an empty array and THE PWA SHALL display the generic emergency number 108 with a `tel:108` link.

---

### Requirement 6: Multilingual WhatsApp Emergency Alerts

**User Story:** As a family member, I want to send a pre-filled emergency WhatsApp message in my language so that I can quickly alert others and coordinate transport to hospital.

#### Acceptance Criteria

1. WHEN a RiskLevel of `FLAG` or `WARN` is produced, THE AlertBuilder SHALL generate a WhatsApp deep link URL beginning with `https://wa.me/?text=`.
2. THE AlertBuilder SHALL support message generation in English (`en`), Hindi (`hi`), Tamil (`ta`), and Telugu (`te`).
3. WHEN generating a WhatsApp message, THE AlertBuilder SHALL include the risk score as a percentage, the hospital name, the distance to the hospital in km, and the hospital emergency phone number in the message body.
4. WHEN the requested language is not one of the four supported languages, THE AlertBuilder SHALL fall back to English.
5. THE AlertBuilder SHALL URL-encode the message text before appending it to the `wa.me` base URL.
6. WHEN generating a call link, THE AlertBuilder SHALL return a `tel:` URI with all whitespace stripped from the phone number.

---

### Requirement 7: PWA Offline Capability

**User Story:** As a family member in a rural area with intermittent connectivity, I want the app to work offline so that I can still perform a FAST check and find the nearest hospital without an internet connection.

#### Acceptance Criteria

1. THE ServiceWorker SHALL cache the `hospitals.json` file on the first successful load of the PWA.
2. WHEN the PWA is opened without network connectivity, THE ServiceWorker SHALL serve the cached `hospitals.json` to the HospitalRouter.
3. WHEN any API call to the SessionStore fails due to network unavailability, THE APIClient SHALL fail silently without displaying an error to the user.
4. WHEN a session update fails due to network unavailability, THE APIClient SHALL queue the session data in `localStorage` for retry when connectivity is restored.
5. WHILE the device is offline, THE PWA SHALL still complete the full three-step FAST check flow and display a result with hospital recommendations from the cached data.
6. WHEN connectivity is restored, THE APIClient SHALL retry queued session data from `localStorage` and persist it to the SessionStore.

---

### Requirement 8: Node.js Backend Schema Migration

**User Story:** As a backend developer, I want the PostgreSQL schema to reflect the new browser-first architecture so that session data, frame logs, hospital records, and feedback are stored in a structured and privacy-preserving way.

#### Acceptance Criteria

1. THE SessionStore SHALL provide a `scan_sessions` table with columns: `id` (UUID primary key), `created_at` (timestamptz), `language` (text), `face_score` (numeric 6,4 nullable), `speech_score` (numeric 6,4 nullable), `arm_score` (numeric 3,2 nullable), `risk_score` (numeric 6,4 nullable), `risk_level` (text nullable), `alert_sent` (boolean default false), `district` (text nullable), `hospital_id` (UUID FK to hospitals nullable).
2. THE SessionStore SHALL enforce that the `language` column in `scan_sessions` contains only one of the values: `en`, `hi`, `ta`, `te`.
3. THE SessionStore SHALL enforce that the `risk_level` column in `scan_sessions` contains only one of the values: `CLEAR`, `WARN`, `FLAG`, or NULL.
4. THE SessionStore SHALL enforce that `face_score`, `speech_score`, `arm_score`, and `risk_score` are in the range [0.0, 1.0] when not NULL.
5. THE SessionStore SHALL provide a `frame_logs` table with columns: `id` (UUID primary key), `session_id` (UUID FK to scan_sessions with ON DELETE CASCADE), `frame_ts` (integer, ms since scan start), `raw_score` (numeric 8,6), `face_detected` (boolean).
6. THE SessionStore SHALL enforce that `frame_ts` in `frame_logs` is greater than or equal to 0.
7. THE SessionStore SHALL provide a `hospitals` table with columns: `id` (UUID primary key), `name` (text), `state` (text), `district` (text), `lat` (numeric 9,6), `lng` (numeric 9,6), `emergency_phone` (text), `has_thrombolysis` (boolean default false), `has_ct` (boolean default false), `tier` (integer).
8. THE SessionStore SHALL enforce that `lat` in `hospitals` is in the range [-90, 90] and `lng` is in the range [-180, 180].
9. THE SessionStore SHALL enforce that `tier` in `hospitals` is one of 1, 2, or 3.
10. THE SessionStore SHALL provide a `feedback` table with columns: `id` (UUID primary key), `session_id` (UUID FK to scan_sessions, unique), `was_stroke` (boolean nullable), `submitted_at` (timestamptz), `notes` (text nullable).
11. THE SessionStore SHALL enforce that at most one feedback record exists per session via a UNIQUE constraint on `feedback.session_id`.
12. THE SessionStore SHALL NOT store a `patient_name` column in any table.

---

### Requirement 9: Backend REST API

**User Story:** As a frontend developer, I want a typed REST API for session management and hospital lookup so that the PWA can persist scan results and retrieve hospital data reliably.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/sessions` with a `language` field, THE SessionStore SHALL insert a new ScanSession record and return the session `id` (UUID) and `created_at` timestamp with HTTP 201.
2. WHEN a PATCH request is made to `/api/sessions/:id` with score fields, THE SessionStore SHALL update the corresponding ScanSession record and return HTTP 204.
3. WHEN a POST request is made to `/api/sessions/:id/frames` with an array of FrameLog objects, THE SessionStore SHALL bulk-insert all frame records associated with the given session and return HTTP 201.
4. WHEN a GET request is made to `/api/hospitals/nearest` with `lat` and `lng` query parameters, THE SessionStore SHALL return the top 3 hospitals sorted by capability-weighted Haversine distance as a JSON array.
5. WHEN a POST request is made to `/api/feedback/:id` with a `wasStroke` boolean and optional `notes`, THE SessionStore SHALL insert a feedback record linked to the session and return HTTP 201.
6. IF a session ID provided in any request does not exist in `scan_sessions`, THEN THE SessionStore SHALL return HTTP 404.

---

### Requirement 10: Error Handling and Graceful Degradation

**User Story:** As a family member in a stressful situation, I want the app to handle device permission errors and connectivity issues gracefully so that I can still complete the FAST check even when something goes wrong.

#### Acceptance Criteria

1. WHEN camera permission is denied by the user or browser, THE FaceScan SHALL display a "Camera access needed" screen with instructions to enable camera access in browser settings.
2. WHEN camera permission is denied, THE FaceScan SHALL offer a "Skip face check" option that sets the face score to 0.5 and stores `face_score` as NULL in the ScanSession.
3. WHEN microphone permission is denied by the user or browser, THE SpeechCheck SHALL display a manual 1–5 speech clarity rating interface as a fallback.
4. WHEN the user submits a manual speech clarity rating, THE SpeechCheck SHALL map the rating to a speech score using: 1 → 1.0, 2 → 0.75, 3 → 0.5, 4 → 0.25, 5 → 0.0.
5. WHEN the face scan completes with fewer than 200 valid frames (faceDetected = true), THE FaceScan SHALL display a "Face not clearly visible" prompt with a positioning guide and offer a retry option.
6. WHEN the user chooses to skip after insufficient frames, THE FaceScan SHALL use a face score of 0.5 and continue to the speech check step.
7. WHEN GPS location is unavailable or times out, THE PWA SHALL display a district or city text input for manual location entry and use text-based hospital lookup by district name.
8. WHEN the backend API is unreachable and no cached `hospitals.json` is available, THE PWA SHALL display the generic emergency number 108 with a `tel:108` link.

---

### Requirement 11: Privacy by Design

**User Story:** As a patient or family member, I want to be assured that no personal data or biometric media is stored or transmitted, so that I can use the app without privacy concerns.

#### Acceptance Criteria

1. THE PWA SHALL not transmit any video frame data, raw image data, or audio waveform data to any server at any point during or after a scan.
2. THE SessionStore SHALL not store a patient name, patient identifier, or any personally identifiable information in any table.
3. THE PWA SHALL transmit only computed numeric scores (faceScore, speechScore, armScore, riskScore) and metadata (language, district, hospitalId) to the SessionStore.
4. WHEN a ScanSession is created, THE SessionStore SHALL assign a randomly generated UUID as the session identifier with no link to any user identity.

---

### Requirement 12: Morning Wellness Baseline Tracking

**User Story:** As a regular user, I want the app to learn my personal baseline asymmetry score over time so that the face check becomes more accurate for my individual face.

#### Acceptance Criteria

1. WHEN a wellness baseline update is triggered with a new score, THE PWA SHALL update the stored baseline using an exponential moving average with a 5% daily drift rate: `newBaseline = 0.95 × oldBaseline + 0.05 × todayScore`.
2. WHEN the z-score of the new measurement exceeds 2.5 standard deviations from the stored baseline, THE PWA SHALL not update the baseline and SHALL flag the measurement as anomalous.
3. WHEN the z-score of the new measurement is 2.5 or below, THE PWA SHALL update both the baseline and the stored standard deviation using the EMA formula.
4. THE PWA SHALL store the wellness baseline and standard deviation in `localStorage` keyed to the device, not to any user identity.

---

### Requirement 13: Python Secondary Demo Tool Preservation

**User Story:** As a developer or researcher, I want the Python FastAPI and Streamlit tools to remain functional and unchanged so that I can continue using them for demonstrations and development.

#### Acceptance Criteria

1. THE Python FastAPI server (`api_server.py`) SHALL remain operational and unmodified by the migration.
2. THE Streamlit application (`app.py`) SHALL remain operational and unmodified by the migration.
3. THE Python ML pipeline modules in `src/stroke_detector/` SHALL remain operational and unmodified by the migration.
4. WHERE the Python demo path is used, THE Python FastAPI server SHALL continue to accept video and audio payloads and return risk scores independently of the browser-first PWA.
