import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8080),
  databaseUrl: process.env.DATABASE_URL || "",
  alertThreshold: Number(process.env.ALERT_THRESHOLD || 0.7),
  nodeEnv: process.env.NODE_ENV || "development",
};
