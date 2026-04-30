CREATE TABLE IF NOT EXISTS screenings (
  id SERIAL PRIMARY KEY,
  patient_name TEXT NOT NULL,
  location TEXT NOT NULL,
  scenario_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  risk_score NUMERIC(5,4) NOT NULL,
  decision TEXT NOT NULL,
  model_type TEXT NOT NULL,
  should_alert BOOLEAN NOT NULL,
  priority TEXT NOT NULL,
  face_payload JSONB NOT NULL,
  voice_payload JSONB NOT NULL,
  features_payload JSONB NOT NULL,
  report_excerpt TEXT,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_events (
  id SERIAL PRIMARY KEY,
  screening_id INTEGER NOT NULL REFERENCES screenings(id) ON DELETE CASCADE,
  hospital_name TEXT NOT NULL,
  hospital_phone TEXT NOT NULL,
  alert_message TEXT NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
