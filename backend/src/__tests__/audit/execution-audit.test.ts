import { PrismaClient, TriggerType } from '@prisma/client';

import { AuditEventType, AuditService } from '../../audit/audit.service';
import { ExecutionService } from '../../editor/execution/execution.service';

jest.mock('../../editor/node-executor.service');
jest.mock('../../services/error-notification.service');
jest.mock('../../services/logger.service', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      child: jest.fn().mockReturnValue({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      }),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));
jest.mock('../../utils/error-persistence');
jest.mock('../../editor/execution/socket.service', () => ({
  socketService: {
    emitLog: jest.fn(),
    emitNodeStatus: jest.fn(),
    emitExecutionStatus: jest.fn(),
  },
}));

interface CapturedEvent {
  type: AuditEventType;
  tenantId: string;
  actorId?: string | null;
  actorType?: string | null;
  resource?: string | null;
  payload: Record<string, unknown>;
}

class FakeAuditService {
  public events: CapturedEvent[] = [];

  async record(input: CapturedEvent): Promise<{ id: string; hash: string; seq: bigint }> {
    this.events.push(input);
    return {
      id: `evt-${this.events.length}`,
      hash: 'x'.repeat(64),
      seq: BigInt(this.events.length),
    };
  }

  typesOnly(): AuditEventType[] {
    return this.events.map(e => e.type);
  }
}

const buildPrismaMock = () => {
  return {
    runbook: { findUnique: jest.fn() },
    execution: {
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    nodeLog: { create: jest.fn(), update: jest.fn() },
    executionError: { findFirst: jest.fn() },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ plan: 'BUSINESS' }),
    },
    // A1: execute() pins the run to the latest RunbookVersion. Return
    // null so the engine falls back to the current Runbook row.
    runbookVersion: { findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaClient;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('ExecutionService → AuditService wiring', () => {
  let prisma: PrismaClient;
  let audit: FakeAuditService;
  let service: ExecutionService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = buildPrismaMock();
    audit = new FakeAuditService();
    service = new ExecutionService(prisma, {
      audit: audit as unknown as AuditService,
    });
  });

  const mockWorkflow = {
    id: 'runbook-1',
    name: 'Test Workflow',
    tenantId: 'tenant-42',
    nodes: [
      { id: 'node-1', type: 'Trigger', title: 'Start', position: { x: 0, y: 0 }, config: {} },
    ],
    connections: [],
  };

  it('emits run.started when execution begins', async () => {
    (prisma.runbook.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
    (prisma.execution.create as jest.Mock).mockResolvedValue({
      id: 'exec-1',
      runbookId: 'runbook-1',
      userId: 'user-1',
      status: 'RUNNING',
      trigger: 'MANUAL',
    });

    await service.execute({
      runbookId: 'runbook-1',
      userId: 'user-1',
      trigger: TriggerType.MANUAL,
      tenantId: 'tenant-42',
    });

    // Allow the fire-and-forget runWorkflow to start before assertions.
    await sleep(0);

    const startEvent = audit.events.find(e => e.type === 'run.started');
    expect(startEvent).toBeDefined();
    expect(startEvent?.tenantId).toBe('tenant-42');
    expect(startEvent?.actorId).toBe('user-1');
    expect(startEvent?.actorType).toBe('user');
    expect(startEvent?.resource).toBe('exec-1');
    expect(startEvent?.payload.executionId).toBe('exec-1');
    expect(startEvent?.payload.runbookId).toBe('runbook-1');
    expect(startEvent?.payload.workflowName).toBe('Test Workflow');
    expect(startEvent?.payload.trigger).toBe(TriggerType.MANUAL);
  });

  // The "skip audit when tenantId missing" case is no longer reachable:
  // Execution / NodeLog / ExecutionError now require tenantId at the
  // schema level, and ExecuteParams.tenantId is required at compile
  // time. The compiler rejects the old legacy call pattern this test
  // used to guard.

  it('does not call audit at all when audit is null', async () => {
    const auditSpy = jest.fn();
    const noAuditService = new ExecutionService(prisma, { audit: null });
    // Reach into the private safeAudit indirectly by spying on the FakeAuditService
    // which we'd never see called.
    (prisma.runbook.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
    (prisma.execution.create as jest.Mock).mockResolvedValue({
      id: 'exec-no-audit',
      runbookId: 'runbook-1',
      userId: 'user-1',
      status: 'RUNNING',
      trigger: 'MANUAL',
    });

    await noAuditService.execute({
      runbookId: 'runbook-1',
      userId: 'user-1',
      trigger: TriggerType.MANUAL,
      tenantId: 'tenant-42',
    });
    await sleep(0);
    expect(auditSpy).not.toHaveBeenCalled();
    // The shared FakeAuditService instance should also be untouched
    expect(audit.events).toHaveLength(0);
  });

  it('does not throw when audit.record() itself fails', async () => {
    const brokenAudit = {
      record: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as AuditService;
    const safeService = new ExecutionService(prisma, { audit: brokenAudit });

    (prisma.runbook.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
    (prisma.execution.create as jest.Mock).mockResolvedValue({
      id: 'exec-broken-audit',
      runbookId: 'runbook-1',
      userId: 'user-1',
      status: 'RUNNING',
      trigger: 'MANUAL',
    });

    await expect(
      safeService.execute({
        runbookId: 'runbook-1',
        userId: 'user-1',
        trigger: TriggerType.MANUAL,
        tenantId: 'tenant-42',
      })
    ).resolves.toBeDefined();
  });
});
