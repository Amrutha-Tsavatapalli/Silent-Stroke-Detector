import request from "supertest";
import express from "express";
import { pool } from "../../src/db.js";
import screeningRoutes from "../../src/routes/screeningRoutes.js";
import authRoutes from "../../src/routes/authRoutes.js";

// Create a test app
const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/screenings", screeningRoutes);

// Error handler
app.use((error, _req, res, _next) => {
  res.status(500).json({
    error: "Internal server error",
    detail: error.message,
  });
});

describe("Enhanced Screening Routes Integration Tests", () => {
  let authToken;
  let testScreeningId;

  // Setup: Create a test user and get auth token
  beforeAll(async () => {
    await pool.query("DELETE FROM users");
    await pool.query("DELETE FROM alert_events");
    await pool.query("DELETE FROM screenings");

    // Register and login to get token
    await request(app).post("/api/auth/register").send({
      username: "testuser",
      password: "password123",
      role: "viewer",
    });

    const loginResponse = await request(app).post("/api/auth/login").send({
      username: "testuser",
      password: "password123",
    });

    authToken = loginResponse.body.token;

    // Create test screenings
    const screening1 = {
      patient_name: "John Doe",
      location: "New York",
      scenario_label: "test",
      created_at: new Date("2024-01-01").toISOString(),
      fusion: {
        risk_score: 0.8,
        decision: "HIGH_RISK",
        model_type: "ensemble",
      },
      alert: {
        should_alert: true,
        priority: "HIGH",
        hospital_name: "Test Hospital",
        hospital_phone: "123-456-7890",
        message: "High risk detected",
      },
      face: { symmetry_score: 0.7 },
      voice: { slur_detected: true },
    };

    const response1 = await request(app)
      .post("/api/screenings")
      .set("Authorization", `Bearer ${authToken}`)
      .send(screening1);

    testScreeningId = response1.body.screeningId;

    // Create more screenings for the same patient
    const screening2 = {
      ...screening1,
      created_at: new Date("2024-01-02").toISOString(),
      fusion: { ...screening1.fusion, risk_score: 0.6 },
    };

    const screening3 = {
      ...screening1,
      created_at: new Date("2024-01-03").toISOString(),
      fusion: { ...screening1.fusion, risk_score: 0.5 },
    };

    await request(app)
      .post("/api/screenings")
      .set("Authorization", `Bearer ${authToken}`)
      .send(screening2);

    await request(app)
      .post("/api/screenings")
      .set("Authorization", `Bearer ${authToken}`)
      .send(screening3);

    // Create screening for different patient
    const screening4 = {
      ...screening1,
      patient_name: "Jane Smith",
      location: "Los Angeles",
      created_at: new Date("2024-01-04").toISOString(),
      fusion: { ...screening1.fusion, risk_score: 0.9 },
      alert: { ...screening1.alert, priority: "CRITICAL" },
    };

    await request(app)
      .post("/api/screenings")
      .set("Authorization", `Bearer ${authToken}`)
      .send(screening4);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("GET /api/screenings/:id", () => {
    it("should return complete screening with alert events", async () => {
      const response = await request(app)
        .get(`/api/screenings/${testScreeningId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("id", testScreeningId);
      expect(response.body).toHaveProperty("patient_name", "John Doe");
      expect(response.body).toHaveProperty("location", "New York");
      expect(response.body).toHaveProperty("risk_score");
      expect(response.body).toHaveProperty("face_payload");
      expect(response.body).toHaveProperty("voice_payload");
      expect(response.body).toHaveProperty("alert_events");
      expect(response.body).toHaveProperty("nearest_hospital");
      expect(Array.isArray(response.body.alert_events)).toBe(true);
    });

    it("should return 404 for non-existent screening ID", async () => {
      const response = await request(app)
        .get("/api/screenings/99999")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe("Not Found");
      expect(response.body.detail).toBe("Screening not found");
    });

    it("should return 401 without authentication", async () => {
      await request(app).get(`/api/screenings/${testScreeningId}`).expect(401);
    });
  });

  describe("GET /api/screenings/patient/:patientName", () => {
    it("should return patient screenings with trend", async () => {
      const response = await request(app)
        .get("/api/screenings/patient/John%20Doe")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(response.body).toHaveProperty("trend");
      expect(response.body).toHaveProperty("total");
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBe(3);
      expect(response.body.trend).toBe("improving"); // Risk scores: 0.8 -> 0.6 -> 0.5
      expect(response.body.total).toBe(3);
    });

    it("should return screenings ordered by date descending", async () => {
      const response = await request(app)
        .get("/api/screenings/patient/John%20Doe")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const items = response.body.items;
      expect(items[0].risk_score).toBe("0.5000"); // Most recent
      expect(items[2].risk_score).toBe("0.8000"); // Oldest
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/screenings/patient/John%20Doe?limit=2&offset=1")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(2);
      expect(response.body.total).toBe(3);
    });
  });

  describe("GET /api/screenings/search", () => {
    it("should filter by patient name (partial match)", async () => {
      const response = await request(app)
        .get("/api/screenings/search?patientName=John")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(3);
      expect(response.body.items.every((s) => s.patient_name === "John Doe")).toBe(true);
    });

    it("should filter by location (partial match)", async () => {
      const response = await request(app)
        .get("/api/screenings/search?location=Los")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(1);
      expect(response.body.items[0].location).toBe("Los Angeles");
    });

    it("should filter by risk score range", async () => {
      const response = await request(app)
        .get("/api/screenings/search?riskScoreMin=0.7&riskScoreMax=0.85")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(1);
      expect(parseFloat(response.body.items[0].risk_score)).toBe(0.8);
    });

    it("should filter by priority", async () => {
      const response = await request(app)
        .get("/api/screenings/search?priority=CRITICAL")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(1);
      expect(response.body.items[0].priority).toBe("CRITICAL");
    });

    it("should filter by shouldAlert", async () => {
      const response = await request(app)
        .get("/api/screenings/search?shouldAlert=true")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
      expect(response.body.items.every((s) => s.should_alert === true)).toBe(true);
    });

    it("should apply multiple filters with AND logic", async () => {
      const response = await request(app)
        .get("/api/screenings/search?patientName=John&riskScoreMin=0.6&riskScoreMax=0.7")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(1);
      expect(response.body.items[0].patient_name).toBe("John Doe");
      expect(parseFloat(response.body.items[0].risk_score)).toBe(0.6);
    });

    it("should return filters in response", async () => {
      const response = await request(app)
        .get("/api/screenings/search?patientName=John&location=New")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.filters).toEqual({
        patientName: "John",
        location: "New",
      });
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/screenings/search?limit=2&offset=0")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.length).toBe(2);
      expect(response.body.total).toBe(4);
    });
  });
});
