-- PostgreSQL schema for FAST Check ML Pipeline Migration
-- Requirements: 8.1–8.12

-- hospitals must be created BEFORE scan_sessions (FK dependency)
CREATE TABLE IF NOT EXISTS hospitals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  state             TEXT        NOT NULL,
  district          TEXT        NOT NULL,
  lat               NUMERIC(9,6) NOT NULL,
  lng               NUMERIC(9,6) NOT NULL,
  emergency_phone   TEXT        NOT NULL,
  has_thrombolysis  BOOLEAN     NOT NULL DEFAULT FALSE,
  has_ct            BOOLEAN     NOT NULL DEFAULT FALSE,
  tier              INTEGER     NOT NULL,

  CONSTRAINT chk_hospitals_lat  CHECK (lat  BETWEEN -90  AND 90),
  CONSTRAINT chk_hospitals_lng  CHECK (lng  BETWEEN -180 AND 180),
  CONSTRAINT chk_hospitals_tier CHECK (tier IN (1, 2, 3))
);

CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals(lat, lng);

-- scan_sessions references hospitals(id)
CREATE TABLE IF NOT EXISTS scan_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  language     TEXT        NOT NULL DEFAULT 'en',
  face_score   NUMERIC(6,4),
  speech_score NUMERIC(6,4),
  arm_score    NUMERIC(3,2),
  risk_score   NUMERIC(6,4),
  risk_level   TEXT,
  alert_sent   BOOLEAN     NOT NULL DEFAULT FALSE,
  district     TEXT,
  hospital_id  UUID        REFERENCES hospitals(id),

  CONSTRAINT chk_sessions_language    CHECK (language IN ('en', 'hi', 'ta', 'te')),
  CONSTRAINT chk_sessions_risk_level  CHECK (risk_level IS NULL OR risk_level IN ('CLEAR', 'WARN', 'FLAG')),
  CONSTRAINT chk_sessions_face_score  CHECK (face_score   IS NULL OR (face_score   BETWEEN 0 AND 1)),
  CONSTRAINT chk_sessions_speech_score CHECK (speech_score IS NULL OR (speech_score BETWEEN 0 AND 1)),
  CONSTRAINT chk_sessions_arm_score   CHECK (arm_score    IS NULL OR (arm_score    BETWEEN 0 AND 1)),
  CONSTRAINT chk_sessions_risk_score  CHECK (risk_score   IS NULL OR (risk_score   BETWEEN 0 AND 1))
);

-- frame_logs references scan_sessions(id) with CASCADE delete
CREATE TABLE IF NOT EXISTS frame_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
  frame_ts      INTEGER     NOT NULL,
  raw_score     NUMERIC(8,6) NOT NULL,
  face_detected BOOLEAN     NOT NULL,

  CONSTRAINT chk_frame_logs_frame_ts   CHECK (frame_ts  >= 0),
  CONSTRAINT chk_frame_logs_raw_score  CHECK (raw_score >= 0)
);

CREATE INDEX IF NOT EXISTS idx_frame_logs_session ON frame_logs(session_id);

-- feedback references scan_sessions(id) with UNIQUE constraint (one per session)
CREATE TABLE IF NOT EXISTS feedback (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL UNIQUE REFERENCES scan_sessions(id),
  was_stroke   BOOLEAN,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes        TEXT
);
