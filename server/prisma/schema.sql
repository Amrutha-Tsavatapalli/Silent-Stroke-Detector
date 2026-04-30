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
  geohash           TEXT,

  CONSTRAINT chk_hospitals_lat  CHECK (lat  BETWEEN -90  AND 90),
  CONSTRAINT chk_hospitals_lng  CHECK (lng  BETWEEN -180 AND 180),
  CONSTRAINT chk_hospitals_tier CHECK (tier IN (1, 2, 3))
);

CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals(lat, lng);
CREATE INDEX IF NOT EXISTS idx_hospitals_geohash ON hospitals(geohash);
CREATE INDEX IF NOT EXISTS idx_hospitals_geohash_prefix ON hospitals(SUBSTRING(geohash FROM 1 FOR 4));

-- scan_sessions references hospitals(id)
-- Requirements: 11.1, 11.2 - Expanded for telemetry
CREATE TABLE IF NOT EXISTS scan_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  language          TEXT        NOT NULL DEFAULT 'en',
  face_score        NUMERIC(6,4),
  speech_score      NUMERIC(6,4),
  arm_score         NUMERIC(3,2),
  risk_score        NUMERIC(6,4),
  risk_level        TEXT,
  alert_sent        BOOLEAN     NOT NULL DEFAULT FALSE,
  district          TEXT,
  hospital_id       UUID        REFERENCES hospitals(id),
  -- Telemetry columns for continuous score tracking (Requirements 11.1, 11.2)
  raw_face_scores   JSONB,      -- Array of face asymmetry scores over time, e.g., [0.12, 0.15, 0.11, ...]
  raw_speech_scores JSONB,      -- Array of speech variance/MFCC values over time
  raw_arm_scores    JSONB,      -- Array of arm check timestamps and scores, e.g., [{timestamp: 1234567890, score: 0}]
  processing_time_ms INTEGER,   -- Total processing time in milliseconds

  CONSTRAINT chk_sessions_language    CHECK (language IN ('en', 'hi', 'ta', 'te')),
  CONSTRAINT chk_sessions_risk_level  CHECK (risk_level IS NULL OR risk_level IN ('CLEAR', 'WARN', 'FLAG')),
  CONSTRAINT chk_sessions_face_score  CHECK (face_score   IS NULL OR (face_score   BETWEEN 0 AND 1)),
  CONSTRAINT chk_sessions_speech_score CHECK (speech_score IS NULL OR (speech_score BETWEEN 0 AND 1)),
  CONSTRAINT chk_sessions_arm_score   CHECK (arm_score    IS NULL OR (arm_score    BETWEEN 0 AND 1)),
  CONSTRAINT chk_sessions_risk_score  CHECK (risk_score   IS NULL OR (risk_score   BETWEEN 0 AND 1)),
  CONSTRAINT chk_sessions_processing_time CHECK (processing_time_ms IS NULL OR (processing_time_ms >= 0))
);

-- GIN indexes for efficient JSONB queries on telemetry columns
CREATE INDEX IF NOT EXISTS idx_scan_sessions_raw_face_scores ON scan_sessions USING GIN(raw_face_scores);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_raw_speech_scores ON scan_sessions USING GIN(raw_speech_scores);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_raw_arm_scores ON scan_sessions USING GIN(raw_arm_scores);

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

-- alert_configs tracks alert configuration and delivery status
-- Requirements: 6.4, 6.5
CREATE TABLE IF NOT EXISTS alert_configs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID        NOT NULL REFERENCES scan_sessions(id),
  hospital_id         UUID        REFERENCES hospitals(id),
  emergency_phone     TEXT        NOT NULL,
  whatsapp_webhook_url TEXT,
  sms_webhook_url     TEXT,
  sent_at             TIMESTAMPTZ,
  status              TEXT        NOT NULL DEFAULT 'pending',
  message_id          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_alert_configs_status CHECK (status IN ('pending', 'sent', 'failed', 'delivered'))
);

CREATE INDEX IF NOT EXISTS idx_alert_configs_session ON alert_configs(session_id);
CREATE INDEX IF NOT EXISTS idx_alert_configs_status ON alert_configs(status);
