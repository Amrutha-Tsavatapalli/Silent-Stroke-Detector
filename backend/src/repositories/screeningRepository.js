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

export async function getScreeningById(id) {
  const result = await query(
    `
      SELECT
        s.id,
        s.patient_name,
        s.location,
        s.scenario_label,
        s.created_at,
        s.risk_score,
        s.decision,
        s.model_type,
        s.should_alert,
        s.priority,
        s.face_payload,
        s.voice_payload,
        s.features_payload,
        s.report_excerpt
      FROM screenings s
      WHERE s.id = $1
    `,
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const screening = result.rows[0];
  
  // Get associated alert events
  const alertResult = await query(
    `
      SELECT
        id,
        hospital_name,
        hospital_phone,
        alert_message,
        notification_status,
        twilio_message_sid,
        error_message,
        inserted_at
      FROM alert_events
      WHERE screening_id = $1
      ORDER BY inserted_at DESC
    `,
    [id]
  );
  
  screening.alert_events = alertResult.rows;
  
  return screening;
}

export async function getScreeningsByPatient(patientName, limit = 20, offset = 0) {
  const result = await query(
    `
      SELECT
        s.id,
        s.patient_name,
        s.location,
        s.scenario_label,
        s.created_at,
        s.risk_score,
        s.decision,
        s.model_type,
        s.should_alert,
        s.priority,
        s.face_payload,
        s.voice_payload,
        s.features_payload,
        s.report_excerpt
      FROM screenings s
      WHERE s.patient_name = $1
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [patientName, limit, offset]
  );
  
  // Get alert events for each screening
  const screenings = result.rows;
  for (const screening of screenings) {
    const alertResult = await query(
      `
        SELECT
          id,
          hospital_name,
          hospital_phone,
          alert_message,
          notification_status,
          twilio_message_sid,
          error_message,
          inserted_at
        FROM alert_events
        WHERE screening_id = $1
        ORDER BY inserted_at DESC
      `,
      [screening.id]
    );
    screening.alert_events = alertResult.rows;
  }
  
  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM screenings WHERE patient_name = $1`,
    [patientName]
  );
  
  return {
    items: screenings,
    total: parseInt(countResult.rows[0].total, 10)
  };
}

export async function searchScreenings(filters, limit = 20, offset = 0) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;
  
  // Patient name filter (partial match, case-insensitive)
  if (filters.patientName) {
    conditions.push(`s.patient_name ILIKE $${paramIndex}`);
    params.push(`%${filters.patientName}%`);
    paramIndex++;
  }
  
  // Location filter (partial match, case-insensitive)
  if (filters.location) {
    conditions.push(`s.location ILIKE $${paramIndex}`);
    params.push(`%${filters.location}%`);
    paramIndex++;
  }
  
  // Risk score minimum filter
  if (filters.riskScoreMin !== undefined && filters.riskScoreMin !== null) {
    conditions.push(`s.risk_score >= $${paramIndex}`);
    params.push(filters.riskScoreMin);
    paramIndex++;
  }
  
  // Risk score maximum filter
  if (filters.riskScoreMax !== undefined && filters.riskScoreMax !== null) {
    conditions.push(`s.risk_score <= $${paramIndex}`);
    params.push(filters.riskScoreMax);
    paramIndex++;
  }
  
  // Start date filter
  if (filters.startDate) {
    conditions.push(`s.created_at >= $${paramIndex}`);
    params.push(filters.startDate);
    paramIndex++;
  }
  
  // End date filter
  if (filters.endDate) {
    conditions.push(`s.created_at <= $${paramIndex}`);
    params.push(filters.endDate);
    paramIndex++;
  }
  
  // Should alert filter
  if (filters.shouldAlert !== undefined && filters.shouldAlert !== null) {
    conditions.push(`s.should_alert = $${paramIndex}`);
    params.push(filters.shouldAlert);
    paramIndex++;
  }
  
  // Priority filter
  if (filters.priority) {
    conditions.push(`s.priority = $${paramIndex}`);
    params.push(filters.priority);
    paramIndex++;
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Add limit and offset to params
  params.push(limit);
  const limitParam = paramIndex;
  paramIndex++;
  
  params.push(offset);
  const offsetParam = paramIndex;
  
  const result = await query(
    `
      SELECT
        s.id,
        s.patient_name,
        s.location,
        s.scenario_label,
        s.created_at,
        s.risk_score,
        s.decision,
        s.model_type,
        s.should_alert,
        s.priority,
        s.face_payload,
        s.voice_payload,
        s.features_payload,
        s.report_excerpt
      FROM screenings s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `,
    params
  );
  
  // Get total count with same filters
  const countParams = params.slice(0, -2); // Remove limit and offset
  const countResult = await query(
    `SELECT COUNT(*) as total FROM screenings s ${whereClause}`,
    countParams
  );
  
  return {
    items: result.rows,
    total: parseInt(countResult.rows[0].total, 10)
  };
}

export async function calculatePatientTrend(patientName) {
  // Get the last 3 screenings for the patient
  const result = await query(
    `
      SELECT risk_score
      FROM screenings
      WHERE patient_name = $1
      ORDER BY created_at DESC
      LIMIT 3
    `,
    [patientName]
  );
  
  const screenings = result.rows;
  
  // Need at least 2 screenings to determine a trend
  if (screenings.length < 2) {
    return 'insufficient_data';
  }
  
  // Calculate trend based on risk scores
  // Most recent is at index 0, oldest is at the end
  const riskScores = screenings.map(s => parseFloat(s.risk_score));
  
  // Compare most recent with older screenings
  const mostRecent = riskScores[0];
  const secondMostRecent = riskScores[1];
  
  // If we have 3 screenings, consider all three for better trend detection
  if (riskScores.length === 3) {
    const oldest = riskScores[2];
    
    // Calculate average change
    const recentChange = mostRecent - secondMostRecent;
    const olderChange = secondMostRecent - oldest;
    const avgChange = (recentChange + olderChange) / 2;
    
    // Use a threshold to determine trend (0.05 = 5% change)
    const threshold = 0.05;
    
    if (avgChange < -threshold) {
      return 'improving'; // Risk score decreasing
    } else if (avgChange > threshold) {
      return 'worsening'; // Risk score increasing
    } else {
      return 'stable'; // Risk score relatively unchanged
    }
  } else {
    // With only 2 screenings, compare them directly
    const change = mostRecent - secondMostRecent;
    const threshold = 0.05;
    
    if (change < -threshold) {
      return 'improving';
    } else if (change > threshold) {
      return 'worsening';
    } else {
      return 'stable';
    }
  }
}
