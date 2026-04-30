import { Router } from "express";
import { config } from "../config.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "silent-stroke-detector-backend",
    env: config.nodeEnv,
  });
});

export default router;
