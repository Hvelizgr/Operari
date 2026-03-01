import { ExecutionOutput, WorkflowNode } from '../types/workflow.types';
import { Logger } from './logger.service';

/**
 * Service responsible for generating mock data for workflow nodes.
 * Used during testing and development to simulate node executions.
 */
export class MockDataService {
    private static instance: MockDataService;
    private logger: Logger;

    private constructor() {
        this.logger = Logger.getInstance();
    }

    public static getInstance(): MockDataService {
        if (!MockDataService.instance) {
            MockDataService.instance = new MockDataService();
        }
        return MockDataService.instance;
    }

    /**
     * Generates mock output for a given node.
     * Prioritizes manually defined mockOutput in the node config.
     */
    public async generateMockOutput(node: WorkflowNode): Promise<ExecutionOutput> {
        // 1. If the node already has a manual mock defined, use it
        if (node.mockOutput && Object.keys(node.mockOutput).length > 0) {
            this.logger.debug(`Using manual mock output for node: ${node.id} (${node.type})`);
            return { ...node.mockOutput };
        }

        // 2. Otherwise, generate data based on node type
        this.logger.debug(`Generating automatic mock output for node type: ${node.type}`);
        return this.getAutomaticMock(node);
    }

    private getAutomaticMock(node: WorkflowNode): ExecutionOutput {
        const type = node.type.toLowerCase();

        // Basic mocks based on node type
        if (type.includes('http') || type.includes('api')) {
            return {
                status: 200,
                data: {
                    id: Math.floor(Math.random() * 1000),
                    success: true,
                    message: "Mock API response",
                    timestamp: new Date().toISOString()
                },
                headers: { "content-type": "application/json" }
            };
        }

        if (type.includes('database') || type.includes('sql')) {
            return {
                rowCount: 1,
                rows: [{ id: 1, name: "Mock Record", created_at: new Date().toISOString() }],
                message: "Query executed successfully"
            };
        }

        if (type.includes('webhook') || type.includes('trigger')) {
            return {
                body: { event: "mock_event", data: "test" },
                headers: { "user-agent": "NanoFlow-Mock" },
                query: {}
            };
        }

        if (type.includes('email')) {
            return {
                messageId: `mock-${Date.now()}`,
                accepted: ["test@example.com"],
                response: "250 OK"
            };
        }

        if (type.includes('condition') || type.includes('if')) {
            return {
                conditionResult: true,
                __activePorts: [0] // True branch
            };
        }

        if (type.includes('switch')) {
            return {
                result: "option_1",
                __activePorts: [0]
            };
        }

        // Default generic mock
        return {
            mocked: true,
            nodeId: node.id,
            nodeType: node.type,
            timestamp: new Date().toISOString()
        };
    }
}

export const mockDataService = MockDataService.getInstance();
