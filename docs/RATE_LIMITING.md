# Rate Limiting System Documentation

## Overview

NanoFlow implements a **granular, fair, and horizontally-scalable** rate limiting system designed to protect the API from abuse while ensuring legitimate users have a smooth experience.

## Features

### 1. **Endpoint-Specific Rate Limits**

Different endpoint types have different rate limits based on their resource intensity and security requirements:

| Endpoint Type | Rate Limit | Window | Use Case |
|--------------|------------|--------|----------|
| **Authentication** (`/api/auth/*`) | 5 requests | 1 minute | Login, register, password reset |
| **Execution** (`/api/executions/*`) | 20 requests | 1 minute | Workflow execution |
| **Standard CRUD** (`/api/workflows/*`, `/api/analytics/*`) | 100 requests | 1 minute | Normal operations |
| **Webhooks** (`/webhook/*`) | 1000 requests | 1 minute | High-volume public endpoints |

### 2. **Per-User/Tenant Rate Limiting**

The system intelligently identifies users based on:

1. **User ID** (from JWT) - Most granular, preferred for authenticated requests
2. **Tenant ID** (from JWT) - Tenant-level limiting when user ID unavailable
3. **IP Address** - Fallback for unauthenticated requests

This ensures:
- Authenticated users get fair, individual limits
- Multi-user tenants don't exhaust shared IP limits
- Unauthenticated endpoints are still protected

### 3. **Retry-After Headers**

All `429 Too Many Requests` responses include:
- Standard `Retry-After` header (in seconds)
- Detailed error message with retry time
- Endpoint tier information for debugging

Example response:
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded for auth endpoints. Please try again in 60 seconds.",
  "retryAfter": 60,
  "tier": "auth"
}
```

### 4. **Horizontal Scaling Ready**

The system is architected for easy migration to distributed rate limiting:

- **Current**: In-memory store for single-instance deployments
- **Future**: Redis-based store for multi-instance deployments

The abstraction layer makes switching to Redis a configuration change, not a code rewrite.

## Architecture

### Key Components

#### 1. **Rate Limit Tiers** (`RateLimitTier` enum)
Defines the four endpoint categories with their respective limits.

#### 2. **User Identifier Extraction** (`getUserIdentifier`)
Intelligently extracts the most specific identifier available:
- Parses JWT without failing the request
- Falls back gracefully to IP-based limiting
- Prefixes identifiers for clarity (`user:`, `tenant:`, `ip:`)

#### 3. **Memory Store** (`MemoryStore` class)
- Tracks request counts per user/endpoint combination
- Automatically cleans up expired entries
- Implements the `RateLimitStore` interface for Redis compatibility

#### 4. **Rate Limiter Factory** (`createRateLimiter`)
Creates configured rate limiters for each tier with:
- Custom key generation (per-user/tenant)
- Standard rate limit headers
- Retry-After header injection
- Health check exemptions

## Usage

### Current Implementation

The rate limiters are applied in `server.ts`:

```typescript
// Authentication endpoints: 5 req/min
app.use('/api/auth', authRateLimiter, authRoutes);

// Execution endpoints: 20 req/min
app.use('/api/executions', executionRateLimiter, executionRoutes);

// Standard CRUD endpoints: 100 req/min
app.use('/api/workflows', standardRateLimiter, workflowRoutes);
app.use('/api/analytics', standardRateLimiter, analyticsRoutes);

// Webhook endpoints: 1000 req/min
app.use('/webhook', webhookRateLimiter, webhookRoutes);
```

### Adjusting Rate Limits

To modify rate limits, edit the `RATE_LIMIT_CONFIGS` object in `ratelimit.middleware.ts`:

```typescript
const RATE_LIMIT_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
    [RateLimitTier.AUTH]: {
        windowMs: 1 * 60 * 1000,  // Window duration
        max: 5,                    // Max requests per window
    },
    // ... other tiers
};
```

**Recommendation**: Move these to environment variables for production:

```typescript
[RateLimitTier.AUTH]: {
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'),
},
```

## Migration to Redis (Horizontal Scaling)

When you're ready to scale horizontally, follow these steps:

### 1. Install Redis Dependencies

```bash
npm install rate-limit-redis redis
npm install -D @types/redis
```

### 2. Update `ratelimit.middleware.ts`

Replace the `MemoryStore` implementation with Redis:

```typescript
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

// Create Redis client
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.connect().catch(console.error);

// Update createRateLimiter to use Redis
export const createRateLimiter = (tier: RateLimitTier): RateLimitRequestHandler => {
    const config = RATE_LIMIT_CONFIGS[tier];
    
    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        
        // Use Redis store instead of memory
        store: new RedisStore({
            client: redisClient,
            prefix: `ratelimit:${tier}:`,
        }),
        
        keyGenerator: (req: Request) => {
            const userIdentifier = getUserIdentifier(req);
            return userIdentifier;
        },
        
        // ... rest of configuration (unchanged)
    });
};
```

### 3. Update Environment Variables

Add to `.env`:

```env
REDIS_URL=redis://your-redis-host:6379
```

### 4. Update Cleanup

```typescript
export const cleanupRateLimiters = async (): Promise<void> => {
    await redisClient.quit();
};
```

## Testing

### Manual Testing

1. **Test per-user limiting** (authenticated):
   ```bash
   # Get a valid JWT token
   TOKEN="your-jwt-token"
   
   # Make 6 requests to auth endpoint (limit is 5)
   for i in {1..6}; do
     curl -H "Authorization: Bearer $TOKEN" \
          http://localhost:4000/api/auth/profile
   done
   # 6th request should return 429
   ```

2. **Test IP-based limiting** (unauthenticated):
   ```bash
   # Make 6 requests without token
   for i in {1..6}; do
     curl http://localhost:4000/api/auth/login \
          -d '{"email":"test@test.com","password":"wrong"}'
   done
   # 6th request should return 429
   ```

3. **Verify Retry-After header**:
   ```bash
   # After hitting rate limit
   curl -i http://localhost:4000/api/auth/login
   # Should see: Retry-After: 60
   ```

### Automated Testing

Create a test file `ratelimit.test.ts`:

```typescript
import request from 'supertest';
import { app } from '../server';

describe('Rate Limiting', () => {
    it('should limit auth endpoints to 5 req/min', async () => {
        // Make 5 successful requests
        for (let i = 0; i < 5; i++) {
            await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'test' })
                .expect((res) => expect(res.status).not.toBe(429));
        }
        
        // 6th request should be rate limited
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@test.com', password: 'test' })
            .expect(429);
        
        expect(response.headers['retry-after']).toBeDefined();
        expect(response.body.tier).toBe('auth');
    });
});
```

## Monitoring

### Recommended Metrics

Track these metrics in production:

1. **Rate limit hits by tier**
   - How often users hit each tier's limit
   - Helps identify if limits are too strict

2. **Rate limit hits by user/tenant**
   - Identify potentially abusive users
   - Detect legitimate users needing higher limits

3. **Average requests per user/tenant**
   - Understand normal usage patterns
   - Set appropriate limits

### Logging

Add logging to track rate limit events:

```typescript
handler: (req: Request, res: Response) => {
    const userIdentifier = getUserIdentifier(req);
    
    // Log rate limit event
    console.warn('Rate limit exceeded', {
        tier,
        userIdentifier,
        path: req.path,
        timestamp: new Date().toISOString(),
    });
    
    const retryAfter = Math.ceil(config.windowMs / 1000);
    res.status(429)
        .set('Retry-After', retryAfter.toString())
        .json({
            error: 'Too many requests',
            message: `Rate limit exceeded for ${tier} endpoints. Please try again in ${retryAfter} seconds.`,
            retryAfter,
            tier,
        });
},
```

## Best Practices

### 1. **Whitelist Critical Services**

For internal services or monitoring tools, bypass rate limiting:

```typescript
skip: (req: Request) => {
    // Skip health checks
    if (req.path === '/health') return true;
    
    // Skip internal service requests
    const apiKey = req.headers['x-api-key'];
    if (apiKey === process.env.INTERNAL_API_KEY) return true;
    
    return false;
},
```

### 2. **Implement Rate Limit Tiers for Users**

Consider adding premium tiers with higher limits:

```typescript
const getUserRateLimitMultiplier = async (userId: string): Promise<number> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionTier: true },
    });
    
    switch (user?.subscriptionTier) {
        case 'PREMIUM': return 2;
        case 'ENTERPRISE': return 5;
        default: return 1;
    }
};
```

### 3. **Graceful Degradation**

If Redis is unavailable, fall back to memory store:

```typescript
let store;
try {
    store = new RedisStore({ client: redisClient, prefix: `ratelimit:${tier}:` });
} catch (error) {
    console.error('Redis unavailable, using memory store');
    store = undefined; // express-rate-limit will use default memory store
}
```

## Troubleshooting

### Issue: Users hitting limits too quickly

**Solution**: Increase limits for the affected tier or implement user-specific multipliers.

### Issue: Rate limits not working

**Check**:
1. JWT_SECRET is set correctly
2. Rate limiters are applied before route handlers
3. No middleware is bypassing rate limiters

### Issue: Memory usage growing

**Solution**: 
1. Verify cleanup interval is running
2. Check for memory leaks in MemoryStore
3. Consider migrating to Redis

## Future Enhancements

1. **Dynamic Rate Limits**: Adjust limits based on system load
2. **Rate Limit Analytics Dashboard**: Visualize rate limit metrics
3. **Custom Rate Limits per User**: Allow admins to set user-specific limits
4. **Burst Allowance**: Allow short bursts above the limit
5. **Distributed Tracing**: Track rate limit decisions across services

## Summary

The new rate limiting system provides:

✅ **Granular control** - Different limits for different endpoint types  
✅ **Fairness** - Per-user/tenant limiting prevents noisy neighbors  
✅ **Client-friendly** - Retry-After headers help clients back off gracefully  
✅ **Scalability** - Redis-ready architecture for horizontal scaling  
✅ **Flexibility** - Easy to adjust limits without code changes  
✅ **Security** - Protects against brute force and resource exhaustion  

This system is production-ready for single-instance deployments and can be easily upgraded to support distributed environments.
