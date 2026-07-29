import Redis from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

/**
 * Validates a rate limit for an API Key using a Fixed Window algorithm
 * @param apiKeyId The unique identifier of the API Key
 * @param limitPerMinute The maximum allowed requests per minute
 * @returns { allowed: boolean, remaining: number, reset: number }
 */
export async function checkRateLimit(apiKeyId: string, limitPerMinute: number = 60) {
  const currentMinute = Math.floor(Date.now() / 60000);
  const key = `ratelimit:${apiKeyId}:${currentMinute}`;
  
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, 120);
  const results = await pipeline.exec();
  
  const currentRequests = results?.[0]?.[1] as number;
  
  const allowed = currentRequests <= limitPerMinute;
  const remaining = Math.max(0, limitPerMinute - currentRequests);
  const reset = (currentMinute + 1) * 60000;
  
  return {
    allowed,
    remaining,
    reset,
    currentRequests
  };
}
