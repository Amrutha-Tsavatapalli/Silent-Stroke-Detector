import cors from "cors";
import express from "express";
import { config } from "./config.js";
import healthRoutes from "./routes/healthRoutes.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";
import screeningRoutes from "./routes/screeningRoutes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "Silent Stroke Detector API",
    version: "1.0.0",
  });
});

app.use("/health", healthRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/screenings", screeningRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    error: "Internal server error",
    detail: error.message,
  });
});

app.listen(config.port, () => {
  console.log(`Silent Stroke Detector backend listening on port ${config.port}`);
});
