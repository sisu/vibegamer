import { RateLimiterMemory } from 'rate-limiter-flexible';

const limiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_POINTS ?? '5'),
  duration: parseInt(process.env.RATE_LIMIT_DURATION ?? '3600'),
});

export async function checkRateLimit(ip) {
  try {
    await limiter.consume(ip);
    return { allowed: true };
  } catch {
    return { allowed: false };
  }
}
