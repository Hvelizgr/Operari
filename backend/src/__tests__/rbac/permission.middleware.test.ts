import express from 'express';
import request from 'supertest';

jest.mock('../../server', () => ({ prisma: {} }));

import {
  requirePermission,
  requireAnyPermission,
  __setPermissionServiceForTest,
} from '../../rbac/permission.middleware';
import { PermissionService } from '../../rbac/permission.service';

class FakePermissionService {
  public hasPermission = jest.fn();
  public getPermissions = jest.fn();
}

const buildApp = (
  mw: ReturnType<typeof requirePermission> | ReturnType<typeof requireAnyPermission>
) => {
  const app = express();
  app.use(express.json());
  // Inject a fake user — usually populated by `authenticate` middleware
  app.use((req, _res, next) => {
    (req as { user?: { id: string } }).user = (
      global as { __testUser?: { id: string } }
    ).__testUser;
    next();
  });
  app.get('/protected', mw, (_req, res) => res.json({ ok: true }));
  return app;
};

beforeEach(() => {
  (global as { __testUser?: { id: string } }).__testUser = { id: 'u-1' };
});

afterEach(() => {
  __setPermissionServiceForTest(null);
});

describe('requirePermission', () => {
  it('returns 401 when no user is on the request', async () => {
    (global as { __testUser?: { id: string } }).__testUser = undefined;
    const fake = new FakePermissionService();
    __setPermissionServiceForTest(fake as unknown as PermissionService);
    const app = buildApp(requirePermission('runbook:read'));
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('unauthorized');
  });

  it('returns 200 when the user has the permission', async () => {
    const fake = new FakePermissionService();
    fake.hasPermission.mockResolvedValue(true);
    __setPermissionServiceForTest(fake as unknown as PermissionService);
    const app = buildApp(requirePermission('runbook:read'));
    const res = await request(app).get('/protected');
    expect(res.status).toBe(200);
    expect(fake.hasPermission).toHaveBeenCalledWith('u-1', 'runbook:read');
  });

  it('returns 403 when the permission is missing', async () => {
    const fake = new FakePermissionService();
    fake.hasPermission.mockResolvedValue(false);
    __setPermissionServiceForTest(fake as unknown as PermissionService);
    const app = buildApp(requirePermission('runbook:delete'));
    const res = await request(app).get('/protected');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('permission_denied');
    expect(res.body.required).toBe('runbook:delete');
  });

  it('returns 500 if the permission lookup throws', async () => {
    const fake = new FakePermissionService();
    fake.hasPermission.mockRejectedValue(new Error('db down'));
    __setPermissionServiceForTest(fake as unknown as PermissionService);
    const app = buildApp(requirePermission('runbook:read'));
    const res = await request(app).get('/protected');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('permission_check_failed');
  });
});

describe('requireAnyPermission', () => {
  it('throws at construction time when no perms are passed', () => {
    expect(() => requireAnyPermission()).toThrow();
  });

  it('passes when the user has at least one of the listed perms', async () => {
    const fake = new FakePermissionService();
    fake.hasPermission.mockImplementation(async (_user, perm) => perm === 'runbook:read');
    fake.getPermissions.mockResolvedValue(new Set(['runbook:read']));
    __setPermissionServiceForTest(fake as unknown as PermissionService);
    const app = buildApp(requireAnyPermission('runbook:read', 'audit:read'));
    const res = await request(app).get('/protected');
    expect(res.status).toBe(200);
  });

  it('returns 403 when none of the listed perms are held', async () => {
    const fake = new FakePermissionService();
    fake.hasPermission.mockResolvedValue(false);
    fake.getPermissions.mockResolvedValue(new Set());
    __setPermissionServiceForTest(fake as unknown as PermissionService);
    const app = buildApp(requireAnyPermission('runbook:read', 'audit:read'));
    const res = await request(app).get('/protected');
    expect(res.status).toBe(403);
    expect(res.body.required).toEqual(['runbook:read', 'audit:read']);
  });
});
