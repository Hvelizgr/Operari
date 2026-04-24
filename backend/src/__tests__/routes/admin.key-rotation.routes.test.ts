import express from 'express';
import request from 'supertest';

jest.mock('../../server', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
    customRole: { findMany: jest.fn() },
    runbook: { count: jest.fn() },
    execution: { count: jest.fn() },
    apiKey: { count: jest.fn() },
    webhook: { count: jest.fn() },
    scheduledJob: { count: jest.fn() },
    eventAgent: { count: jest.fn() },
    monitor: { count: jest.fn() },
    auditEvent: { count: jest.fn() },
    keyRotationJob: { findFirst: jest.fn() },
  },
}));

// Mock the KeyRotationService module so we can stub its behavior
// without reaching into Prisma or constructing a real cipher.
const mockStart = jest.fn();
const mockStatus = jest.fn();
const mockCancel = jest.fn();
jest.mock('../../security/key-rotation.service', () => ({
  KeyRotationService: jest.fn().mockImplementation(() => ({
    startRotation: mockStart,
    getActiveJob: mockStatus,
    cancel: mockCancel,
  })),
  KeyRotationError: class KeyRotationError extends Error {
    constructor(
      message: string,
      public readonly code: string
    ) {
      super(message);
      this.name = 'KeyRotationError';
    }
  },
}));

jest.mock('../../security/secret-cipher', () => ({
  secretCipherFromEnv: jest.fn(() => ({ hasLegacyKeys: () => true })),
}));

jest.mock('../../audit/audit.service', () => ({
  AuditService: jest.fn().mockImplementation(() => ({})),
}));

import adminRoutes from '../../routes/admin.routes';
import { KeyRotationError } from '../../security/key-rotation.service';

function makeApp(viewer: { id: string; role: 'ADMIN' | 'USER'; tenantId: string; email: string }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = viewer;
    (req as any).log = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
    next();
  });
  app.use('/api/admin', adminRoutes);
  return app;
}

const ADMIN = { id: 'admin-1', role: 'ADMIN' as const, tenantId: 't1', email: 'a@x.com' };
const USER = { id: 'user-1', role: 'USER' as const, tenantId: 't1', email: 'u@x.com' };

describe('admin key rotation routes', () => {
  beforeEach(() => {
    mockStart.mockReset();
    mockStatus.mockReset();
    mockCancel.mockReset();
  });

  describe('POST /api/admin/key-rotation/start', () => {
    it('rejects non-ADMIN callers with 403', async () => {
      const res = await request(makeApp(USER))
        .post('/api/admin/key-rotation/start')
        .send({ deadline: new Date().toISOString() });
      expect(res.status).toBe(403);
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('validates body (deadline must be ISO-8601)', async () => {
      const res = await request(makeApp(ADMIN))
        .post('/api/admin/key-rotation/start')
        .send({ deadline: 'not-a-date' });
      expect(res.status).toBe(400);
      expect(mockStart).not.toHaveBeenCalled();
    });

    it('creates a rotation job for ADMIN callers', async () => {
      mockStart.mockResolvedValue({ id: 'job-1', status: 'PENDING' });
      const deadline = new Date(Date.now() + 86_400_000).toISOString();
      const res = await request(makeApp(ADMIN))
        .post('/api/admin/key-rotation/start')
        .send({ deadline, dryRun: false });
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('job-1');
      expect(mockStart).toHaveBeenCalledWith({
        deadline: new Date(deadline),
        actorId: 'admin-1',
        dryRun: false,
      });
    });

    it('maps ACTIVE_JOB_EXISTS to 409', async () => {
      mockStart.mockRejectedValue(new KeyRotationError('already running', 'ACTIVE_JOB_EXISTS'));
      const res = await request(makeApp(ADMIN))
        .post('/api/admin/key-rotation/start')
        .send({ deadline: new Date().toISOString() });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ACTIVE_JOB_EXISTS');
    });

    it('maps NO_LEGACY_KEYS to 400', async () => {
      mockStart.mockRejectedValue(new KeyRotationError('no legacy', 'NO_LEGACY_KEYS'));
      const res = await request(makeApp(ADMIN))
        .post('/api/admin/key-rotation/start')
        .send({ deadline: new Date().toISOString() });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('NO_LEGACY_KEYS');
    });
  });

  describe('GET /api/admin/key-rotation/status', () => {
    it('rejects non-ADMIN callers with 403', async () => {
      const res = await request(makeApp(USER)).get('/api/admin/key-rotation/status');
      expect(res.status).toBe(403);
    });

    it('returns the active job when one exists', async () => {
      const job = { id: 'job-1', status: 'RUNNING' };
      mockStatus.mockResolvedValue(job);
      const res = await request(makeApp(ADMIN)).get('/api/admin/key-rotation/status');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(job);
      expect(res.body.active).toBe(true);
    });
  });

  describe('POST /api/admin/key-rotation/:jobId/cancel', () => {
    it('rejects non-ADMIN callers with 403', async () => {
      const res = await request(makeApp(USER)).post('/api/admin/key-rotation/job-1/cancel');
      expect(res.status).toBe(403);
      expect(mockCancel).not.toHaveBeenCalled();
    });

    it('returns the cancelled job for ADMIN callers', async () => {
      mockCancel.mockResolvedValue({ id: 'job-1', status: 'CANCELLED' });
      const res = await request(makeApp(ADMIN)).post('/api/admin/key-rotation/job-1/cancel');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(mockCancel).toHaveBeenCalledWith('job-1');
    });

    it('maps JOB_NOT_FOUND to 404', async () => {
      mockCancel.mockRejectedValue(new KeyRotationError('nope', 'JOB_NOT_FOUND'));
      const res = await request(makeApp(ADMIN)).post('/api/admin/key-rotation/missing/cancel');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('JOB_NOT_FOUND');
    });

    it('maps JOB_TERMINAL to 409', async () => {
      mockCancel.mockRejectedValue(new KeyRotationError('already done', 'JOB_TERMINAL'));
      const res = await request(makeApp(ADMIN)).post('/api/admin/key-rotation/job-1/cancel');
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('JOB_TERMINAL');
    });
  });
});
