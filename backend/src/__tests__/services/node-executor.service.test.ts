import { NodeExecutor } from '../../editor/node-executor.service';
import { WorkflowNode, ExecutionInput } from '../../types/workflow.types';
import { ErrorCode } from '../../errors/custom-error';
import { Logger } from '../../services/logger.service';

// Mock dependencies
jest.mock('nodemailer');
// n8n service removed in NanoRun transformation
jest.mock('../../services/logger.service', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      retryAttempt: jest.fn(),
      logError: jest.fn(),
      executionStart: jest.fn(),
      executionEnd: jest.fn(),
      nodeStart: jest.fn(),
      nodeEnd: jest.fn(),
    }),
  },
}));

describe('NodeExecutorService', () => {
  let nodeExecutor: NodeExecutor;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    nodeExecutor = new NodeExecutor();
  });

  describe('execute - HTTP Node', () => {
    const httpNode: WorkflowNode = {
      id: 'node-http',
      type: 'HTTP',
      title: 'HTTP Request',
      position: { x: 0, y: 0 },
      config: {
        url: 'https://api.example.com/data',
        method: 'GET',
      },
    };

    const input: ExecutionInput = {
      data: { test: 'value' },
    };

    it('should execute HTTP GET successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ id: 1, name: 'Test' }),
      });

      const result = await nodeExecutor.execute(httpNode, input);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toHaveProperty('data', { id: 1, name: 'Test' });
      expect(result).toHaveProperty('status', 200);
    });

    it('should handle HTTP GET failure and retry', async () => {
      // Modify node to have retries
      const retryNode = { ...httpNode, config: { ...httpNode.config, retries: 2 } };

      // Fail once then succeed
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map(),
          json: jest.fn().mockResolvedValue({ success: true }),
        });

      const result = await nodeExecutor.execute(retryNode, input);

      // Should have been called twice due to retry
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('data', { success: true });
    });

    it('should throw HttpError on persistent failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(nodeExecutor.execute(httpNode, input)).rejects.toMatchObject({
        code: ErrorCode.HTTP_REQUEST_FAILED,
      });
    });
  });

  describe('execute - Condition Node', () => {
    const conditionNode: WorkflowNode = {
      id: 'node-condition',
      type: 'Condition',
      title: 'Check Value',
      position: { x: 0, y: 0 },
      config: {
        field: 'value',
        operator: 'greaterThan',
        value: '10',
      },
    };

    it('should evaluate numeric greaterThan condition correctly (true)', async () => {
      // Mock sandbox for simple condition not needing JS evaluation
      // The service uses sandbox for 'condition' custom code, but uses direct evaluation for field/operator

      const input: ExecutionInput = { value: 20 };
      const result = await nodeExecutor.execute(conditionNode, input);

      expect((result as any).conditionResult).toBe(true);
    });

    it('should evaluate numeric greaterThan condition correctly (false)', async () => {
      const input: ExecutionInput = { value: 5 };
      const result = await nodeExecutor.execute(conditionNode, input);

      expect((result as any).conditionResult).toBe(false);
    });

    // The "custom code condition" path was removed in the post-pivot
    // cleanup along with the in-process JS sandbox. Conditional gating
    // now lives at the runbook level via runIf/skipIf (R3.3); in-step
    // branching uses the declarative field/operator/value form covered
    // by the test directly above.
  });

  describe('execute - Transform Node', () => {
    const transformNode: WorkflowNode = {
      id: 'node-transform',
      type: 'Transform',
      title: 'Format Data',
      position: { x: 0, y: 0 },
      config: {
        mapping: {},
      },
    };

    // The "custom code transform" path was removed alongside the
    // sandbox. Authors who need arbitrary code transforms should use a
    // shell node that runs in a runner. The mapping path below is the
    // surviving in-step transform behavior.

    it('should handle simple mapping transformation', async () => {
      const mappingNode: WorkflowNode = {
        ...transformNode,
        config: {
          mapping: {
            newName: '{{ name }}',
            static: 'constant',
          },
        },
      };
      // delete code from config for this test case
      delete (mappingNode.config as any).code;

      const input: ExecutionInput = { name: 'Flow' };
      const result = await nodeExecutor.execute(mappingNode, input);

      expect(result).toEqual({
        newName: 'Flow',
        static: 'constant',
      });
    });
  });
});
