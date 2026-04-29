import express from 'express';
import request from 'supertest';

type Webhook = {
  id: string;
  tenantId: string;
  runbookId: string;
  source: string;
  url: string;
  secret: string | null;
  isActive: boolean;
  triggerCount: number;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  runbook?: { id: string; userId: string; name: string };
};

type Receipt = {
  id: string;
  webhookId: string;
  tenantId: string;
  status: string;
  statusCode: number;
  reason: string | null;
  headers: Record<string, unknown>;
  body: Record<string, unknown>;
  sourceIp: string | null;
  executionId: string | null;
  retryAttempts: number;
  nextRetryAt: Date | null;
  receivedAt: Date;
};

const webhooks: Webhook[] = [];
const receipts: Receipt[] = [];

jest.mock('../../server', () => ({
  prisma: {
    webhook: {
      findFirst: jest.fn(async (args: { where: { id: string; tenantId?: string } }) => {
        return (
          webhooks.find(
            w =>
              w.id === args.where.id &&
              (args.where.tenantId === undefined || w.tenantId === args.where.tenantId)
          ) ?? null
        );
      }),
    },
    webhookReceipt: {
      findMany: jest.fn(
        async (args: {
          where: {
            webhookId: string;
            status?: { in: string[] };
            receivedAt?: { lt: Date };
          };
          orderBy?: { receivedAt: 'desc' };
          take?: number;
        }) => {
          let rows = receipts.filter(r => r.webhookId === args.where.webhookId);
          if (args.where.status?.in) {
            const allowed = new Set(args.where.status.in);
            rows = rows.filter(r => allowed.has(r.status));
          }
          if (args.where.receivedAt?.lt) {
            const ceiling = args.where.receivedAt.lt.getTime();
            rows = rows.filter(r => r.receivedAt.getTime() < ceiling);
          }
          rows.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
          if (args.take) rows = rows.slice(0, args.take);
          return rows;
        }
      ),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    runbook: { findFirst: jest.fn() },
  },
}));

// The routes file constructs WebhookService + ExecutionService lazily.
// Replay uses mapPayloadToVariables + execute; the list endpoint
// ignores these. Keep references to the mocks so individual tests
// can override their behavior.
const mapPayloadToVariablesMock = jest.fn((_source: string, _event: unknown, body: unknown) => ({
  payload: body,
}));
const executeMock = jest.fn();

jest.mock('../../runbook/services/webhook.service', () => ({
  WebhookService: jest
    .fn()
    .mockImplementation(() => ({ mapPayloadToVariables: mapPayloadToVariablesMock })),
}));
jest.mock('../../editor/execution/execution.service', () => ({
  ExecutionService: jest.fn().mockImplementation(() => ({ execute: executeMock })),
}));

import webhooksAdminRoutes from '../../routes/webhooks-admin.routes';

function makeApp(viewer: { id: string; role: 'ADMIN' | 'USER'; tenantId: string; email: string }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = viewer;
    (req as any).log = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
    next();
  });
  app.use('/api/webhooks', webhooksAdminRoutes);
  return app;
}

function seedWebhook(overrides: Partial<Webhook> = {}): Webhook {
  const w: Webhook = {
    id: 'hook-1',
    tenantId: 't1',
    runbookId: 'wf-1',
    source: 'custom',
    url: 'https://example.test/wh',
    secret: null,
    isActive: true,
    triggerCount: 0,
    lastTriggeredAt: null,
    createdAt: new Date(),
    runbook: { id: 'wf-1', userId: 'u1', name: 'Runbook' },
    ...overrides,
  };
  webhooks.push(w);
  return w;
}

function seedReceipt(overrides: Partial<Receipt> = {}): Receipt {
  const r: Receipt = {
    id: `rcpt-${receipts.length + 1}`,
    webhookId: 'hook-1',
    tenantId: 't1',
    status: 'accepted',
    statusCode: 202,
    reason: null,
    headers: {},
    body: {},
    sourceIp: null,
    executionId: null,
    retryAttempts: 0,
    nextRetryAt: null,
    receivedAt: new Date(),
    ...overrides,
  };
  receipts.push(r);
  return r;
}

const USER = {
  id: 'u1',
  role: 'USER' as const,
  tenantId: 't1',
  email: 'u@x.com',
};

describe('GET /api/webhooks/:id/receipts', () => {
  beforeEach(() => {
    webhooks.length = 0;
    receipts.length = 0;
  });

  it('returns the latest page ordered descending by default', async () => {
    seedWebhook();
    const older = seedReceipt({ id: 'r-old', receivedAt: new Date('2026-04-01T00:00:00Z') });
    const newer = seedReceipt({ id: 'r-new', receivedAt: new Date('2026-04-02T00:00:00Z') });

    const res = await request(makeApp(USER)).get('/api/webhooks/hook-1/receipts');
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: any) => r.id)).toEqual([newer.id, older.id]);
    expect(res.body.nextCursor).toBeNull();
  });

  it('filters by a single status', async () => {
    seedWebhook();
    seedReceipt({ id: 'ok', status: 'accepted', receivedAt: new Date('2026-04-02') });
    seedReceipt({
      id: 'bad',
      status: 'rejected_signature',
      receivedAt: new Date('2026-04-01'),
    });

    const res = await request(makeApp(USER))
      .get('/api/webhooks/hook-1/receipts')
      .query({ status: 'rejected_signature' });
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: any) => r.id)).toEqual(['bad']);
  });

  it('filters by a comma-separated status list', async () => {
    seedWebhook();
    seedReceipt({ id: 'ok', status: 'accepted', receivedAt: new Date('2026-04-03') });
    seedReceipt({
      id: 'sig',
      status: 'rejected_signature',
      receivedAt: new Date('2026-04-02'),
    });
    seedReceipt({ id: 'err', status: 'error', receivedAt: new Date('2026-04-01') });

    const res = await request(makeApp(USER))
      .get('/api/webhooks/hook-1/receipts')
      .query({ status: 'rejected_signature,error' });
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: any) => r.id).sort()).toEqual(['err', 'sig']);
  });

  it('respects the limit param and emits nextCursor when the page is full', async () => {
    seedWebhook();
    for (let i = 1; i <= 5; i++) {
      seedReceipt({
        id: `r${i}`,
        receivedAt: new Date(`2026-04-0${i}T00:00:00Z`),
      });
    }

    const res = await request(makeApp(USER))
      .get('/api/webhooks/hook-1/receipts')
      .query({ limit: '3' });
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: any) => r.id)).toEqual(['r5', 'r4', 'r3']);
    expect(res.body.nextCursor).toBe(new Date('2026-04-03T00:00:00Z').toISOString());
  });

  it('paginates via cursor: second call returns the older window', async () => {
    seedWebhook();
    for (let i = 1; i <= 5; i++) {
      seedReceipt({
        id: `r${i}`,
        receivedAt: new Date(`2026-04-0${i}T00:00:00Z`),
      });
    }

    const first = await request(makeApp(USER))
      .get('/api/webhooks/hook-1/receipts')
      .query({ limit: '3' });
    const nextCursor = first.body.nextCursor as string;

    const second = await request(makeApp(USER))
      .get('/api/webhooks/hook-1/receipts')
      .query({ limit: '3', cursor: nextCursor });
    expect(second.status).toBe(200);
    expect(second.body.data.map((r: any) => r.id)).toEqual(['r2', 'r1']);
    expect(second.body.nextCursor).toBeNull();
  });

  it('returns 400 when the cursor is not ISO-8601', async () => {
    seedWebhook();
    const res = await request(makeApp(USER))
      .get('/api/webhooks/hook-1/receipts')
      .query({ cursor: 'yesterday' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when limit is above the ceiling', async () => {
    seedWebhook();
    const res = await request(makeApp(USER))
      .get('/api/webhooks/hook-1/receipts')
      .query({ limit: '1000' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the webhook belongs to another tenant', async () => {
    seedWebhook({ id: 'foreign', tenantId: 't-other' });
    const res = await request(makeApp(USER)).get('/api/webhooks/foreign/receipts');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/webhooks/:id/receipts/:receiptId/replay', () => {
  const mockedPrisma = require('../../server').prisma as {
    webhookReceipt: { findFirst: jest.Mock; create: jest.Mock };
  };

  beforeEach(() => {
    webhooks.length = 0;
    receipts.length = 0;
    mapPayloadToVariablesMock.mockClear();
    executeMock.mockReset();
    mockedPrisma.webhookReceipt.findFirst.mockReset();
    mockedPrisma.webhookReceipt.create.mockReset();
  });

  function wireReceiptFindFirst() {
    mockedPrisma.webhookReceipt.findFirst.mockImplementation(
      async (args: { where: { id: string; webhookId: string } }) => {
        return (
          receipts.find(r => r.id === args.where.id && r.webhookId === args.where.webhookId) ?? null
        );
      }
    );
  }

  it('replays the captured payload and records a fresh receipt with replay_of marker', async () => {
    seedWebhook();
    const captured = seedReceipt({
      id: 'rcpt-live',
      body: { foo: 'bar' },
      headers: { 'x-one': '1' },
    });
    wireReceiptFindFirst();
    executeMock.mockResolvedValue({ id: 'exec-1' });
    mockedPrisma.webhookReceipt.create.mockResolvedValue({ id: 'rcpt-replay' });

    const res = await request(makeApp(USER)).post(
      `/api/webhooks/hook-1/receipts/${captured.id}/replay`
    );

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      runId: 'exec-1',
      runbook: { id: 'wf-1', name: 'Runbook' },
      replayedFrom: captured.id,
    });

    // Engine received the mapped variables (our mapper mock wraps the
    // raw body under `payload`).
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        runbookId: 'wf-1',
        trigger: 'WEBHOOK',
        tenantId: 't1',
        input: { payload: { foo: 'bar' } },
      })
    );

    // A replay-receipt row was inserted with the replay_of:<id> marker.
    expect(mockedPrisma.webhookReceipt.create).toHaveBeenCalledTimes(1);
    const writeArg = mockedPrisma.webhookReceipt.create.mock.calls[0][0].data;
    expect(writeArg).toMatchObject({
      webhookId: 'hook-1',
      tenantId: 't1',
      status: 'accepted',
      statusCode: 202,
      reason: `replay_of:${captured.id}`,
      executionId: 'exec-1',
    });
    expect(writeArg.body).toEqual({ foo: 'bar' });
    expect(writeArg.headers).toEqual({ 'x-one': '1' });
  });

  it('returns 404 when the webhook belongs to another tenant', async () => {
    seedWebhook({ id: 'foreign', tenantId: 't-other' });
    wireReceiptFindFirst();

    const res = await request(makeApp(USER)).post('/api/webhooks/foreign/receipts/anything/replay');
    expect(res.status).toBe(404);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the receipt does not belong to the webhook', async () => {
    seedWebhook();
    seedReceipt({ id: 'rcpt-1', webhookId: 'other-hook' });
    wireReceiptFindFirst();

    const res = await request(makeApp(USER)).post('/api/webhooks/hook-1/receipts/rcpt-1/replay');
    expect(res.status).toBe(404);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('returns 500 without writing a receipt when execute() throws', async () => {
    seedWebhook();
    const captured = seedReceipt({ id: 'rcpt-live' });
    wireReceiptFindFirst();
    executeMock.mockRejectedValue(new Error('engine exploded'));

    const res = await request(makeApp(USER)).post(
      `/api/webhooks/hook-1/receipts/${captured.id}/replay`
    );
    expect(res.status).toBe(500);
    expect(mockedPrisma.webhookReceipt.create).not.toHaveBeenCalled();
  });
});
