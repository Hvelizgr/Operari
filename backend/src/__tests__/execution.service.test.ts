import { PrismaClient, TriggerType } from '@prisma/client';

import { ExecutionService } from '../editor/execution/execution.service';
import { ErrorCode, WorkflowError } from '../errors/custom-error';
import { WorkflowConnection, WorkflowNode } from '../types/workflow.types';

jest.mock('../editor/node-executor.service');
jest.mock('../services/error-notification.service');
jest.mock('../services/logger.service', () => ({
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
jest.mock('../utils/error-persistence');
// socketService sends realtime log lines out of the runner; tests do
// not need the actual socket.io server, and the mock keeps the
// constructor from booting it.
jest.mock('../editor/execution/socket.service', () => ({
  socketService: {
    emitLog: jest.fn(),
    emitExecutionStatus: jest.fn(),
    emitNodeStatus: jest.fn(),
    initialize: jest.fn(),
  },
}));

const mockPrisma = {
  runbook: {
    findUnique: jest.fn(),
  },
  execution: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    // Quota gate counts monthly runs via execution.count.
    // Default to 0 so the gate never trips in unrelated tests.
    count: jest.fn().mockResolvedValue(0),
  },
  nodeLog: {
    create: jest.fn(),
    update: jest.fn(),
  },
  executionError: {
    findFirst: jest.fn(),
  },
  // Quota gate looks up tenant.plan. Default to BUSINESS (unlimited)
  // so existing ExecutionService tests that don't care about billing
  // are not forced to stub it.
  tenant: {
    findUnique: jest.fn().mockResolvedValue({ plan: 'BUSINESS' }),
  },
} as unknown as PrismaClient;

describe('ExecutionService', () => {
  let executionService: ExecutionService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Pass null for every side-effect option: audit, tracer,
    // eventStore, meter. The constructor defaults bring in real
    // implementations that would need Redis / OTel / Stripe; the
    // tests only assert DAG + Prisma call shapes.
    executionService = new ExecutionService(mockPrisma, {
      audit: null,
      tracer: null,
      eventStore: null,
      meter: null,
    });
  });

  describe('execute', () => {
    const mockWorkflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      nodes: [
        {
          id: 'node-1',
          type: 'Trigger',
          title: 'Start',
          position: { x: 0, y: 0 },
          config: {},
        },
        {
          id: 'node-2',
          type: 'HTTP',
          title: 'Fetch Data',
          position: { x: 100, y: 0 },
          config: { url: 'https://api.example.com' },
        },
      ],
      connections: [
        {
          id: 'conn-1',
          source: 'node-1',
          target: 'node-2',
        },
      ],
    };

    it('should successfully execute a workflow', async () => {
      (mockPrisma.runbook.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
      (mockPrisma.execution.create as jest.Mock).mockResolvedValue({
        id: 'exec-1',
        workflowId: 'workflow-1',
        userId: 'user-1',
        status: 'RUNNING',
        trigger: 'MANUAL',
      });

      const result = await executionService.execute({
        workflowId: 'workflow-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        trigger: TriggerType.MANUAL,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('exec-1');
      expect(result.status).toBe('RUNNING');
      expect(mockPrisma.runbook.findUnique).toHaveBeenCalledWith({
        where: { id: 'workflow-1' },
      });
      expect(mockPrisma.execution.create).toHaveBeenCalledWith({
        data: {
          workflowId: 'workflow-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          trigger: TriggerType.MANUAL,
          status: 'RUNNING',
        },
      });
    });

    it('should throw error when workflow not found', async () => {
      (mockPrisma.runbook.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        executionService.execute({
          workflowId: 'non-existent',
          userId: 'user-1',
          tenantId: 'tenant-1',
          trigger: TriggerType.MANUAL,
        })
      ).rejects.toThrow();

      expect(mockPrisma.runbook.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
      });
      expect(mockPrisma.execution.create).not.toHaveBeenCalled();
    });

    it('should handle workflow with no nodes', async () => {
      const emptyWorkflow = {
        ...mockWorkflow,
        nodes: [],
        connections: [],
      };

      (mockPrisma.runbook.findUnique as jest.Mock).mockResolvedValue(emptyWorkflow);
      (mockPrisma.execution.create as jest.Mock).mockResolvedValue({
        id: 'exec-1',
        workflowId: 'workflow-1',
        userId: 'user-1',
        status: 'RUNNING',
        trigger: 'MANUAL',
      });

      const result = await executionService.execute({
        workflowId: 'workflow-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        trigger: TriggerType.MANUAL,
      });

      expect(result).toBeDefined();
    });
  });

  describe('validateWorkflow', () => {
    it('should throw error for workflow with no nodes', () => {
      const service = executionService as any;

      expect(() => {
        service.validateWorkflow([], []);
      }).toThrow(WorkflowError);
    });

    it('should throw error for invalid connections', () => {
      const service = executionService as any;
      const nodes: WorkflowNode[] = [
        {
          id: 'node-1',
          type: 'Trigger',
          title: 'Start',
          position: { x: 0, y: 0 },
        },
      ];
      const connections: WorkflowConnection[] = [
        {
          id: 'conn-1',
          source: 'node-1',
          target: 'non-existent',
        },
      ];

      expect(() => {
        service.validateWorkflow(nodes, connections);
      }).toThrow(WorkflowError);
    });

    it('should throw error for circular dependencies', () => {
      const service = executionService as any;
      const nodes: WorkflowNode[] = [
        {
          id: 'node-1',
          type: 'HTTP',
          title: 'Node 1',
          position: { x: 0, y: 0 },
        },
        {
          id: 'node-2',
          type: 'HTTP',
          title: 'Node 2',
          position: { x: 100, y: 0 },
        },
      ];
      const connections: WorkflowConnection[] = [
        {
          id: 'conn-1',
          source: 'node-1',
          target: 'node-2',
        },
        {
          id: 'conn-2',
          source: 'node-2',
          target: 'node-1',
        },
      ];

      expect(() => {
        service.validateWorkflow(nodes, connections);
      }).toThrow(WorkflowError);
    });

    it('should pass validation for valid workflow', () => {
      const service = executionService as any;
      const nodes: WorkflowNode[] = [
        {
          id: 'node-1',
          type: 'Trigger',
          title: 'Start',
          position: { x: 0, y: 0 },
        },
        {
          id: 'node-2',
          type: 'HTTP',
          title: 'Fetch',
          position: { x: 100, y: 0 },
        },
      ];
      const connections: WorkflowConnection[] = [
        {
          id: 'conn-1',
          source: 'node-1',
          target: 'node-2',
        },
      ];

      expect(() => {
        service.validateWorkflow(nodes, connections);
      }).not.toThrow();
    });
  });

  describe('replayExecution', () => {
    const originalExecution = {
      id: 'exec-1',
      workflowId: 'workflow-1',
      userId: 'user-1',
      trigger: 'MANUAL' as const,
      status: 'SUCCESS' as const,
      workflow: {
        id: 'workflow-1',
        name: 'Test Runbook',
        nodes: [
          { id: 'node-1', type: 'Trigger', title: 'Start', position: { x: 0, y: 0 } },
          { id: 'node-2', type: 'HTTP', title: 'Fetch', position: { x: 100, y: 0 } },
        ],
        connections: [{ id: 'conn-1', source: 'node-1', target: 'node-2' }],
      },
      nodeLogs: [{ nodeId: 'node-2', input: { fromPreviousStep: true } }],
    };

    it('creates a new execution pointing at the same workflow on full replay', async () => {
      (mockPrisma.execution.findUnique as jest.Mock).mockResolvedValue(originalExecution);
      (mockPrisma.execution.create as jest.Mock).mockResolvedValue({
        id: 'exec-2',
        workflowId: 'workflow-1',
        userId: 'user-2',
        status: 'RUNNING',
        trigger: 'MANUAL',
      });

      const result = await executionService.replayExecution({
        executionId: 'exec-1',
        userId: 'user-2',
        tenantId: 'tenant-1',
      });

      expect(result.id).toBe('exec-2');
      expect(mockPrisma.execution.findUnique).toHaveBeenCalledWith({
        where: { id: 'exec-1' },
        include: { workflow: true, nodeLogs: true },
      });
      expect(mockPrisma.execution.create).toHaveBeenCalledWith({
        data: {
          workflowId: 'workflow-1',
          tenantId: 'tenant-1',
          userId: 'user-2',
          trigger: 'MANUAL',
          status: 'RUNNING',
        },
      });
    });

    it('uses the stored input when replaying from a specific node', async () => {
      (mockPrisma.execution.findUnique as jest.Mock).mockResolvedValue(originalExecution);
      (mockPrisma.execution.create as jest.Mock).mockResolvedValue({
        id: 'exec-3',
        workflowId: 'workflow-1',
        userId: 'user-2',
        status: 'RUNNING',
        trigger: 'MANUAL',
      });

      const result = await executionService.replayExecution({
        executionId: 'exec-1',
        nodeId: 'node-2',
        userId: 'user-2',
        tenantId: 'tenant-1',
      });

      expect(result.id).toBe('exec-3');
    });

    it('throws EXECUTION_NOT_FOUND when the original run is gone', async () => {
      (mockPrisma.execution.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        executionService.replayExecution({
          executionId: 'missing',
          userId: 'user-2',
          tenantId: 'tenant-1',
        })
      ).rejects.toMatchObject({
        code: ErrorCode.EXECUTION_NOT_FOUND,
      });

      expect(mockPrisma.execution.create).not.toHaveBeenCalled();
    });
  });

  describe('resumeExecution', () => {
    const pausedExecution = {
      id: 'exec-paused',
      workflowId: 'workflow-1',
      userId: 'user-1',
      trigger: 'MANUAL' as const,
      status: 'PAUSED' as const,
      pausedAt: new Date(),
      resumeState: {
        nodeOutputs: { 'node-1': { ok: true } },
        executedNodes: ['node-1'],
        nodesToExecute: ['node-2'],
      },
      workflow: {
        id: 'workflow-1',
        tenantId: 'tenant-1',
        name: 'Test Runbook',
        nodes: [
          { id: 'node-1', type: 'Trigger', title: 'Start', position: { x: 0, y: 0 } },
          { id: 'node-2', type: 'HTTP', title: 'Fetch', position: { x: 100, y: 0 } },
        ],
        connections: [{ id: 'conn-1', source: 'node-1', target: 'node-2' }],
      },
    };

    it('flips a paused execution back to RUNNING and rehydrates state', async () => {
      (mockPrisma.execution.findFirst as jest.Mock).mockResolvedValue(pausedExecution);
      (mockPrisma.execution.update as jest.Mock).mockResolvedValue({
        ...pausedExecution,
        status: 'RUNNING',
        pausedAt: null,
      });

      const result = await executionService.resumeExecution({
        executionId: 'exec-paused',
        userId: 'approver-1',
        tenantId: 'tenant-1',
        input: { approved: true },
      });

      expect(result.id).toBe('exec-paused');
      expect(mockPrisma.execution.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'exec-paused',
          workflow: { tenantId: 'tenant-1' },
          status: 'PAUSED',
        },
        include: { workflow: true },
      });
      expect(mockPrisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-paused' },
        data: { status: 'RUNNING', pausedAt: null },
      });
    });

    it('throws EXECUTION_NOT_FOUND when there is no paused run for the tenant', async () => {
      (mockPrisma.execution.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        executionService.resumeExecution({
          executionId: 'exec-missing',
          userId: 'approver-1',
          tenantId: 'tenant-1',
        })
      ).rejects.toMatchObject({
        code: ErrorCode.EXECUTION_NOT_FOUND,
      });

      expect(mockPrisma.execution.update).not.toHaveBeenCalled();
    });
  });

  describe('getNodeInput', () => {
    it('should return initial input for nodes with no incoming connections', () => {
      const service = executionService as any;
      const connections: WorkflowConnection[] = [];
      const nodeOutputs = {};
      const initialInput = { data: 'test' };

      const result = service.getNodeInput('node-1', connections, nodeOutputs, initialInput);

      expect(result).toEqual(initialInput);
    });

    it('should merge outputs from connected nodes', () => {
      const service = executionService as any;
      const connections: WorkflowConnection[] = [
        {
          id: 'conn-1',
          source: 'node-1',
          target: 'node-2',
        },
      ];
      const nodeOutputs = {
        'node-1': { result: 'success', data: 'value' },
      };
      const initialInput = {};

      const result = service.getNodeInput('node-2', connections, nodeOutputs, initialInput);

      expect(result).toEqual({ result: 'success', data: 'value' });
    });

    it('should handle multiple incoming connections', () => {
      const service = executionService as any;
      const connections: WorkflowConnection[] = [
        {
          id: 'conn-1',
          source: 'node-1',
          target: 'node-3',
        },
        {
          id: 'conn-2',
          source: 'node-2',
          target: 'node-3',
        },
      ];
      const nodeOutputs = {
        'node-1': { a: 1 },
        'node-2': { b: 2 },
      };
      const initialInput = {};

      const result = service.getNodeInput('node-3', connections, nodeOutputs, initialInput);

      expect(result).toEqual({ a: 1, b: 2 });
    });
  });
});
