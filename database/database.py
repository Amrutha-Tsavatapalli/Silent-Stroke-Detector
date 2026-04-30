from sqlalchemy import create_engine, text

engine = create_engine("postgresql://postgres:QWpmdtSzVTqpWVYFkiQPPYZvAfzLavUB@centerbeam.proxy.rlwy.net:11784/railway")

with engine.connect() as conn:
    # Drop old tables
    conn.execute(text("DROP TABLE IF EXISTS alerts;"))
    conn.execute(text("DROP TABLE IF EXISTS scans;"))
    conn.execute(text("DROP TABLE IF EXISTS hospitals;"))

    # Create correct tables
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS screenings (
            id SERIAL PRIMARY KEY,
            patient_name TEXT,
            face_score FLOAT,
            speech_score FLOAT,
            arm_score FLOAT,
            final_score FLOAT,
            flagged BOOLEAN,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS alert_events (
            id SERIAL PRIMARY KEY,
            screening_id INT REFERENCES screenings(id),
            hospital_name TEXT,
            hospital_phone TEXT,
            hospital_lat FLOAT,
            hospital_lon FLOAT,
            alert_type TEXT,
            sent_at TIMESTAMP DEFAULT NOW()
        );
    """))
    conn.commit()
    print("✅ Correct tables created!")