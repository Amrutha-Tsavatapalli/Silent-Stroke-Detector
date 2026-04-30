import { query } from "../db.js";

export async function createScreening(screening) {
  const insertScreening = await query(
    `
      INSERT INTO screenings (
        patient_name,
        location,
        scenario_label,
        created_at,
        risk_score,
        decision,
        model_type,
        should_alert,
        priority,
        face_payload,
        voice_payload,
        features_payload,
        report_excerpt
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13)
      RETURNING id
    `,
    [
      screening.patient_name,
      screening.location,
      screening.scenario_label,
      screening.created_at,
      screening.fusion.risk_score,
      screening.fusion.decision,
      screening.fusion.model_type,
      screening.alert.should_alert,
      screening.alert.priority,
      JSON.stringify(screening.face),
      JSON.stringify(screening.voice),
      JSON.stringify(screening.features || {}),
      screening.report_excerpt || null,
    ]
  );

  const screeningId = insertScreening.rows[0].id;

  await query(
    `
      INSERT INTO alert_events (
        screening_id,
        hospital_name,
        hospital_phone,
        alert_message
      )
      VALUES ($1, $2, $3, $4)
    `,
    [
      screeningId,
      screening.alert.hospital_name,
      screening.alert.hospital_phone,
      screening.alert.message,
    ]
  );

  return screeningId;
}

export async function listScreenings(limit = 20) {
  const result = await query(
    `
      SELECT
        s.id,
        s.patient_name,
        s.location,
        s.created_at,
        s.risk_score,
        s.decision,
        s.should_alert,
        s.priority,
        a.hospital_name,
        a.hospital_phone
      FROM screenings s
      LEFT JOIN alert_events a ON a.screening_id = s.id
      ORDER BY s.created_at DESC
      LIMIT $1
    `,
    [limit]
  );
  return result.rows;
}
