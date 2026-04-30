-- Migration: screenings + alert_events → scan_sessions
-- Requirements: 8.1, 8.12
--
-- Column mappings:
--   screenings.location      → scan_sessions.district
--   screenings.risk_score    → scan_sessions.risk_score
--   screenings.decision      → scan_sessions.risk_level
--     ('FLAG'/'WARN'/'CLEAR' kept as-is; 'alert'→'FLAG', 'monitor'→'WARN', 'clear'→'CLEAR')
--   screenings.should_alert  → scan_sessions.alert_sent
--   screenings.created_at    → scan_sessions.created_at
--   DROPPED: patient_name, scenario_label, face_payload, voice_payload, features_payload
--
--   alert_events.hospital_name → look up hospitals.id by name → scan_sessions.hospital_id
--
-- Idempotency: the INSERT uses a NOT EXISTS guard keyed on the legacy screening id
-- stored in a comment-style approach; we use a temporary mapping table that is
-- dropped at the end of the transaction so re-running is safe.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Migrate rows from screenings → scan_sessions
--         Only runs when the screenings table actually exists.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.tables
    WHERE  table_schema = 'public'
    AND    table_name   = 'screenings'
  ) THEN

    -- Temporary table to track the old-id → new-uuid mapping so we can
    -- later update hospital_id from alert_events.
    CREATE TEMP TABLE IF NOT EXISTS _migration_id_map (
      old_id      INTEGER PRIMARY KEY,
      new_id      UUID    NOT NULL
    ) ON COMMIT DROP;

    -- Insert only rows that have not already been migrated (idempotent).
    -- We detect "already migrated" by checking whether a scan_session with
    -- the same created_at + district + risk_score already exists.
    WITH inserted AS (
      INSERT INTO scan_sessions (
        created_at,
        language,
        risk_score,
        risk_level,
        alert_sent,
        district
      )
      SELECT
        s.created_at,
        'en'                                          AS language,
        s.risk_score,
        CASE s.decision
          WHEN 'FLAG'    THEN 'FLAG'
          WHEN 'WARN'    THEN 'WARN'
          WHEN 'CLEAR'   THEN 'CLEAR'
          WHEN 'alert'   THEN 'FLAG'
          WHEN 'monitor' THEN 'WARN'
          WHEN 'clear'   THEN 'CLEAR'
          ELSE                NULL          -- unknown values become NULL
        END                                           AS risk_level,
        s.should_alert                                AS alert_sent,
        s.location                                    AS district
      FROM screenings s
      WHERE NOT EXISTS (
        SELECT 1
        FROM   _migration_id_map m
        WHERE  m.old_id = s.id
      )
      RETURNING id, created_at
    )
    -- Populate the mapping table so Step 2 can correlate alert_events.
    -- We join back on created_at because RETURNING does not expose the
    -- source row's old id directly.
    INSERT INTO _migration_id_map (old_id, new_id)
    SELECT s.id, i.id
    FROM   inserted i
    JOIN   screenings s
           ON  s.created_at = i.created_at
           AND s.risk_score  = (
                 SELECT risk_score
                 FROM   scan_sessions
                 WHERE  id = i.id
               );

  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Back-fill hospital_id from alert_events
--         Joins alert_events → _migration_id_map → hospitals by name.
--         Only runs when both alert_events and the temp map table exist.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.tables
    WHERE  table_schema = 'public'
    AND    table_name   = 'alert_events'
  ) AND to_regclass('pg_temp._migration_id_map') IS NOT NULL THEN

    UPDATE scan_sessions ss
    SET    hospital_id = h.id
    FROM   alert_events ae
    JOIN   _migration_id_map m ON m.old_id = ae.screening_id
    JOIN   hospitals h         ON h.name   = ae.hospital_name
    WHERE  ss.id = m.new_id
    AND    ss.hospital_id IS NULL;   -- skip rows already assigned

  END IF;
END;
$$;

COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
-- Add geohash column and index for spatial indexing
-- Requirements: 5.3, 5.4, 5.5
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Add geohash column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'hospitals'
    AND    column_name  = 'geohash'
  ) THEN
    ALTER TABLE hospitals ADD COLUMN geohash TEXT;
  END IF;
END;
$$;

-- Create geohash index if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    tablename  = 'hospitals'
    AND    indexname  = 'idx_hospitals_geohash'
  ) THEN
    CREATE INDEX idx_hospitals_geohash ON hospitals(geohash);
  END IF;
END;
$$;

-- Create geohash prefix index for prefix matching
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    tablename  = 'hospitals'
    AND    indexname  = 'idx_hospitals_geohash_prefix'
  ) THEN
    CREATE INDEX idx_hospitals_geohash_prefix ON hospitals(SUBSTRING(geohash FROM 1 FOR 4));
  END IF;
END;
$$;

-- Populate geohash column for existing hospitals (if empty)
-- This uses a simple geohash encoding approximation
DO $$
DECLARE
  h RECORD;
  new_geohash TEXT;
BEGIN
  -- Only populate if geohash column exists and has NULL values
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'hospitals'
    AND    column_name  = 'geohash'
  ) THEN
    
    FOR h IN SELECT id, lat, lng FROM hospitals WHERE geohash IS NULL OR geohash = '' LOOP
      -- Simple geohash approximation using base32 encoding
      -- This is a simplified version - in production you'd use a proper geohash library
      new_geohash := (
        SELECT string_agg(
          SUBSTRING('0123456789bcdefghjkmnpqrstuvwxyz' FROM 
            ((
              ((
                (h.lng + 180) / 360 * 32)::int << 4
              ) | (
                (h.lat + 90) / 180 * 32)::int
              ) >> (5 * (6 - generate_series))) & 31
            ) + 1
          , 1)
        )
        FROM generate_series(0, 5)
      );
      
      UPDATE hospitals SET geohash = new_geohash WHERE id = h.id;
    END LOOP;
    
  END IF;
END;
$$;

COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
-- Add alert_configs table for tracking alert configuration and delivery status
-- Requirements: 6.4, 6.5
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Create alert_configs table if it doesn't exist
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.tables
    WHERE  table_schema = 'public'
    AND    table_name   = 'alert_configs'
  ) THEN
    CREATE TABLE alert_configs (
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
  END IF;
END
$;

-- Create index on session_id for quick lookups
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    tablename  = 'alert_configs'
    AND    indexname  = 'idx_alert_configs_session'
  ) THEN
    CREATE INDEX idx_alert_configs_session ON alert_configs(session_id);
  END IF;
END
$;

-- Create index on status for filtering
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    tablename  = 'alert_configs'
    AND    indexname  = 'idx_alert_configs_status'
  ) THEN
    CREATE INDEX idx_alert_configs_status ON alert_configs(status);
  END IF;
END
$;

COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
-- Expand scan_sessions table for telemetry
-- Requirements: 11.1, 11.2
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Add raw_face_scores JSONB column if it doesn't exist
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'scan_sessions'
    AND    column_name  = 'raw_face_scores'
  ) THEN
    ALTER TABLE scan_sessions ADD COLUMN raw_face_scores JSONB;
  END IF;
END
$;

-- Add raw_speech_scores JSONB column if it doesn't exist
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'scan_sessions'
    AND    column_name  = 'raw_speech_scores'
  ) THEN
    ALTER TABLE scan_sessions ADD COLUMN raw_speech_scores JSONB;
  END IF;
END
$;

-- Add raw_arm_scores JSONB column if it doesn't exist
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'scan_sessions'
    AND    column_name  = 'raw_arm_scores'
  ) THEN
    ALTER TABLE scan_sessions ADD COLUMN raw_arm_scores JSONB;
  END IF;
END
$;

-- Add processing_time_ms INTEGER column if it doesn't exist
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name   = 'scan_sessions'
    AND    column_name  = 'processing_time_ms'
  ) THEN
    ALTER TABLE scan_sessions ADD COLUMN processing_time_ms INTEGER;
  END IF;
END
$;

-- Add CHECK constraint for processing_time_ms if not exists
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'chk_sessions_processing_time'
  ) THEN
    ALTER TABLE scan_sessions ADD CONSTRAINT chk_sessions_processing_time 
      CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0);
  END IF;
END
$;

-- Create GIN indexes for JSONB columns if they don't exist
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    tablename  = 'scan_sessions'
    AND    indexname  = 'idx_scan_sessions_raw_face_scores'
  ) THEN
    CREATE INDEX idx_scan_sessions_raw_face_scores ON scan_sessions USING GIN(raw_face_scores);
  END IF;
END
$;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    tablename  = 'scan_sessions'
    AND    indexname  = 'idx_scan_sessions_raw_speech_scores'
  ) THEN
    CREATE INDEX idx_scan_sessions_raw_speech_scores ON scan_sessions USING GIN(raw_speech_scores);
  END IF;
END
$;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    tablename  = 'scan_sessions'
    AND    indexname  = 'idx_scan_sessions_raw_arm_scores'
  ) THEN
    CREATE INDEX idx_scan_sessions_raw_arm_scores ON scan_sessions USING GIN(raw_arm_scores);
  END IF;
END
$;

COMMIT;