import rateLimit from 'express-rate-limit';

const sessionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // max 10 requests per IP per window
});

export default sessionRateLimiter;
