import type { PrismaClient } from '@prisma/client';

// node-cron's schedule() normally registers a recurring timer. The
// tests need to invoke the callback on demand, so replace the module
// with a tiny shim that captures every callback by jobId-ish key and
// returns a stub ScheduledTask with .start/.stop.
let lastScheduledCallback: (() => Promise<void>) | null = null;
jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    validate: jest.fn().mockReturnValue(true),
    schedule: jest.fn((_expr: string, cb: () => Promise<void>) => {
      lastScheduledCallback = cb;
      return { start: jest.fn(), stop: jest.fn() };
    }),
  },
  validate: jest.fn().mockReturnValue(true),
  schedule: jest.fn((_expr: string, cb: () => Promise<void>) => {
    lastScheduledCallback = cb;
    return { start: jest.fn(), stop: jest.fn() };
  }),
}));

// ExecutionService is instantiated by SchedulerService; replace its
// constructor so we can assert what the schedule callback dispatches.
const executeMock = jest.fn();
jest.mock('../../editor/execution/execution.service', () => ({
  ExecutionService: jest.fn().mockImplementation(() => ({ execute: executeMock })),
}));

// cron-parser — used by computeNextRunAt. Return a fixed future date.
jest.mock('cron-parser', () => ({
  CronExpressionParser: {
    parse: jest.fn().mockReturnValue({
      next: () => ({ toDate: () => new Date('2030-01-01T00:00:00Z') }),
    }),
  },
}));

import { SchedulerService } from '../../services/scheduler.service';

type RunbookShape = {
  id: string;
  userId: string;
  tenantId: string;
  inputs: unknown;
};

function buildPrisma(runbook: RunbookShape | null) {
  return {
    runbook: {
      findUnique: jest.fn().mockResolvedValue(runbook),
    },
    scheduledJob: {
      update: jest.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
}

async function fireSchedule() {
  if (!lastScheduledCallback) throw new Error('no callback captured');
  await lastScheduledCallback();
}

describe('SchedulerService.scheduleJob input handling', () => {
  beforeEach(() => {
    executeMock.mockReset();
    lastScheduledCallback = null;
  });

  it('dispatches with empty input when the runbook has no declared inputs', async () => {
    const prisma = buildPrisma({
      id: 'wf-1',
      userId: 'u-1',
      tenantId: 't-1',
      inputs: [],
    });
    const svc = new SchedulerService(prisma);
    await svc.scheduleJob('job-1', 'wf-1', '*/5 * * * *');
    await fireSchedule();

    expect(executeMock).toHaveBeenCalledTimes(1);
    const arg = executeMock.mock.calls[0][0];
    expect(arg.trigger).toBe('SCHEDULED');
    expect(arg.input).toEqual({});
  });

  it('fills in defaults for declared optional inputs', async () => {
    const prisma = buildPrisma({
      id: 'wf-1',
      userId: 'u-1',
      tenantId: 't-1',
      inputs: [
        { name: 'env', type: 'text', default: 'prod' },
        { name: 'retries', type: 'number', default: 3 },
      ],
    });
    const svc = new SchedulerService(prisma);
    await svc.scheduleJob('job-1', 'wf-1', '*/5 * * * *');
    await fireSchedule();

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(executeMock.mock.calls[0][0].input).toEqual({ env: 'prod', retries: 3 });
  });

  it('skips dispatch when a required input has no default, advances nextRunAt', async () => {
    const prisma = buildPrisma({
      id: 'wf-1',
      userId: 'u-1',
      tenantId: 't-1',
      inputs: [{ name: 'env', type: 'text', required: true }],
    });
    const svc = new SchedulerService(prisma);
    await svc.scheduleJob('job-1', 'wf-1', '*/5 * * * *');
    await fireSchedule();

    expect(executeMock).not.toHaveBeenCalled();
    // nextRunAt was advanced so the UI doesn't stall on a stale value.
    expect(prisma.scheduledJob.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ nextRunAt: expect.any(Date) }),
      })
    );
  });

  it('skips dispatch when the runbook is missing', async () => {
    const prisma = buildPrisma(null);
    const svc = new SchedulerService(prisma);
    await svc.scheduleJob('job-1', 'wf-gone', '*/5 * * * *');
    await fireSchedule();

    expect(executeMock).not.toHaveBeenCalled();
  });
});
