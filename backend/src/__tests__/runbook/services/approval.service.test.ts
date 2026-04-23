import type { PrismaClient, ApprovalStatus } from '@prisma/client';
import { ApprovalService, ApprovalServiceError } from '../../../runbook/services/approval.service';
import { AuditService } from '../../../audit/audit.service';

class FakeAudit {
  public events: Array<{ type: string; payload: Record<string, unknown> }> = [];
  async record(input: { type: string; payload: Record<string, unknown> }) {
    this.events.push(input);
    return { id: 'evt-1', hash: 'x'.repeat(64), seq: BigInt(this.events.length) };
  }
}

interface ApprovalRow {
  id: string;
  workflowId: string;
  executionId: string;
  stepId: string;
  status: ApprovalStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  comment: string | null;
}

interface ExecutionRow {
  id: string;
  status: string;
  completedAt: Date | null;
  error: string | null;
}

const buildPrisma = (
  overrides: {
    approvals?: ApprovalRow[];
    workflowTenantMap?: Record<string, string>;
    executions?: ExecutionRow[];
  } = {}
) => {
  const approvals: ApprovalRow[] = overrides.approvals ?? [];
  const workflowTenantMap = overrides.workflowTenantMap ?? {};
  const executions: ExecutionRow[] = overrides.executions ?? [];

  const prisma = {
    approval: {
      findUnique: jest.fn(async (args: { where: { id: string } }) => {
        const row = approvals.find(a => a.id === args.where.id);
        if (!row) return null;
        return {
          ...row,
          workflow: { tenantId: workflowTenantMap[row.workflowId] ?? '' },
        };
      }),
      findUniqueOrThrow: jest.fn(async (args: { where: { id: string } }) => {
        const row = approvals.find(a => a.id === args.where.id);
        if (!row) throw new Error('not found');
        return row;
      }),
      updateMany: jest.fn(
        async (args: {
          where: { id: string; status: ApprovalStatus };
          data: Partial<ApprovalRow>;
        }) => {
          const row = approvals.find(a => a.id === args.where.id && a.status === args.where.status);
          if (!row) return { count: 0 };
          Object.assign(row, args.data);
          return { count: 1 };
        }
      ),
    },
    execution: {
      updateMany: jest.fn(
        async (args: { where: { id: string; status: string }; data: Partial<ExecutionRow> }) => {
          const row = executions.find(
            e => e.id === args.where.id && e.status === args.where.status
          );
          if (!row) return { count: 0 };
          Object.assign(row, args.data);
          return { count: 1 };
        }
      ),
    },
    $transaction: jest.fn(async (fn: (tx: PrismaClient) => Promise<unknown>) =>
      fn(prisma as unknown as PrismaClient)
    ),
  } as unknown as PrismaClient;

  return { prisma, approvals, executions };
};

describe('ApprovalService.resolve', () => {
  const SAMPLE_APPROVAL: ApprovalRow = {
    id: 'approval-1',
    workflowId: 'wf-1',
    executionId: 'exec-1',
    stepId: 'step-1',
    status: 'PENDING',
    approvedBy: null,
    approvedAt: null,
    comment: null,
  };

  const SAMPLE_EXECUTION: ExecutionRow = {
    id: 'exec-1',
    status: 'PAUSED',
    completedAt: null,
    error: null,
  };

  it('grants a pending approval and resumes the execution', async () => {
    const { prisma, approvals } = buildPrisma({
      approvals: [{ ...SAMPLE_APPROVAL }],
      workflowTenantMap: { 'wf-1': 'tenant-1' },
      executions: [{ ...SAMPLE_EXECUTION }],
    });
    const audit = new FakeAudit();
    const resumeExecution = jest.fn().mockResolvedValue(undefined);
    const service = new ApprovalService(prisma, {
      audit: audit as unknown as AuditService,
      resumeExecution,
    });

    const result = await service.resolve({
      approvalId: 'approval-1',
      tenantId: 'tenant-1',
      action: 'grant',
      actorId: 'apikey:k-9',
      comment: 'looks good',
    });

    expect(result.status).toBe('APPROVED');
    expect(result.executionResumed).toBe(true);
    expect(approvals[0].approvedBy).toBe('apikey:k-9');
    expect(approvals[0].comment).toBe('looks good');
    expect(resumeExecution).toHaveBeenCalledWith({
      executionId: 'exec-1',
      userId: 'apikey:k-9',
      tenantId: 'tenant-1',
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0].type).toBe('approval.granted');
    expect(audit.events[0].payload).toMatchObject({
      approvalId: 'approval-1',
      executionId: 'exec-1',
      workflowId: 'wf-1',
      comment: 'looks good',
      executionResumed: true,
    });
  });

  it('rejects a pending approval and cancels the execution', async () => {
    const { prisma, approvals, executions } = buildPrisma({
      approvals: [{ ...SAMPLE_APPROVAL }],
      workflowTenantMap: { 'wf-1': 'tenant-1' },
      executions: [{ ...SAMPLE_EXECUTION }],
    });
    const audit = new FakeAudit();
    const resumeExecution = jest.fn();
    const service = new ApprovalService(prisma, {
      audit: audit as unknown as AuditService,
      resumeExecution,
    });

    const result = await service.resolve({
      approvalId: 'approval-1',
      tenantId: 'tenant-1',
      action: 'reject',
      actorId: 'apikey:k-9',
      comment: 'too risky',
    });

    expect(result.status).toBe('REJECTED');
    expect(result.executionCancelled).toBe(true);
    expect(executions[0].status).toBe('CANCELLED');
    expect(executions[0].error).toBe('Approval rejected: too risky');
    expect(approvals[0].comment).toBe('too risky');
    expect(resumeExecution).not.toHaveBeenCalled();
    expect(audit.events[0].type).toBe('approval.rejected');
    expect(audit.events[0].payload.executionCancelled).toBe(true);
  });

  it('throws approval_not_found for a missing approval', async () => {
    const { prisma } = buildPrisma();
    const service = new ApprovalService(prisma, { audit: null });
    await expect(
      service.resolve({
        approvalId: 'ghost',
        tenantId: 'tenant-1',
        action: 'grant',
        actorId: 'apikey:k-9',
      })
    ).rejects.toMatchObject({
      name: 'ApprovalServiceError',
      code: 'approval_not_found',
    });
  });

  it('hides cross-tenant approvals as not-found (no info leak)', async () => {
    const { prisma } = buildPrisma({
      approvals: [{ ...SAMPLE_APPROVAL }],
      workflowTenantMap: { 'wf-1': 'tenant-other' },
      executions: [{ ...SAMPLE_EXECUTION }],
    });
    const service = new ApprovalService(prisma, { audit: null });
    await expect(
      service.resolve({
        approvalId: 'approval-1',
        tenantId: 'tenant-1',
        action: 'grant',
        actorId: 'apikey:k-9',
      })
    ).rejects.toMatchObject({ code: 'approval_not_found' });
  });

  it('throws approval_not_pending when already resolved', async () => {
    const alreadyResolved: ApprovalRow = {
      ...SAMPLE_APPROVAL,
      status: 'APPROVED',
      approvedBy: 'someone',
      approvedAt: new Date(),
    };
    const { prisma } = buildPrisma({
      approvals: [alreadyResolved],
      workflowTenantMap: { 'wf-1': 'tenant-1' },
      executions: [{ ...SAMPLE_EXECUTION, status: 'RUNNING' }],
    });
    const service = new ApprovalService(prisma, { audit: null });
    await expect(
      service.resolve({
        approvalId: 'approval-1',
        tenantId: 'tenant-1',
        action: 'grant',
        actorId: 'apikey:k-9',
      })
    ).rejects.toMatchObject({ code: 'approval_not_pending' });
  });

  it('still records audit when resumeExecution rejects', async () => {
    const { prisma } = buildPrisma({
      approvals: [{ ...SAMPLE_APPROVAL }],
      workflowTenantMap: { 'wf-1': 'tenant-1' },
      executions: [{ ...SAMPLE_EXECUTION }],
    });
    const audit = new FakeAudit();
    const resumeExecution = jest.fn().mockRejectedValue(new Error('runtime kaput'));
    const service = new ApprovalService(prisma, {
      audit: audit as unknown as AuditService,
      resumeExecution,
    });

    const result = await service.resolve({
      approvalId: 'approval-1',
      tenantId: 'tenant-1',
      action: 'grant',
      actorId: 'apikey:k-9',
    });

    expect(result.executionResumed).toBe(false);
    expect(audit.events[0].payload.executionResumed).toBe(false);
  });

  it('survives audit failures', async () => {
    const { prisma } = buildPrisma({
      approvals: [{ ...SAMPLE_APPROVAL }],
      workflowTenantMap: { 'wf-1': 'tenant-1' },
      executions: [{ ...SAMPLE_EXECUTION }],
    });
    const brokenAudit = {
      record: jest.fn().mockRejectedValue(new Error('chain offline')),
    } as unknown as AuditService;
    const resumeExecution = jest.fn().mockResolvedValue(undefined);
    const service = new ApprovalService(prisma, {
      audit: brokenAudit,
      resumeExecution,
    });

    const result = await service.resolve({
      approvalId: 'approval-1',
      tenantId: 'tenant-1',
      action: 'grant',
      actorId: 'apikey:k-9',
    });

    expect(result.status).toBe('APPROVED');
  });

  it('does not resume when no resumeExecution function is provided', async () => {
    const { prisma } = buildPrisma({
      approvals: [{ ...SAMPLE_APPROVAL }],
      workflowTenantMap: { 'wf-1': 'tenant-1' },
      executions: [{ ...SAMPLE_EXECUTION }],
    });
    const service = new ApprovalService(prisma, { audit: null });
    const result = await service.resolve({
      approvalId: 'approval-1',
      tenantId: 'tenant-1',
      action: 'grant',
      actorId: 'apikey:k-9',
    });
    expect(result.status).toBe('APPROVED');
    expect(result.executionResumed).toBe(false);
  });
});
