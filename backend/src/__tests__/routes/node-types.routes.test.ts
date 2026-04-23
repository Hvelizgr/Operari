// env.config validates JWT_SECRET (min 32 chars) at import time and calls
// process.exit on failure. node-types.routes imports env transitively via
// logger; install compliant values before the import chain resolves.
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import express from 'express';
import request from 'supertest';

// Intercept PrismaClient's constructor because the route instantiates
// its own client. A per-test capture of the findMany args lets us
// assert the tenant-scope filter without standing up a real DB.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastFindManyArgs: any = null;
let findManyRows: Array<{ type: string; tenantId: string | null }> = [];
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      nodeType: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: jest.fn(async (args: any) => {
          lastFindManyArgs = args;
          return findManyRows;
        }),
      },
    })),
  };
});

// Stub the soft-auth middleware BEFORE importing the route so we can
// control whether req.user is attached per-test.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authInjectsUser: { id: string; email: string; role: string; tenantId: string } | null = null;
jest.mock('../../middleware/auth.middleware', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachUserIfPresent: (req: any, _res: any, next: any) => {
    if (authInjectsUser) req.user = authInjectsUser;
    next();
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const router = require('../../routes/node-types.routes').default as express.Router;

function buildApp(): express.Application {
  const app = express();
  app.use('/api/node-types', router);
  return app;
}

describe('GET /api/node-types', () => {
  beforeEach(() => {
    lastFindManyArgs = null;
    findManyRows = [];
    authInjectsUser = null;
  });

  it('anonymous → returns globals only (tenantId IS NULL)', async () => {
    findManyRows = [{ type: 'shell', tenantId: null }];
    const res = await request(buildApp()).get('/api/node-types');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(findManyRows);
    expect(lastFindManyArgs.where).toEqual({ tenantId: null });
  });

  it('authenticated → returns globals + tenant-owned rows', async () => {
    authInjectsUser = {
      id: 'u-1',
      email: 'u@acme.test',
      role: 'USER',
      tenantId: 'tenant-42',
    };
    findManyRows = [
      { type: 'shell', tenantId: null },
      { type: 'acme.custom-deploy', tenantId: 'tenant-42' },
    ];
    const res = await request(buildApp()).get('/api/node-types');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(lastFindManyArgs.where).toEqual({
      OR: [{ tenantId: null }, { tenantId: 'tenant-42' }],
    });
  });

  it('always sorts by type for deterministic palette rendering', async () => {
    const res = await request(buildApp()).get('/api/node-types');
    expect(res.status).toBe(200);
    expect(lastFindManyArgs.orderBy).toEqual({ type: 'asc' });
  });
});
