# Redis Migration Checklist

Use this checklist when you're ready to migrate from in-memory rate limiting to Redis for horizontal scaling.

## Prerequisites

- [ ] Multiple server instances deployed (horizontal scaling)
- [ ] Redis server available (managed service or self-hosted)
- [ ] Redis connection URL obtained

## Step 1: Install Dependencies

```bash
cd api
npm install rate-limit-redis redis
npm install -D @types/redis
```

- [ ] Dependencies installed
- [ ] `package.json` updated

## Step 2: Environment Configuration

Add to `.env`:

```env
# Redis Configuration
REDIS_URL=redis://your-redis-host:6379
REDIS_PASSWORD=your-redis-password  # if applicable
REDIS_TLS=true                       # if using TLS
```

- [ ] Environment variables added
- [ ] Redis connection tested

## Step 3: Update Rate Limit Middleware

### 3.1: Add Redis Client

In `api/src/middleware/ratelimit.middleware.ts`, add at the top:

```typescript
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

// Create Redis client
const redisClient = createClient({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    socket: {
        tls: process.env.REDIS_TLS === 'true',
    },
});

// Connect to Redis
redisClient.connect().catch((error) => {
    console.error('Redis connection failed:', error);
    process.exit(1);
});

// Handle Redis errors
redisClient.on('error', (error) => {
    console.error('Redis error:', error);
});
```

- [ ] Redis client created
- [ ] Connection error handling added

### 3.2: Update createRateLimiter Function

Replace the `createRateLimiter` function:

```typescript
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
        
        // Use custom key generator for per-user/tenant limiting
        keyGenerator: (req: Request) => {
            const userIdentifier = getUserIdentifier(req);
            return userIdentifier;
        },

        // Add standard rate limit headers
        standardHeaders: true,
        legacyHeaders: false,

        // Custom handler to add Retry-After header
        handler: (req: Request, res: Response) => {
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

        // Skip rate limiting for health checks
        skip: (req: Request) => {
            return req.path === '/health';
        },
    });
};
```

- [ ] `createRateLimiter` updated to use Redis
- [ ] Store configuration verified

### 3.3: Update Cleanup Function

Replace the `cleanupRateLimiters` function:

```typescript
export const cleanupRateLimiters = async (): Promise<void> => {
    try {
        await redisClient.quit();
        console.log('Redis connection closed');
    } catch (error) {
        console.error('Error closing Redis connection:', error);
    }
};
```

- [ ] Cleanup function updated
- [ ] Async/await added

### 3.4: Remove MemoryStore

Delete the `MemoryStore` class and related code:

```typescript
// DELETE THIS ENTIRE SECTION:
class MemoryStore implements RateLimitStore {
    // ... entire class
}

const memoryStore = new MemoryStore();
```

- [ ] `MemoryStore` class removed
- [ ] `memoryStore` instance removed

## Step 4: Update Server Shutdown

In `api/src/server.ts`, update the shutdown handler:

```typescript
process.on('SIGINT', async () => {
    scheduler.stop();
    await cleanupRateLimiters();  // Now async
    await prisma.$disconnect();
    process.exit(0);
});
```

- [ ] Shutdown handler updated to await cleanup

## Step 5: Testing

### 5.1: Local Testing

Test with a local Redis instance:

```bash
# Start Redis in Docker
docker run -d -p 6379:6379 redis:alpine

# Start your server
npm run dev
```

- [ ] Local Redis running
- [ ] Server connects successfully
- [ ] No connection errors in logs

### 5.2: Rate Limit Testing

Test that rate limiting works across instances:

```bash
# Terminal 1: Start instance 1
PORT=4000 npm run dev

# Terminal 2: Start instance 2
PORT=4001 npm run dev

# Terminal 3: Test rate limiting
# Make 3 requests to instance 1
for i in {1..3}; do
  curl http://localhost:4000/api/auth/login \
    -d '{"email":"test@test.com","password":"test"}'
done

# Make 3 more requests to instance 2
# Should still be rate limited (shared state in Redis)
for i in {1..3}; do
  curl http://localhost:4001/api/auth/login \
    -d '{"email":"test@test.com","password":"test"}'
done
```

- [ ] Rate limits shared across instances
- [ ] 6th request returns 429
- [ ] Retry-After header present

### 5.3: Redis Monitoring

Check Redis keys:

```bash
# Connect to Redis
redis-cli

# List rate limit keys
KEYS ratelimit:*

# Check a specific key
GET ratelimit:auth:ip:127.0.0.1
TTL ratelimit:auth:ip:127.0.0.1
```

- [ ] Keys are being created
- [ ] TTL is set correctly
- [ ] Keys expire as expected

## Step 6: Production Deployment

### 6.1: Staging Environment

- [ ] Deploy to staging with Redis
- [ ] Run integration tests
- [ ] Monitor for 24 hours
- [ ] Check Redis memory usage
- [ ] Verify no connection issues

### 6.2: Production Rollout

- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Monitor Redis metrics:
  - [ ] Connection count
  - [ ] Memory usage
  - [ ] Command latency
  - [ ] Hit rate
- [ ] Set up alerts for Redis issues

## Step 7: Monitoring & Optimization

### 7.1: Redis Metrics

Monitor these metrics:

- [ ] **Connection count**: Should be stable
- [ ] **Memory usage**: Should grow slowly
- [ ] **Command latency**: Should be < 1ms
- [ ] **Hit rate**: Should be > 95%
- [ ] **Eviction count**: Should be 0 (or very low)

### 7.2: Rate Limit Metrics

Track these application metrics:

- [ ] Rate limit hits by tier
- [ ] Rate limit hits by user/tenant
- [ ] Average requests per user
- [ ] 429 response rate

### 7.3: Optimization

If needed, optimize:

- [ ] Increase Redis memory
- [ ] Enable Redis persistence (AOF or RDB)
- [ ] Use Redis Cluster for high availability
- [ ] Implement connection pooling
- [ ] Add Redis Sentinel for failover

## Step 8: Rollback Plan

If issues occur, rollback:

### Quick Rollback (Keep Redis)

1. Revert `ratelimit.middleware.ts` to use MemoryStore
2. Keep Redis running for future use
3. Deploy previous version

- [ ] Rollback procedure documented
- [ ] Team trained on rollback

### Full Rollback (Remove Redis)

1. Revert all code changes
2. Remove Redis dependencies
3. Update environment variables
4. Deploy previous version

- [ ] Full rollback tested in staging

## Troubleshooting

### Issue: Redis connection timeout

**Check**:
- [ ] Redis URL is correct
- [ ] Redis is accessible from server
- [ ] Firewall rules allow connection
- [ ] Redis authentication is correct

### Issue: High Redis memory usage

**Solutions**:
- [ ] Increase Redis memory limit
- [ ] Reduce rate limit window duration
- [ ] Enable Redis eviction policy
- [ ] Monitor for memory leaks

### Issue: Rate limits not working

**Check**:
- [ ] Redis store is configured correctly
- [ ] Key generator is working
- [ ] Redis keys are being created
- [ ] TTL is set on keys

## Completion Checklist

- [ ] All dependencies installed
- [ ] Environment variables configured
- [ ] Code updated and tested
- [ ] Local testing passed
- [ ] Staging deployment successful
- [ ] Production deployment successful
- [ ] Monitoring in place
- [ ] Team trained
- [ ] Documentation updated
- [ ] Rollback plan tested

## Post-Migration

After successful migration:

- [ ] Update `RATE_LIMITING_IMPLEMENTATION.md` to reflect Redis usage
- [ ] Document Redis configuration in README
- [ ] Add Redis to infrastructure documentation
- [ ] Schedule Redis maintenance windows
- [ ] Set up Redis backups (if needed)

## Notes

- **Estimated time**: 2-4 hours (including testing)
- **Risk level**: Low (easy rollback)
- **Downtime required**: None (rolling deployment)
- **Team size**: 1-2 developers

## Support

If you encounter issues:

1. Check Redis logs
2. Check application logs
3. Review `docs/RATE_LIMITING.md`
4. Contact DevOps team
5. Rollback if critical

---

**Last Updated**: 2026-01-13  
**Version**: 1.0  
**Status**: Ready for use
