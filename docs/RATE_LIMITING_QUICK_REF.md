# Rate Limiting Quick Reference

## Current Rate Limits

| Endpoint | Limit | Window | Example |
|----------|-------|--------|---------|
| `/api/auth/*` | 5 req | 1 min | Login, register |
| `/api/executions/*` | 20 req | 1 min | Run workflows |
| `/api/workflows/*` | 100 req | 1 min | CRUD operations |
| `/api/analytics/*` | 100 req | 1 min | Analytics queries |
| `/webhook/*` | 1000 req | 1 min | Incoming webhooks |

## How It Works

### For Authenticated Users
- Rate limits are **per-user** (extracted from JWT)
- Each user gets their own quota
- Example: User A can make 5 auth requests, User B can also make 5 auth requests

### For Unauthenticated Users
- Rate limits are **per-IP address**
- All requests from the same IP share the quota
- Example: 5 login attempts total from IP 192.168.1.1

## Response Headers

When you make a request, you'll see these headers:

```
RateLimit-Limit: 5          # Maximum requests allowed
RateLimit-Remaining: 3      # Requests remaining in window
RateLimit-Reset: 1642089600 # Unix timestamp when limit resets
```

When rate limited (429 response):

```
Retry-After: 60             # Seconds until you can retry
```

## Error Response Format

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded for auth endpoints. Please try again in 60 seconds.",
  "retryAfter": 60,
  "tier": "auth"
}
```

## Adjusting Limits

Edit `api/src/middleware/ratelimit.middleware.ts`:

```typescript
const RATE_LIMIT_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
    [RateLimitTier.AUTH]: {
        windowMs: 1 * 60 * 1000,  // 1 minute
        max: 5,                    // 5 requests
    },
    // ... other tiers
};
```

## Testing Rate Limits

### Bash Script
```bash
#!/bin/bash
# Test auth endpoint rate limit (5 req/min)

for i in {1..6}; do
  echo "Request $i:"
  curl -i http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}'
  echo -e "\n---\n"
done
```

### With Authentication
```bash
TOKEN="your-jwt-token"

for i in {1..6}; do
  echo "Request $i:"
  curl -i http://localhost:4000/api/workflows \
    -H "Authorization: Bearer $TOKEN"
  echo -e "\n---\n"
done
```

## Horizontal Scaling

Currently using **in-memory storage** (single instance only).

To scale horizontally, migrate to **Redis**:

1. Install dependencies:
   ```bash
   npm install rate-limit-redis redis
   ```

2. Set environment variable:
   ```env
   REDIS_URL=redis://your-redis-host:6379
   ```

3. Update `ratelimit.middleware.ts` (see full docs)

## Common Issues

### "Rate limit not working"
- Check JWT_SECRET is set
- Verify rate limiters are before route handlers
- Check middleware order in server.ts

### "Users complaining about limits"
- Review metrics to see if limits are too strict
- Consider increasing limits for specific tiers
- Implement premium user multipliers

### "Memory growing over time"
- Verify cleanup interval is running
- Check for memory leaks
- Consider migrating to Redis

## See Also

- Full documentation: `docs/RATE_LIMITING.md`
- Middleware implementation: `api/src/middleware/ratelimit.middleware.ts`
- Server configuration: `api/src/server.ts`
