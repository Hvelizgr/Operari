import { Request, Response } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { RedisStore } from 'rate-limit-redis';
import { redisConfig } from '../config/redis.config';
import { logger } from '../services/logger.service';

/**
 * Rate limit configuration for different endpoint types
 */
export enum RateLimitTier {
  AUTH = 'auth', // Login, register: 5 req/min
  EXECUTION = 'execution', // Workflow execution: 20 req/min
  STANDARD = 'standard', // CRUD operations: 100 req/min
  WEBHOOK = 'webhook', // Public webhooks: 1000 req/min
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

/**
 * Rate limit configurations by tier
 * These can be easily adjusted without code changes by moving to environment variables
 */
const RATE_LIMIT_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
  [RateLimitTier.AUTH]: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
  },
  [RateLimitTier.EXECUTION]: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
  },
  [RateLimitTier.STANDARD]: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
  },
  [RateLimitTier.WEBHOOK]: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // 1000 requests per minute
  },
};

/**
 * Extract user identifier from request
 * Priority: userId from JWT > tenantId from JWT > IP address
 * This ensures authenticated users get per-user limits, while unauthenticated fall back to IP
 */
const getUserIdentifier = (req: Request): string => {
  // Try to extract from JWT without failing the request
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId?: string;
        tenantId?: string;
      };

      // Prefer userId for most granular control
      if (decoded.userId) {
        return `user:${decoded.userId}`;
      }

      // Fall back to tenantId for tenant-level limiting
      if (decoded.tenantId) {
        return `tenant:${decoded.tenantId}`;
      }
    } catch (error) {
      // Token invalid or expired, fall through to IP-based limiting
    }
  }

  // For unauthenticated requests or invalid tokens, use IP
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
};

/**
 * Create a rate limiter for a specific tier
 * Uses RedisStore if available, otherwise falls back to memory store by default (express-rate-limit built-in)
 */
export const createRateLimiter = (tier: RateLimitTier): RateLimitRequestHandler => {
  const config = RATE_LIMIT_CONFIGS[tier];
  const redisClient = redisConfig.getClient();

  // Configure store if Redis is available
  let store;
  if (redisClient && redisConfig.isReady()) {
    store = new RedisStore({
      // @ts-expect-error - Expected by library type definition issues
      sendCommand: (...args: string[]) => redisClient.call(...args),
      prefix: `ratelimit:${tier}:`,
    });
    logger.debug(`Using Redis store for rate limit tier: ${tier}`, {
      context: { nodeId: '', nodeName: '', nodeType: '' },
    });
  } else {
    logger.warn(`Using in-memory store for rate limit tier: ${tier} (Redis not available)`, {
      context: { nodeId: '', nodeName: '', nodeType: '' },
    });
  }

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    store: store, // If undefined, express-rate-limit uses MemoryStore

    // Use custom key generator for per-user/tenant limiting
    keyGenerator: (req: Request) => {
      const userIdentifier = getUserIdentifier(req);
      return `${tier}:${userIdentifier}`;
    },

    // Add standard rate limit headers
    standardHeaders: true,
    legacyHeaders: false,

    // Custom handler to add Retry-After header
    handler: (req: Request, res: Response) => {
      const retryAfter = Math.ceil(config.windowMs / 1000); // Convert to seconds

      res
        .status(429)
        .set('Retry-After', retryAfter.toString())
        .json({
          error: 'Too many requests',
          message: `Rate limit exceeded for ${tier} endpoints. Please try again in ${retryAfter} seconds.`,
          retryAfter,
          tier,
        });
    },

    // Skip rate limiting for health/liveness probes. Uptime
    // monitors hit these every 30-60s per checker; counting them
    // against the limit would either false-alarm or force us to
    // whitelist monitor IPs per customer.
    skip: (req: Request) => {
      return req.path === '/health' || req.path === '/live';
    },
  });
};

/**
 * Pre-configured rate limiters for each tier
 * Export these for use in server.ts
 */
export const authRateLimiter = createRateLimiter(RateLimitTier.AUTH);
export const executionRateLimiter = createRateLimiter(RateLimitTier.EXECUTION);
export const standardRateLimiter = createRateLimiter(RateLimitTier.STANDARD);
export const webhookRateLimiter = createRateLimiter(RateLimitTier.WEBHOOK);

/**
 * Login-specific rate limit keyed on the *email* the caller tried, not
 * just the IP. Defends against credential stuffing distributed across
 * many IPs against one account — the IP-based `authRateLimiter` can't
 * see that. 5 tries per minute per email is tight enough to kill
 * automated attempts but still fine for a legit user mistyping.
 */
export const loginEmailRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: (() => {
    const client = redisConfig.getClient();
    if (client && redisConfig.isReady()) {
      return new RedisStore({
        // @ts-expect-error - Expected by library type definition issues
        sendCommand: (...args: string[]) => client.call(...args),
        prefix: 'ratelimit:auth-email:',
      });
    }
    return undefined;
  })(),
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      // No email in body → fall through to the IP-based limiter
      // by skipping (keyed on IP so it effectively no-ops here).
      return `no-email:${req.ip ?? 'unknown'}`;
    }
    return `email:${email}`;
  },
  skip: (req: Request) => {
    // Only applied to the /login POST. If the shape ever drifts,
    // let the request through so we don't break legitimate flows.
    if (typeof req.body?.email !== 'string') return true;
    return false;
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).set('Retry-After', '60').json({
      error: 'Too many login attempts',
      message: 'Too many login attempts for this email. Wait a minute and try again.',
      retryAfter: 60,
    });
  },
});

/**
 * Cleanup function for graceful shutdown
 */
export const cleanupRateLimiters = async (): Promise<void> => {
  await redisConfig.quit();
};
