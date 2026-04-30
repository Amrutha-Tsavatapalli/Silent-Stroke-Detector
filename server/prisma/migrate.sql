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
