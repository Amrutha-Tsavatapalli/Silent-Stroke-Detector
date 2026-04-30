import cors from 'cors';

const corsMiddleware = cors({
  origin: process.env.FRONTEND_ORIGIN,
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

export default corsMiddleware;
