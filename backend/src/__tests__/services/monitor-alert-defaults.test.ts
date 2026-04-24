process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import type { Monitor, TenantAlertChannel } from '@prisma/client';

import { MonitorAlertService } from '../../services/monitor-alert.service';
import { MonitorService } from '../../services/monitor.service';

type MonitorRow = Pick<
  Monitor,
  | 'id'
  | 'tenantId'
  | 'workflowId'
  | 'name'
  | 'status'
  | 'alertWebhookUrl'
  | 'alertEmail'
  | 'checkType'
  | 'checkConfig'
  | 'isEnabled'
>;

const monitorRow = (overrides: Partial<MonitorRow> = {}): MonitorRow =>
  ({
    id: 'mon-1',
    tenantId: 'tenant-1',
    workflowId: 'wf-1',
    name: 'deploys-per-hour',
    status: 'OK', // about to flip
    alertWebhookUrl: null,
    alertEmail: null,
    checkType: 'last_success_within',
    checkConfig: { windowMinutes: 60 },
    isEnabled: true,
    ...overrides,
  }) as MonitorRow;

function buildPrismaStub(
  monitors: MonitorRow[],
  channels: Array<Partial<TenantAlertChannel> & Pick<TenantAlertChannel, 'tenantId'>>
) {
  const prisma = {
    monitor: {
      findMany: jest.fn(async () => monitors),
      update: jest.fn(async () => undefined),
      findFirst: jest.fn(async () => null), // evaluate() short-circuits
      groupBy: jest.fn(async () => []),
    },
    monitorEvent: {
      create: jest.fn(async () => undefined),
    },
    tenantAlertChannel: {
      findMany: jest.fn(async () => channels),
    },
    execution: {
      findFirst: jest.fn(async () => null),
      groupBy: jest.fn(async () => []),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return prisma as any;
}

describe('MonitorService.evaluateAll + TenantAlertChannel defaults', () => {
  it('uses per-monitor override when set (tenant default ignored)', async () => {
    const prisma = buildPrismaStub(
      [
        monitorRow({
          alertWebhookUrl: 'https://per-monitor.test',
          alertEmail: 'per-monitor@acme.test',
        }),
      ],
      [
        {
          tenantId: 'tenant-1',
          webhookUrl: 'https://tenant-default.test',
          email: 'tenant-default@acme.test',
          isActive: true,
        },
      ]
    );
    const fire = jest.fn().mockResolvedValue({ delivered: true, channels: {} });
    const alertService = { fire } as unknown as MonitorAlertService;
    const svc = new MonitorService(prisma, alertService);

    // Force the evaluate() path to report FIRING by stubbing a failure.
    jest
      .spyOn(svc, 'evaluate')
      .mockResolvedValue({ status: 'FIRING', reason: 'no_success_in_last_60m' });

    await svc.evaluateAll();

    // Wait a microtask so the fire-and-forget alert call lands.
    await new Promise(resolve => setImmediate(resolve));
    expect(fire).toHaveBeenCalledTimes(1);
    const args = fire.mock.calls[0][0];
    expect(args.monitor.alertWebhookUrl).toBe('https://per-monitor.test');
    expect(args.monitor.alertEmail).toBe('per-monitor@acme.test');
  });

  it('falls back to tenant default when per-monitor config is null', async () => {
    const prisma = buildPrismaStub(
      [monitorRow({ alertWebhookUrl: null, alertEmail: null })],
      [
        {
          tenantId: 'tenant-1',
          webhookUrl: 'https://tenant-default.test',
          email: 'tenant-default@acme.test',
          isActive: true,
          createdAt: new Date('2026-01-01'),
        },
      ]
    );
    const fire = jest.fn().mockResolvedValue({ delivered: true, channels: {} });
    const svc = new MonitorService(prisma, { fire } as unknown as MonitorAlertService);
    jest.spyOn(svc, 'evaluate').mockResolvedValue({ status: 'FIRING', reason: 'r' });

    await svc.evaluateAll();
    await new Promise(resolve => setImmediate(resolve));

    expect(fire).toHaveBeenCalledTimes(1);
    const args = fire.mock.calls[0][0];
    expect(args.monitor.alertWebhookUrl).toBe('https://tenant-default.test');
    expect(args.monitor.alertEmail).toBe('tenant-default@acme.test');
  });

  it('no defaults at all → null channels (MonitorAlertService no-ops cleanly)', async () => {
    const prisma = buildPrismaStub([monitorRow()], []);
    const fire = jest.fn().mockResolvedValue({ delivered: false, channels: {} });
    const svc = new MonitorService(prisma, { fire } as unknown as MonitorAlertService);
    jest.spyOn(svc, 'evaluate').mockResolvedValue({ status: 'FIRING', reason: 'r' });

    await svc.evaluateAll();
    await new Promise(resolve => setImmediate(resolve));

    expect(fire).toHaveBeenCalledTimes(1);
    const args = fire.mock.calls[0][0];
    expect(args.monitor.alertWebhookUrl).toBeNull();
    expect(args.monitor.alertEmail).toBeNull();
  });

  it('prefetches channels once regardless of how many monitors share a tenant', async () => {
    const prisma = buildPrismaStub(
      [monitorRow({ id: 'mon-a' }), monitorRow({ id: 'mon-b' }), monitorRow({ id: 'mon-c' })],
      [
        {
          tenantId: 'tenant-1',
          webhookUrl: 'https://one.test',
          email: null,
          isActive: true,
        },
      ]
    );
    const fire = jest.fn().mockResolvedValue({ delivered: true, channels: {} });
    const svc = new MonitorService(prisma, { fire } as unknown as MonitorAlertService);
    jest.spyOn(svc, 'evaluate').mockResolvedValue({ status: 'OK', reason: 'ok' }); // no flip

    await svc.evaluateAll();

    // Only one tenantAlertChannel.findMany call — O(tenants), not O(monitors).
    expect(prisma.tenantAlertChannel.findMany).toHaveBeenCalledTimes(1);
  });

  it('partial override: per-monitor email only → tenant default webhook + per-monitor email', async () => {
    const prisma = buildPrismaStub(
      [monitorRow({ alertWebhookUrl: null, alertEmail: 'override@acme.test' })],
      [
        {
          tenantId: 'tenant-1',
          webhookUrl: 'https://default.test',
          email: 'default@acme.test',
          isActive: true,
        },
      ]
    );
    const fire = jest.fn().mockResolvedValue({ delivered: true, channels: {} });
    const svc = new MonitorService(prisma, { fire } as unknown as MonitorAlertService);
    jest.spyOn(svc, 'evaluate').mockResolvedValue({ status: 'FIRING', reason: 'r' });

    await svc.evaluateAll();
    await new Promise(resolve => setImmediate(resolve));

    const args = fire.mock.calls[0][0];
    expect(args.monitor.alertWebhookUrl).toBe('https://default.test'); // tenant default
    expect(args.monitor.alertEmail).toBe('override@acme.test'); // per-monitor wins
  });
});
