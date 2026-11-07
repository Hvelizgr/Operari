import { Prisma } from '@prisma/client';

import { MAX_RUNS_PER_DELIVERY, triggerAlertRuns } from '../../alerts/alert-trigger';

function fakePrisma() {
  const claimed = new Set<string>();
  const runs = new Map<string, { id: string; metadata: Record<string, unknown> | null }>();
  const prisma = {
    webhookEvent: {
      create: jest.fn(async ({ data }: { data: { source: string; eventId: string } }) => {
        const k = `${data.source}|${data.eventId}`;
        if (claimed.has(k)) {
          throw new Prisma.PrismaClientKnownRequestError('dup', {
            code: 'P2002',
            clientVersion: 'x',
          });
        }
        claimed.add(k);
        return data;
      }),
      deleteMany: jest.fn(async ({ where }: { where: { source: string; eventId: string } }) => {
        claimed.delete(`${where.source}|${where.eventId}`);
        return { count: 1 };
      }),
    },
    execution: {
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { metadata: Record<string, unknown> };
        }) => {
          runs.set(where.id, { id: where.id, metadata: data.metadata });
          return runs.get(where.id);
        }
      ),
      findMany: jest.fn(async ({ where }: { where: { metadata: { equals: string } } }) =>
        [...runs.values()].filter(
          r =>
            (r.metadata?.alert as { fingerprint?: string } | undefined)?.fingerprint ===
            where.metadata.equals
        )
      ),
    },
  };
  return { prisma, claimed, runs };
}

const webhook = {
  id: 'wh1',
  tenantId: 't1',
  runbookId: 'rb1',
  source: 'alertmanager' as const,
  userId: 'u1',
};

const alert = (fp: string, status = 'firing', startsAt = '2026-11-05T10:00:00Z') => ({
  status,
  labels: { alertname: 'DiskFull', instance: fp },
  annotations: {},
  fingerprint: fp,
  startsAt,
  endsAt: status === 'resolved' ? '2026-11-05T11:00:00Z' : '0001-01-01T00:00:00Z',
});

function starter() {
  let n = 0;
  const inputs: Array<Record<string, unknown>> = [];
  const start = jest.fn(async (input: Record<string, unknown>) => {
    inputs.push(input);
    return { id: `run-${++n}` };
  });
  return { start, inputs };
}

describe('triggerAlertRuns', () => {
  it('starts one run per new occurrence and none for repeats', async () => {
    const { prisma } = fakePrisma();
    const { start, inputs } = starter();
    const body = { alerts: [alert('a'), alert('b')] };
    const first = await triggerAlertRuns(prisma as never, webhook, body, start);
    expect(first.started.map(s => s.runId)).toEqual(['run-1', 'run-2']);
    expect(inputs[0]).toMatchObject({
      source: 'alertmanager',
      event: 'firing',
      alert: { fingerprint: 'a', name: 'DiskFull', labels: { instance: 'a' } },
    });
    // Alertmanager resends the group on every interval.
    const again = await triggerAlertRuns(prisma as never, webhook, body, start);
    expect(again).toMatchObject({ started: [], duplicates: 2 });
    // The same alert firing again later is a new occurrence.
    const later = await triggerAlertRuns(
      prisma as never,
      webhook,
      { alerts: [alert('a', 'firing', '2026-11-06T08:00:00Z')] },
      start
    );
    expect(later.started).toHaveLength(1);
    expect(start).toHaveBeenCalledTimes(3);
  });

  it('stamps a resolution on the run the alert started, once', async () => {
    const { prisma, runs } = fakePrisma();
    const { start } = starter();
    await triggerAlertRuns(prisma as never, webhook, { alerts: [alert('a')] }, start);
    const resolved = await triggerAlertRuns(
      prisma as never,
      webhook,
      { alerts: [alert('a', 'resolved')] },
      start
    );
    expect(resolved).toMatchObject({ started: [], resolved: 1 });
    expect(runs.get('run-1')!.metadata).toMatchObject({
      alert: { fingerprint: 'a', resolvedAt: '2026-11-05T11:00:00Z' },
    });
    const twice = await triggerAlertRuns(
      prisma as never,
      webhook,
      { alerts: [alert('a', 'resolved')] },
      start
    );
    expect(twice.resolved).toBe(0);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('gives the occurrence back when the run cannot start, so a retry starts it', async () => {
    const { prisma, claimed } = fakePrisma();
    const failing = jest.fn(async () => {
      throw new Error('engine down');
    });
    await expect(
      triggerAlertRuns(prisma as never, webhook, { alerts: [alert('a')] }, failing)
    ).rejects.toThrow('engine down');
    expect(claimed.size).toBe(0);
    const { start } = starter();
    const retry = await triggerAlertRuns(prisma as never, webhook, { alerts: [alert('a')] }, start);
    expect(retry.started).toHaveLength(1);
  });

  it(`caps a storm at ${MAX_RUNS_PER_DELIVERY} runs per delivery`, async () => {
    const { prisma } = fakePrisma();
    const { start } = starter();
    const body = { alerts: Array.from({ length: 25 }, (_, i) => alert(`h${i}`)) };
    const res = await triggerAlertRuns(prisma as never, webhook, body, start);
    expect(res.started).toHaveLength(MAX_RUNS_PER_DELIVERY);
    expect(res.skipped).toBe(25 - MAX_RUNS_PER_DELIVERY);
  });
});

describe('source-specific variables', () => {
  it('keeps what runbooks already read and lets the normalized alert win', async () => {
    const { prisma } = fakePrisma();
    const startRun = jest.fn().mockResolvedValue({ id: 'run-1' });

    await triggerAlertRuns(
      prisma as never,
      { id: 'w1', tenantId: 't1', runbookId: 'r1', source: 'sentry', userId: 'u1' },
      { action: 'created', data: { issue: { id: '42', title: 'Boom', level: 'error' } } },
      startRun,
      undefined,
      () => ({ issue_title: 'Boom', event: 'issue', alert: { environment: 'prod' } })
    );

    expect(startRun.mock.calls[0][0]).toMatchObject({
      issue_title: 'Boom',
      event: 'issue',
      alert: { environment: 'prod', fingerprint: 'issue:42', status: 'firing' },
    });
  });
});
