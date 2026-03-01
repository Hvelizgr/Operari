import { NodeExecutor } from '../../editor/node-executor.service';
import { WorkflowNode, ExecutionInput } from '../../types/workflow.types';

jest.mock('../../services/n8n.service', () => ({
    N8nService: {
        getInstance: jest.fn().mockReturnValue({
            executeNode: jest.fn().mockResolvedValue({ data: { result: 'mocked' } }),
        }),
    },
}));

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

    beforeEach(() => {
        jest.clearAllMocks();
        nodeExecutor = new NodeExecutor();
    });

    describe('execute - delegates to n8n', () => {
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

        it('should delegate node execution to n8n service', async () => {
            const result = await nodeExecutor.execute(httpNode, input);
            expect(result).toHaveProperty('data');
        });
    });
});
