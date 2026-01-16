import { PrismaClient, ExecutionStatus, TriggerType } from '@prisma/client';
import { ExecutionService } from '../editor/execution/execution.service';
import { WorkflowNode, WorkflowConnection } from '../types/workflow.types';
import { ErrorCode, WorkflowError } from '../errors/custom-error';

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

const mockPrisma = {
    workflow: {
        findUnique: jest.fn(),
    },
    execution: {
        create: jest.fn(),
        update: jest.fn(),
    },
    nodeLog: {
        create: jest.fn(),
        update: jest.fn(),
    },
    executionError: {
        findFirst: jest.fn(),
    },
} as unknown as PrismaClient;

describe('ExecutionService', () => {
    let executionService: ExecutionService;

    beforeEach(() => {
        jest.clearAllMocks();
        executionService = new ExecutionService(mockPrisma);
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
            (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(mockWorkflow);
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
                trigger: TriggerType.MANUAL,
            });

            expect(result).toBeDefined();
            expect(result.id).toBe('exec-1');
            expect(result.status).toBe('RUNNING');
            expect(mockPrisma.workflow.findUnique).toHaveBeenCalledWith({
                where: { id: 'workflow-1' },
            });
            expect(mockPrisma.execution.create).toHaveBeenCalledWith({
                data: {
                    workflowId: 'workflow-1',
                    userId: 'user-1',
                    trigger: TriggerType.MANUAL,
                    status: 'RUNNING',
                },
            });
        });

        it('should throw error when workflow not found', async () => {
            (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(null);

            await expect(
                executionService.execute({
                    workflowId: 'non-existent',
                    userId: 'user-1',
                    trigger: TriggerType.MANUAL,
                })
            ).rejects.toThrow();

            expect(mockPrisma.workflow.findUnique).toHaveBeenCalledWith({
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

            (mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValue(emptyWorkflow);
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
