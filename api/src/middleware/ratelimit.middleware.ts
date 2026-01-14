import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { AuthRequest } from './auth.middleware';

/**
 * Rate limit configuration for different endpoint types
 */
export enum RateLimitTier {
    AUTH = 'auth',           // Login, register: 5 req/min
    EXECUTION = 'execution', // Workflow execution: 20 req/min
    STANDARD = 'standard',   // CRUD operations: 100 req/min
    WEBHOOK = 'webhook',     // Public webhooks: 1000 req/min
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
        windowMs: 1 * 60 * 1000,      // 1 minute
        max: 5,                        // 5 requests per minute
    },
    [RateLimitTier.EXECUTION]: {
        windowMs: 1 * 60 * 1000,      // 1 minute
        max: 20,                       // 20 requests per minute
    },
    [RateLimitTier.STANDARD]: {
        windowMs: 1 * 60 * 1000,      // 1 minute
        max: 100,                      // 100 requests per minute
    },
    [RateLimitTier.WEBHOOK]: {
        windowMs: 1 * 60 * 1000,      // 1 minute
        max: 1000,                     // 1000 requests per minute
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
 * Custom store interface for future Redis integration
 * This abstraction allows easy migration to distributed rate limiting
 */
interface RateLimitStore {
    increment(key: string): Promise<{ totalHits: number; resetTime: Date }>;
    decrement(key: string): Promise<void>;
    resetKey(key: string): Promise<void>;
}

/**
 * In-memory store for single-instance deployments
 * Replace with RedisStore for horizontal scaling
 */
class MemoryStore implements RateLimitStore {
    private hits: Map<string, { count: number; resetTime: number }> = new Map();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Cleanup expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.hits.entries()) {
                if (value.resetTime < now) {
                    this.hits.delete(key);
                }
            }
        }, 5 * 60 * 1000);
    }

    async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
        const now = Date.now();
        const existing = this.hits.get(key);

        if (!existing || existing.resetTime < now) {
            // Create new window
            const resetTime = now + 60 * 1000; // 1 minute from now
            this.hits.set(key, { count: 1, resetTime });
            return { totalHits: 1, resetTime: new Date(resetTime) };
        }

        // Increment existing window
        existing.count++;
        this.hits.set(key, existing);
        return { totalHits: existing.count, resetTime: new Date(existing.resetTime) };
    }

    async decrement(key: string): Promise<void> {
        const existing = this.hits.get(key);
        if (existing && existing.count > 0) {
            existing.count--;
            this.hits.set(key, existing);
        }
    }

    async resetKey(key: string): Promise<void> {
        this.hits.delete(key);
    }

    destroy(): void {
        clearInterval(this.cleanupInterval);
        this.hits.clear();
    }
}

// Singleton memory store instance
const memoryStore = new MemoryStore();

/**
 * Create a rate limiter for a specific tier
 * Designed to be Redis-compatible for future horizontal scaling
 */
export const createRateLimiter = (tier: RateLimitTier): RateLimitRequestHandler => {
    const config = RATE_LIMIT_CONFIGS[tier];

    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,

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

            res.status(429)
                .set('Retry-After', retryAfter.toString())
                .json({
                    error: 'Too many requests',
                    message: `Rate limit exceeded for ${tier} endpoints. Please try again in ${retryAfter} seconds.`,
                    retryAfter,
                    tier,
                });
        },

        // Skip rate limiting for health checks and other whitelisted paths
        skip: (req: Request) => {
            return req.path === '/health';
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
 * Cleanup function for graceful shutdown
 */
export const cleanupRateLimiters = (): void => {
    memoryStore.destroy();
};

/**
 * Future Redis integration example:
 * 
 * import RedisStore from 'rate-limit-redis';
 * import { createClient } from 'redis';
 * 
 * const redisClient = createClient({
 *     url: process.env.REDIS_URL,
 * });
 * 
 * export const createRateLimiter = (tier: RateLimitTier): RateLimitRequestHandler => {
 *     const config = RATE_LIMIT_CONFIGS[tier];
 *     
 *     return rateLimit({
 *         windowMs: config.windowMs,
 *         max: config.max,
 *         store: new RedisStore({
 *             client: redisClient,
 *             prefix: `ratelimit:${tier}:`,
 *         }),
 *         keyGenerator: (req: Request) => {
 *             const userIdentifier = getUserIdentifier(req);
 *             return userIdentifier;
 *         },
 *         // ... rest of configuration
 *     });
 * };
 */
