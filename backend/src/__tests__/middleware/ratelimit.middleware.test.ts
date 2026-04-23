import express from 'express';
import request from 'supertest';

import { createRateLimiter, RateLimitTier } from '../../middleware/ratelimit.middleware';

describe('Rate Limit Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    // Since createRateLimiter creates a new instance of rate-limit middleware
    // which has its own internal store, we don't need to manually reset global store.
  });

  it('should limit requests for AUTH tier', async () => {
    // Auth tier limits to 5 requests per minute
    const limiter = createRateLimiter(RateLimitTier.AUTH);
    app.get('/test-auth', limiter, (req, res) => res.json({ success: true }));

    // Make 5 successful requests
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/test-auth');
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-remaining']).toBe(String(4 - i));
    }

    // 6th request should fail
    const res = await request(app).get('/test-auth');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too many requests');
    expect(res.body.tier).toBe(RateLimitTier.AUTH);
  });

  it('should allow more requests for EXECUTION tier', async () => {
    // Execution tier limits to 20 requests per minute
    const limiter = createRateLimiter(RateLimitTier.EXECUTION);
    app.get('/test-exec', limiter, (req, res) => res.json({ success: true }));

    // Make 6 requests (more than AUTH limit)
    for (let i = 0; i < 6; i++) {
      const res = await request(app).get('/test-exec');
      expect(res.status).toBe(200);
    }
  });

  it('should provide Retry-After header when limit exceeded', async () => {
    const limiter = createRateLimiter(RateLimitTier.AUTH);
    app.get('/retry-check', limiter, (req, res) => res.json({ success: true }));

    // Exhaust limit
    for (let i = 0; i < 5; i++) {
      await request(app).get('/retry-check');
    }

    // Check exceeded response
    const res = await request(app).get('/retry-check');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    // window is 60000ms, so retry after should be around 60 seconds
    expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(60);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('should skip rate limiting for health check', async () => {
    const limiter = createRateLimiter(RateLimitTier.AUTH);
    // The middleware has a skip condition for path === '/health'
    app.get('/health', limiter, (req, res) => res.json({ status: 'ok' }));

    // Try many requests
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    }
  });
});
