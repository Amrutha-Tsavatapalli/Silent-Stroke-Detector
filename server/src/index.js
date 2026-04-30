import 'dotenv/config';
import express from 'express';
import corsMiddleware from './middleware/cors.js';
import sessionRateLimiter from './middleware/ratelimit.js';
import sessionsRouter from './routes/sessions.js';
import hospitalsRouter from './routes/hospitals.js';
import feedbackRouter from './routes/feedback.js';
import alertsRouter from './routes/alerts.js';
import telemetryRouter from './routes/telemetry.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Apply CORS globally before all routes
app.use(corsMiddleware);

// Body parser
app.use(express.json());

// Mount routers
// Rate limiter applied specifically to POST /api/sessions via the sessions router mount
app.use('/api/sessions', sessionRateLimiter, sessionsRouter);
app.use('/api/hospitals', hospitalsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/telemetry', telemetryRouter);

// Global error handler — must have 4 arguments to be recognised by Express
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message, detail: err.stack });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;
