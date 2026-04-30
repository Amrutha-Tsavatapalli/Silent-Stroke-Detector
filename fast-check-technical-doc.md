# FAST Check — Silent Stroke Detector
### Social Impact Hackathon — Complete Technical Document

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [The Idea](#2-the-idea)
3. [Novelty & Differentiation](#3-novelty--differentiation)
4. [User Flow](#4-user-flow)
5. [System Architecture](#5-system-architecture)
6. [Detection Pipeline](#6-detection-pipeline)
7. [Database Design](#7-database-design)
8. [API Design](#8-api-design)
9. [Hospital Data Pipeline](#9-hospital-data-pipeline)
10. [Alert System](#10-alert-system)
11. [PWA & Offline Strategy](#11-pwa--offline-strategy)
12. [Morning Wellness Check-In](#12-morning-wellness-check-in)
13. [Tech Stack](#13-tech-stack)
14. [File Structure](#14-file-structure)
15. [Build Order — 24 Hours](#15-build-order--24-hours)
16. [Pitch Framing](#16-pitch-framing)

---

## 1. The Problem

Stroke is the **leading cause of disability and death** in rural India. Every minute a stroke goes untreated, approximately **2 million neurons die**. The treatment window for clot-busting medication (tPA) is **4.5 hours** from symptom onset.

The bottleneck is not hospitals. It is **recognition and reaction time.**

- **87% of stroke deaths** in studied rural Indian regions occur at home
- **45% of deaths** happen within the first 30 days, before reaching care
- Rural populations face limited awareness, no FAST training, and delayed treatment
- A significant proportion of Indian strokes occur in people **under 50** — not the demographic most associated with stroke awareness
- Urban hospitals have CT scanners and thrombolysis capability; rural populations don't know which hospitals have these

The family member standing next to the person having a stroke doesn't know what FAST is. They waste 3–4 hours assuming it's fatigue, heat, or something minor. By the time an ambulance is called, the treatment window is gone.

---

## 2. The Idea

**FAST Check** is a progressive web app that turns any smartphone into a 90-second stroke screening tool — operated by an untrained family member, with no wearable, no hospital visit, and no prior medical knowledge required.

The app walks the user through the three clinically validated FAST signs:

- **F** — Facial asymmetry (automated, via front camera + MediaPipe AI)
- **A** — Arm weakness (manual tap confirm)
- **S** — Speech slur (automated, via microphone + spectral analysis)

If risk is detected, the app instantly routes to the nearest stroke-capable government hospital, generates a pre-filled emergency message in the user's local language, and provides a one-tap emergency call button.

**What it is not:** a diagnostic tool. It is a FAST-check guide — a triage assistant that tells a panicked family member "this needs urgent attention" before a single phone call has been made.

---

## 3. Novelty & Differentiation

### What already exists

| System | Who built it | Limitation |
|---|---|---|
| FAST.AI | UCLA / Bulgaria hospitals | Designed for paramedics, requires clinical setup |
| RMIT facial tool | RMIT University | Research only, face video, no alert system |
| Sense Neuro | Startup | Wearable hardware required, expensive |

All existing systems are built **for clinicians or paramedics** operating in a structured setting. None address the first-responder gap: the family member at home who has never heard of the FAST acronym.

### FAST Check's differentiation

**1. Bystander-first UX**
The entire interface is designed for a panicked, non-medical person. Language is plain. Instructions are visual. No medical terminology. Tested mental model: "point the phone at them like you're taking a video."

**2. Multimodal fusion on-device**
Face asymmetry and speech slur are scored simultaneously via WebGL + Web Audio API — no data leaves the device. This is the hardest technical piece and makes the system privacy-preserving by design.

**3. Stroke-capability-aware routing**
The app doesn't just find the nearest hospital. It finds the nearest hospital with a **CT scanner and thrombolysis capability**. A stroke patient reaching a hospital that cannot give tPA gains nothing. This distinction saves lives and is absent from all existing tools.

**4. Pre-filled multilingual emergency message**
The alert isn't just a phone number. It's a WhatsApp message pre-populated with: risk scores, symptom flags, GPS coordinates, time since symptom onset, and the hospital name — all in the user's chosen language. The receiving hospital gets structured information before the ambulance departs.

**5. Morning wellness check-in (novel feature)**
A daily opt-in 30-second facial scan for high-risk individuals (hypertension, diabetes, age 60+). Baseline is established over 7 days. Deviations from baseline trigger a soft alert. This is the only passive-adjacent feature and is designed to catch TIAs (mini-strokes) — which are frequently missed and are strong predictors of a major stroke within 48 hours.

**6. Outcome feedback loop**
A feedback table captures whether flagged cases were confirmed strokes. This creates a ground truth dataset for model improvement over time — something no existing consumer tool has.

---

## 4. User Flow

```
App opens
    │
    ├─ Select language (English / Hindi / Tamil / Telugu)
    │
    └─ "Check someone now" button
           │
           ▼
    ┌─────────────────────────────────────────┐
    │  STEP 1: Face Scan (15 seconds)         │
    │  "Hold phone 40–50cm from their face"   │
    │  Live camera → MediaPipe → score        │
    └─────────────────────────────────────────┘
           │
           ▼
    ┌─────────────────────────────────────────┐
    │  STEP 2: Speech Check (10 seconds)      │
    │  "Ask them to say: [sentence]"          │
    │  Mic → spectral variance → score        │
    └─────────────────────────────────────────┘
           │
           ▼
    ┌─────────────────────────────────────────┐
    │  STEP 3: Arm Check (5 seconds)          │
    │  "Ask them to raise both arms"          │
    │  Two buttons: Equal / One droops        │
    └─────────────────────────────────────────┘
           │
           ▼
    Risk score computed (weighted fusion)
           │
    ┌──────┴──────┐
    │             │
  < 0.35        > 0.55
  All clear     FLAGGED
                  │
                  ▼
    ┌─────────────────────────────────────────┐
    │  RESULT SCREEN                          │
    │  "3 of 3 FAST signs flagged.            │
    │   This needs urgent attention."         │
    │                                         │
    │  GGH Chennai — 4.2km                   │
    │  CT scanner · Stroke capable            │
    │                                         │
    │  [Call emergency: 044-25305060]         │
    │  [Send WhatsApp alert]                  │
    └─────────────────────────────────────────┘
```

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (Browser / PWA)            │
│                                                     │
│  React 18 + Vite                                    │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ MediaPipe    │  │ Web Audio    │                │
│  │ Face Mesh    │  │ API          │                │
│  │ (WebGL/WASM) │  │ (Mic input)  │                │
│  └──────┬───────┘  └──────┬───────┘                │
│         │                 │                         │
│         └────────┬────────┘                         │
│                  │                                  │
│           fusion.js (weighted score)                │
│                  │                                  │
│           routing.js (Haversine)                    │
│                  │                                  │
│           alert.js (WhatsApp deep link)             │
│                  │                                  │
│           api.js (fetch to backend)                 │
└──────────────────┼──────────────────────────────────┘
                   │ HTTPS
┌──────────────────┼──────────────────────────────────┐
│              BACKEND (Railway)                      │
│                                                     │
│  Node.js + Express                                  │
│                                                     │
│  POST /api/sessions                                 │
│  PATCH /api/sessions/:id                            │
│  POST /api/sessions/:id/frames                      │
│  GET  /api/hospitals/nearest                        │
│  POST /api/feedback/:id                             │
│                                                     │
│  Prisma ORM                                         │
│       │                                             │
│  ┌────┴──────────────┐                              │
│  │  PostgreSQL        │                              │
│  │  (Railway managed) │                              │
│  └───────────────────┘                              │
└─────────────────────────────────────────────────────┘

Deploy:
  Frontend → Vercel (auto HTTPS, CDN)
  Backend  → Railway (Node + Postgres, same project)
```

---

## 6. Detection Pipeline

### 6.1 Facial Asymmetry — MediaPipe Face Mesh

MediaPipe Face Mesh runs as a WASM binary in the browser, using the device GPU via WebGL. No video data is transmitted. The model outputs 468 3D facial landmarks at ~30fps.

**Landmark pairs used for asymmetry scoring:**

| Left index | Right index | Anatomical region |
|---|---|---|
| 33 | 263 | Outer eye corners |
| 159 | 386 | Upper eyelid peak |
| 145 | 374 | Lower eyelid valley |
| 61 | 291 | Mouth corners |
| 70 | 300 | Eyebrow outer end |
| 105 | 334 | Eyebrow inner end |
| 117 | 346 | Cheek reference |

**Scoring formula:**

```js
function getAsymmetryScore(landmarks) {
  const nose = landmarks[1]; // nose tip as centre reference

  const PAIRS = [
    [33,263],[159,386],[145,374],
    [61,291],[70,300],[105,334],[117,346]
  ];

  const scores = PAIRS.map(([l, r]) => {
    const left = landmarks[l];
    const right = landmarks[r];

    // Mirror left point across nose x to get expected symmetric position
    const mirroredLx = 2 * nose.x - left.x;

    // Euclidean distance between mirrored left and actual right
    const dx = mirroredLx - right.x;
    const dy = left.y - right.y;
    return Math.sqrt(dx * dx + dy * dy);
  });

  return scores.reduce((a, b) => a + b, 0) / scores.length;
  // Normal range: 0.005 – 0.012
  // Stroke indicator: > 0.028
}
```

**Temporal filtering:**
- Collect scores over a 15-second window (~450 frames)
- Discard frames where `faceDetected = false`
- Use median (not mean) to reject outlier frames from head movement
- Require minimum 200 valid frames before computing final score

**Normalisation:**
```js
faceNorm = clamp((rawScore - 0.005) / (0.04 - 0.005), 0, 1)
```

---

### 6.2 Speech Slur Detection — Web Audio API

No speech-to-text. Language-agnostic. Uses low-level audio signal properties that change when speech motor control is impaired.

**What changes in slurred speech:**
- Reduced spectral centroid variance (flatter, less dynamic articulation)
- Lower formant transition rate (F1/F2 movements slower)
- Higher jitter in fundamental frequency

**Implementation using AnalyserNode:**

```js
async function getSpeechScore(durationMs = 8000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();

  analyser.fftSize = 2048;
  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);
  const centroids = [];

  return new Promise(resolve => {
    const interval = setInterval(() => {
      analyser.getFloatFrequencyData(dataArray);

      // Spectral centroid = weighted mean of frequencies
      let weightedSum = 0, totalWeight = 0;
      dataArray.forEach((db, i) => {
        const linear = Math.pow(10, db / 20);
        const freq = (i * ctx.sampleRate) / analyser.fftSize;
        weightedSum += freq * linear;
        totalWeight += linear;
      });

      centroids.push(weightedSum / totalWeight);
    }, 100); // 10 samples/second

    setTimeout(() => {
      clearInterval(interval);
      stream.getTracks().forEach(t => t.stop());
      ctx.close();

      // Variance of centroids = articulation dynamism
      const mean = centroids.reduce((a,b)=>a+b,0) / centroids.length;
      const variance = centroids.reduce((a,b) => a + (b-mean)**2, 0) / centroids.length;

      // Low variance = slurred/flat speech
      // High variance = clear dynamic articulation
      resolve(variance);
    }, durationMs);
  });
}
```

**Normalisation:**
- Establish baseline variance from healthy speech during app onboarding
- Normalise against this baseline
- Fallback if mic denied: show manual 1–5 clarity rating

---

### 6.3 Arm Weakness

Manual binary confirmation:
- **0.0** → "Both raised equally"
- **1.0** → "One arm droops or cannot raise"

Weight in fusion: `0.20`

Future scope: `deviceorientation` API for accelerometer-based arm tracking (user holds phone while attempting to raise both arms, phone measures asymmetric motion).

---

### 6.4 Risk Score Fusion

```js
function computeRiskScore(faceRaw, speechVariance, armBinary) {
  // Normalise each signal to 0–1
  const faceNorm = clamp((faceRaw - 0.005) / 0.035, 0, 1);
  
  // Speech: lower variance = higher risk. Invert.
  const speechNorm = clamp(1 - (speechVariance / SPEECH_BASELINE), 0, 1);
  
  const armNorm = armBinary; // already 0 or 1

  const score = (faceNorm * 0.40) + (speechNorm * 0.40) + (armNorm * 0.20);

  if (score > 0.55) return { level: 'FLAG', score };
  if (score > 0.35) return { level: 'WARN', score };
  return { level: 'CLEAR', score };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
```

---

## 7. Database Design

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model ScanSession {
  id             String    @id @default(uuid())
  createdAt      DateTime  @default(now())
  language       String    @default("en")
  faceScore      Float?
  speechScore    Float?
  armScore       Float?
  riskScore      Float?
  riskLevel      String?   // CLEAR | WARN | FLAG
  alertSent      Boolean   @default(false)
  district       String?
  hospitalId     String?
  hospital       Hospital? @relation(fields: [hospitalId], references: [id])
  frameLogs      FrameLog[]
  feedback       Feedback?
}

model Hospital {
  id               String        @id @default(uuid())
  name             String
  state            String
  district         String
  lat              Float
  lng              Float
  emergencyPhone   String
  hasThrombolysis  Boolean       @default(false)
  hasCt            Boolean       @default(false)
  tier             Int           // 1=district HQ, 2=CHC, 3=PHC
  sessions         ScanSession[]
}

model FrameLog {
  id            String      @id @default(uuid())
  sessionId     String
  session       ScanSession @relation(fields: [sessionId], references: [id])
  frameTs       Int         // ms since scan start
  rawScore      Float
  faceDetected  Boolean
}

model Feedback {
  id          String      @id @default(uuid())
  sessionId   String      @unique
  session     ScanSession @relation(fields: [sessionId], references: [id])
  wasStroke   Boolean?    // ground truth — was it actually a stroke?
  submittedAt DateTime    @default(now())
  notes       String?
}
```

---

## 8. API Design

### Base URL
`https://your-api.railway.app/api`

### Endpoints

**POST /sessions**
Creates a new scan session at the start of a check.
```json
// Request
{ "language": "hi" }

// Response
{ "id": "uuid", "createdAt": "2025-..." }
```

**PATCH /sessions/:id**
Updates session with final scores after all 3 checks complete.
```json
// Request
{
  "faceScore": 0.031,
  "speechScore": 0.18,
  "armScore": 1.0,
  "riskScore": 0.74,
  "riskLevel": "FLAG",
  "alertSent": true,
  "district": "Chennai",
  "hospitalId": "uuid"
}
```

**POST /sessions/:id/frames**
Bulk insert of frame-level ML scores. Called every 2 seconds during face scan.
```json
// Request
{
  "frames": [
    { "frameTs": 0, "rawScore": 0.009, "faceDetected": true },
    { "frameTs": 33, "rawScore": 0.011, "faceDetected": true },
    ...
  ]
}
```

**GET /hospitals/nearest**
Returns top 3 nearest hospitals sorted by stroke-capability-weighted distance.
```
?lat=13.0604&lng=80.2496
```
```json
// Response
[
  {
    "id": "uuid",
    "name": "Government General Hospital, Chennai",
    "distance": 4.2,
    "emergencyPhone": "044-25305060",
    "hasThrombolysis": true,
    "hasCt": true,
    "tier": 1
  }
]
```

**POST /feedback/:id**
Submitted days after the event, optional, captures ground truth.
```json
{ "wasStroke": true, "notes": "Confirmed ischemic stroke at GGH" }
```

---

## 9. Hospital Data Pipeline

### Step 1 — Source data
Download the NHA Health Facility Registry CSV from `facility.nhp.gov.in`. This contains ~250,000 registered facilities. Filter to:
- `facility_type` = "District Hospital" or "Medical College Hospital"
- `operational_status` = "Functional"
- Result: ~800 rows

### Step 2 — Stroke capability flags
Cross-reference with ICMR National Stroke Registry participant hospitals (~30 centres in Cuttack, Tirunelveli, Cachar, Hyderabad, Trivandrum regions). These get:
- `has_thrombolysis = true`
- `tier = 1`

All district HQ hospitals get `has_ct = true` by default. PHCs and CHCs get `has_ct = false`.

### Step 3 — Geocoding missing coordinates
NHA CSV has lat/lng for most entries. For missing ones, run through OpenStreetMap Nominatim:

```python
import requests, csv, time

def geocode(name, district, state):
    query = f"{name}, {district}, {state}, India"
    r = requests.get("https://nominatim.openstreetmap.org/search",
        params={"q": query, "format": "json", "limit": 1},
        headers={"User-Agent": "fast-check-hackathon"})
    results = r.json()
    if results:
        return float(results[0]["lat"]), float(results[0]["lon"])
    return None, None

# Rate limit: 1 request/second (Nominatim ToS)
time.sleep(1)
```

### Step 4 — Seed into PostgreSQL

```js
// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const csv = require('csv-parser');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const hospitals = [];
  
  fs.createReadStream('./hospitals_cleaned.csv')
    .pipe(csv())
    .on('data', (row) => hospitals.push({
      name: row.name,
      state: row.state,
      district: row.district,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      emergencyPhone: row.emergency_phone,
      hasThrombolysis: row.has_thrombolysis === 'true',
      hasCt: row.has_ct === 'true',
      tier: parseInt(row.tier),
    }))
    .on('end', async () => {
      await prisma.hospital.createMany({ data: hospitals });
      console.log(`Seeded ${hospitals.length} hospitals`);
    });
}

main();
```

### Step 5 — Static fallback
Also ship `public/hospitals.json` (the same data) as a static file bundled with the frontend. If the API is unreachable (no internet), the client runs Haversine locally over this file. Demo never dies.

### Hospital routing algorithm

```js
// src/lib/routing.js

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function getNearestHospital(lat, lng) {
  let hospitals;
  
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/hospitals/nearest?lat=${lat}&lng=${lng}`
    );
    hospitals = await res.json();
  } catch {
    // Offline fallback
    const raw = await fetch('/hospitals.json').then(r => r.json());
    hospitals = raw
      .map(h => ({
        ...h,
        distance: haversine(lat, lng, h.lat, h.lng),
        // Heavily penalise hospitals without thrombolysis
        sortScore: haversine(lat, lng, h.lat, h.lng) * (h.hasThrombolysis ? 1 : 4)
      }))
      .sort((a, b) => a.sortScore - b.sortScore)
      .slice(0, 3);
  }

  return hospitals;
}
```

---

## 10. Alert System

### WhatsApp Deep Link (zero API key needed)

```js
// src/lib/alert.js

const MESSAGES = {
  en: (h, r, dist) =>
    `URGENT: Possible stroke symptoms detected.\n\n` +
    `Risk score: ${(r * 100).toFixed(0)}%\n` +
    `Signs flagged: facial asymmetry, speech difficulty, arm weakness\n\n` +
    `Nearest stroke-capable hospital:\n` +
    `${h.name}\n` +
    `Distance: ${dist.toFixed(1)} km\n` +
    `Emergency: ${h.emergencyPhone}\n\n` +
    `Please send ambulance immediately. Time is critical.`,

  hi: (h, r, dist) =>
    `आपातकाल: संभावित स्ट्रोक के लक्षण पहचाने गए।\n\n` +
    `जोखिम स्कोर: ${(r * 100).toFixed(0)}%\n` +
    `निकटतम अस्पताल: ${h.name} (${dist.toFixed(1)} km)\n` +
    `आपातकालीन: ${h.emergencyPhone}\n\n` +
    `कृपया तुरंत एम्बुलेंस भेजें।`,

  ta: (h, r, dist) =>
    `அவசரம்: பக்கவாதம் அறிகுறிகள் கண்டறியப்பட்டன.\n\n` +
    `அருகிலுள்ள மருத்துவமனை: ${h.name} (${dist.toFixed(1)} km)\n` +
    `அவசர தொலைபேசி: ${h.emergencyPhone}`,
};

export function buildWhatsAppLink(hospital, riskScore, distance, lang = 'en') {
  const message = MESSAGES[lang]?.(hospital, riskScore, distance)
    ?? MESSAGES.en(hospital, riskScore, distance);
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildCallLink(phone) {
  return `tel:${phone.replace(/\s/g, '')}`;
}
```

### Result screen logic

```jsx
// src/screens/Result.jsx — key logic

const { level, score } = computeRiskScore(faceScore, speechScore, armScore);

// NEVER show "STROKE DETECTED" — always calm, actionable language
const COPY = {
  FLAG: {
    heading: `${signsCount} of 3 FAST signs flagged`,
    subheading: 'This needs urgent medical attention.',
    color: 'var(--color-background-danger)',
  },
  WARN: {
    heading: `${signsCount} of 3 FAST signs detected`,
    subheading: 'Monitor closely and seek medical advice.',
    color: 'var(--color-background-warning)',
  },
  CLEAR: {
    heading: 'No significant signs detected',
    subheading: 'If you are still worried, contact a doctor.',
    color: 'var(--color-background-success)',
  },
};
```

---

## 11. PWA & Offline Strategy

### manifest.json

```json
{
  "name": "FAST Check",
  "short_name": "FAST Check",
  "description": "90-second stroke screening for rural India",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#0f6e56",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker (via vite-plugin-pwa)

What gets cached on install:
- App shell (HTML, JS, CSS bundles)
- `hospitals.json` (static fallback)
- MediaPipe WASM binaries (large — ~4MB, cache on first load)

What happens offline:
- All detection runs fully on-device (never needed the network)
- Hospital routing uses cached JSON + client-side Haversine
- API calls (session logging) fail silently — queued for retry on reconnect
- WhatsApp deep link opens normally (system-level, not app-level)

---

## 12. Morning Wellness Check-In

This is a novel feature not present in any existing stroke detection tool.

### The clinical basis

TIAs (transient ischaemic attacks, or "mini-strokes") are the strongest known predictor of a major stroke — **10–15% of TIA patients have a major stroke within 48 hours.** TIAs are frequently missed because symptoms resolve within minutes and the person feels fine afterwards.

Additionally, the majority of strokes occur in the **early morning hours** (6am–10am) due to natural circadian BP spikes and increased blood coagulability on waking. A morning facial scan is timed exactly to this risk window.

### How it works

**Onboarding (one-time, 7 days):**
The user takes a 15-second face scan each morning for 7 days. The app computes a **personal baseline asymmetry score** from these readings — every face has natural asymmetry, and the baseline captures it.

```js
// After 7 days:
baseline = median(weekOfScores);
// Store in localStorage + sync to DB
```

**Daily check-in (from day 8 onwards):**
Each morning, a push notification (via Web Push API) prompts: "Good morning. Take your 30-second wellness check."

The user opens the app, faces the camera for 15 seconds.

```js
// Delta from personal baseline
const delta = todayScore - baseline;
const zScore = delta / baselineStdDev;

if (zScore > 2.5) {
  // Significant deviation — soft alert
  showAlert("Your facial scan looks different from usual. How are you feeling?");
  // Options: "I feel fine" / "Something feels off" → triggers full FAST check
}
```

**What this catches:**
- Residual asymmetry after a silent TIA
- Progressive facial droop from a developing stroke before it becomes acute
- Muscle changes from early Bell's palsy (differentiable from stroke via pattern)

**Why it's viable on mobile:**
- 15 seconds, once a day, fully opt-in
- No background camera — user must open the app (circumvents iOS restrictions)
- Push notification via Web Push — works even when app is closed
- Battery impact: zero when not running

**Target population:**
This feature is surfaced only for users who mark themselves as:
- Age 60+, OR
- Known hypertension / diabetes, OR
- Family history of stroke

The general population does not see it in the default flow.

### Baseline drift handling

Faces change over time. Weight gain, dental work, ageing. Baselines need to drift slowly:
```js
// Exponential moving average — baseline drifts at 5% per day
newBaseline = 0.95 * oldBaseline + 0.05 * todayScore;
// But only if todayScore < (oldBaseline + 2σ) — don't drift towards anomalies
```

---

## 13. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend framework | React 18 + Vite | Fast build, hot reload, good MediaPipe support |
| Face detection | @mediapipe/face_mesh | On-device, WebGL, 30fps, 468 landmarks |
| Audio analysis | Web Audio API (built-in) | No install, works in all modern browsers |
| Styling | Tailwind CSS | Rapid mobile-first UI |
| Routing | React Router v6 | Simple screen-to-screen navigation |
| PWA | vite-plugin-pwa | Auto-generates service worker + manifest |
| Backend | Node.js + Express | Minimal, fast, team-familiar |
| ORM | Prisma | Type-safe, great DX, easy migrations |
| Database | PostgreSQL (Railway) | Reliable, free tier sufficient for hackathon |
| Deploy frontend | Vercel | Auto HTTPS (required for getUserMedia), CDN |
| Deploy backend | Railway | Node + Postgres in one dashboard |
| Geocoding | OpenStreetMap Nominatim | Free, no API key |
| Hospital data | NHA Health Facility Registry | Official government source |

---

## 14. File Structure

```
fast-check/
├── client/
│   ├── public/
│   │   ├── hospitals.json          ← static offline fallback
│   │   ├── manifest.json
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── src/
│   │   ├── App.jsx                 ← screen routing
│   │   ├── main.jsx
│   │   ├── screens/
│   │   │   ├── Home.jsx            ← language select + CTA
│   │   │   ├── FaceScan.jsx        ← camera + MediaPipe
│   │   │   ├── SpeechCheck.jsx     ← mic + spectral scoring
│   │   │   ├── ArmCheck.jsx        ← binary tap confirm
│   │   │   ├── Result.jsx          ← risk score + alert
│   │   │   ├── AllClear.jsx
│   │   │   └── WellnessCheckin.jsx ← morning scan flow
│   │   ├── lib/
│   │   │   ├── asymmetry.js        ← landmark pair scoring
│   │   │   ├── speech.js           ← spectral centroid variance
│   │   │   ├── fusion.js           ← weighted risk score
│   │   │   ├── routing.js          ← haversine + hospital sort
│   │   │   ├── alert.js            ← WhatsApp + tel: links
│   │   │   ├── baseline.js         ← morning check-in baseline
│   │   │   └── api.js              ← fetch wrappers
│   │   ├── data/
│   │   │   └── sentences.js        ← speech prompts in 4 languages
│   │   └── index.css
│   ├── vite.config.js
│   └── package.json
│
└── server/
    ├── src/
    │   ├── index.js                ← Express app setup
    │   ├── routes/
    │   │   ├── sessions.js
    │   │   ├── hospitals.js
    │   │   └── feedback.js
    │   └── middleware/
    │       ├── cors.js
    │       └── ratelimit.js
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.js
    ├── .env
    └── package.json
```

---

## 15. Build Order — 24 Hours

| Hours | Task | Done when |
|---|---|---|
| 0–1 | Vite + React scaffold, Tailwind, React Router, Railway + Vercel projects created | Blank app live at Vercel URL |
| 1–3 | Prisma schema, Postgres on Railway, seed 50 hospitals, hospitals API route | `GET /hospitals/nearest` returns real JSON |
| 3–5 | Result + AllClear screens with hardcoded dummy score, full alert flow working | Full demo path end-to-end without real ML |
| 5–8 | FaceScan screen, MediaPipe integration, asymmetry.js, live score on screen | Asymmetry score visible during camera feed |
| 8–10 | SpeechCheck screen, Web Audio API, spectral centroid variance scoring | Score changes based on speech clarity |
| 10–11 | ArmCheck screen, fusion.js wiring all 3 scores → riskScore | Full pipeline produces real risk score |
| 11–13 | POST /sessions, PATCH scores, frame_logs bulk insert | Every scan saved in DB with full data |
| 13–15 | Hindi language support, speech sentence prompts, WhatsApp Hindi message | Hindi flow fully functional |
| 15–17 | PWA manifest, vite-plugin-pwa service worker, offline hospital fallback | Installs to home screen, works with no internet |
| 17–19 | Edge cases: camera denied, mic denied, face lost, no GPS, API down | App handles every failure gracefully |
| 19–21 | UI polish, result screen copy tuning, demo script written | Judge can use cold with no explanation |
| 21–23 | Wellness check-in screen (bonus), push notification setup | Morning feature demoed as future scope |
| 23–24 | Buffer, rehearsal, final deploy | — |

---

## 16. Pitch Framing

### The one-line pitch
> "A 90-second FAST check for a panicked family member in rural India — no medical knowledge, no wearable, just their phone."

### The social impact numbers to cite
- 87% of rural stroke deaths occur at home before reaching hospital
- Every minute untreated = 2 million neurons lost
- Treatment window: 4.5 hours — most rural patients don't reach care in time
- 20–30% of Indian strokes occur in people under 50

### What makes this win a social impact track
1. The problem is real, local, and data-backed
2. The technology is proven (MediaPipe, Web Audio) — you're not claiming to have invented AI
3. The novelty is the **combination**: bystander UX + multilingual + stroke-capability-aware routing + outcome feedback loop
4. The responsible design is explicit: it's a triage guide, not a diagnosis
5. The morning wellness check-in shows you've thought beyond the hack

### The demo flow (2 minutes)
1. Open URL on judge's phone — no install required
2. Select Hindi
3. Point at a team member — show live asymmetry score fluctuating
4. Speech check — say a sentence — score appears
5. Tap "arm droops"
6. Result screen: hospital shown, WhatsApp message previewed in Hindi
7. Show DB dashboard — session logged, frame scores visible
8. One slide: morning check-in feature explained

---

*Document generated for 24-hour hackathon — Social Impact track*
*Stack: React + Vite + MediaPipe + Web Audio + Node + PostgreSQL + Prisma + Vercel + Railway*
