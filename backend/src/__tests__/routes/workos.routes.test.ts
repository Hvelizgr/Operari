// env.config validates JWT_SECRET (min 32 chars) at import time and
// calls process.exit on failure. workos.routes imports env transitively
// via logger; install compliant values before the import chain
// resolves.
process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';
process.env.WORKOS_CLIENT_ID = 'wos_client_id';
process.env.WORKOS_CLIENT_SECRET = 'wos_client_secret';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.OAUTH_REDIRECT_BASE_URL = 'http://localhost:4000';

import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';

jest.mock('../../server', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { upsert: jest.fn() },
  },
}));

jest.mock('../../audit/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    record: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { prisma } from '../../server';
import workosRoutes, {
  resetTokenExchangerForTesting,
  setTokenExchangerForTesting,
} from '../../routes/workos.routes';

const findTenant = prisma.tenant.findUnique as unknown as jest.Mock;
const upsertUser = prisma.user.upsert as unknown as jest.Mock;

function buildApp(): express.Application {
  const app = express();
  app.use(cookieParser());
  app.use((req, _res, next) => {
    (req as any).log = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
    next();
  });
  app.use('/api/auth/workos', workosRoutes);
  return app;
}

beforeEach(() => {
  upsertUser.mockReset();
  findTenant.mockReset();
});

afterEach(() => {
  resetTokenExchangerForTesting();
});

describe('GET /api/auth/workos (start)', () => {
  it('redirects to the WorkOS authorize URL with state cookie + redirect_uri', async () => {
    const res = await request(buildApp()).get('/api/auth/workos');

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^https:\/\/api\.workos\.com\/sso\/authorize\?/);
    expect(res.headers.location).toContain('client_id=wos_client_id');
    expect(res.headers.location).toContain('response_type=code');
    expect(res.headers.location).toMatch(/redirect_uri=[^&]*workos%2Fcallback/);
    const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
    expect(setCookie.some(c => c.startsWith('operari_workos_oauth_state='))).toBe(true);
  });

  it('returns 501 when WorkOS env vars are missing', async () => {
    const savedId = process.env.WORKOS_CLIENT_ID;
    delete process.env.WORKOS_CLIENT_ID;
    const res = await request(buildApp()).get('/api/auth/workos');
    process.env.WORKOS_CLIENT_ID = savedId;
    expect(res.status).toBe(501);
  });

  it('passes the optional ?organization hint through to WorkOS', async () => {
    const res = await request(buildApp()).get('/api/auth/workos?organization=org_42');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('organization=org_42');
  });
});

describe('GET /api/auth/workos/callback', () => {
  it('rejects a request without a matching state cookie (CSRF)', async () => {
    const res = await request(buildApp()).get('/api/auth/workos/callback?code=c&state=mismatched');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/en/login?error=oauth_state_mismatch');
  });

  it('redirects to login with oauth_no_email if WorkOS profile lacks email', async () => {
    setTokenExchangerForTesting(async () => ({
      access_token: 'fake.fake.fake',
      profile: { id: 'u', email: undefined, organization_id: 'org_42' },
    }));

    const res = await request(buildApp())
      .get('/api/auth/workos/callback?code=c&state=stateA')
      .set('Cookie', 'operari_workos_oauth_state=stateA');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/en/login?error=oauth_no_email');
  });

  it('redirects to login with oauth_no_tenant if the WorkOS org is not linked', async () => {
    setTokenExchangerForTesting(async () => ({
      access_token: 'fake.fake.fake',
      profile: { email: 'alice@acme.test', organization_id: 'org_unknown' },
    }));
    findTenant.mockResolvedValue(null);

    const res = await request(buildApp())
      .get('/api/auth/workos/callback?code=c&state=stateA')
      .set('Cookie', 'operari_workos_oauth_state=stateA');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/en/login?error=oauth_no_tenant');
    expect(findTenant).toHaveBeenCalledWith({
      where: { workosOrganizationId: 'org_unknown' },
      select: { id: true },
    });
  });

  it('mints a session cookie and redirects to /en/dashboard on the happy path', async () => {
    setTokenExchangerForTesting(async () => ({
      access_token: 'fake.fake.fake',
      profile: { email: 'alice@acme.test', organization_id: 'org_42', role: 'ADMIN' },
    }));
    findTenant.mockResolvedValue({ id: 'tenant-42' });
    upsertUser.mockResolvedValue({
      id: 'user-1',
      email: 'alice@acme.test',
      role: 'ADMIN',
      tenantId: 'tenant-42',
    });

    const res = await request(buildApp())
      .get('/api/auth/workos/callback?code=c&state=stateA')
      .set('Cookie', 'operari_workos_oauth_state=stateA');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/en/dashboard');
    const setCookie = (res.headers['set-cookie'] ?? []) as unknown as string[];
    expect(setCookie.some(c => c.startsWith('operari_session='))).toBe(true);
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'alice@acme.test' },
        create: expect.objectContaining({
          tenantId: 'tenant-42',
          role: 'ADMIN',
          emailVerified: true,
        }),
      })
    );
  });

  it('falls back to USER when WorkOS returns a non-admin role', async () => {
    setTokenExchangerForTesting(async () => ({
      access_token: 'fake.fake.fake',
      profile: { email: 'bob@acme.test', organization_id: 'org_42', role: 'member' },
    }));
    findTenant.mockResolvedValue({ id: 'tenant-42' });
    upsertUser.mockResolvedValue({
      id: 'user-2',
      email: 'bob@acme.test',
      role: 'USER',
      tenantId: 'tenant-42',
    });

    const res = await request(buildApp())
      .get('/api/auth/workos/callback?code=c&state=stateA')
      .set('Cookie', 'operari_workos_oauth_state=stateA');

    expect(res.status).toBe(302);
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ role: 'USER' }) })
    );
  });

  it('redirects to login with oauth_failed when token exchange throws', async () => {
    setTokenExchangerForTesting(async () => {
      throw new Error('WorkOS down');
    });

    const res = await request(buildApp())
      .get('/api/auth/workos/callback?code=c&state=stateA')
      .set('Cookie', 'operari_workos_oauth_state=stateA');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/en/login?error=oauth_failed');
  });
});
