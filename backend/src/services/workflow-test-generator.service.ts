
import { PrismaClient } from '@prisma/client';

export interface WorkflowTest {
    id: string;
    name: string;
    nodeId: string;
    assertionType: 'OUTPUT_EXISTS' | 'FIELD_MATCH' | 'TYPE_MATCH' | 'DURATION_UNDER';
    expectedValue?: any;
    fieldPath?: string;
}

export class WorkflowTestGeneratorService {
    private prisma: PrismaClient;
    private static instance: WorkflowTestGeneratorService;

    private constructor() {
        this.prisma = new PrismaClient();
    }

    public static getInstance(): WorkflowTestGeneratorService {
        if (!WorkflowTestGeneratorService.instance) {
            WorkflowTestGeneratorService.instance = new WorkflowTestGeneratorService();
        }
        return WorkflowTestGeneratorService.instance;
    }

    async generateTests(workflowId: string): Promise<WorkflowTest[]> {
        const workflow = await this.prisma.workflow.findUnique({
            where: { id: workflowId },
            include: { workflowNodes: true }
        });

        if (!workflow) throw new Error('Workflow not found');

        const tests: WorkflowTest[] = [];

        workflow.workflowNodes.forEach(node => {
            // Rule 1: Every node should at least produce some output
            tests.push({
                id: `test_${node.id}_exists`,
                name: `Output exists for ${node.title}`,
                nodeId: node.id,
                assertionType: 'OUTPUT_EXISTS'
            });

            // Rule 2: HTTP Request nodes should have reasonable duration
            if (node.type.includes('httpRequest')) {
                tests.push({
                    id: `test_${node.id}_latency`,
                    name: `${node.title} latency < 5s`,
                    nodeId: node.id,
                    assertionType: 'DURATION_UNDER',
                    expectedValue: 5000
                });
            }

            // Rule 3: Data transformation nodes (Set, Code) should output objects
            if (node.type.includes('set') || node.type.includes('code')) {
                tests.push({
                    id: `test_${node.id}_type`,
                    name: `${node.title} returns object`,
                    nodeId: node.id,
                    assertionType: 'TYPE_MATCH',
                    expectedValue: 'object'
                });
            }
        });

        // Save generated tests to workflow metadata or a new model if needed
        // For now, we return them to the UI for approval
        return tests;
    }

    async runAutoTests(executionId: string): Promise<any> {
        const execution = await this.prisma.execution.findUnique({
            where: { id: executionId },
            include: { 
                workflow: { include: { workflowNodes: true } },
                nodeLogs: true 
            }
        });

        if (!execution) throw new Error('Execution not found');

        const tests = await this.generateTests(execution.workflowId);
        const results = tests.map(test => {
            const log = execution.nodeLogs.find(l => l.nodeId === test.nodeId);
            let passed = false;
            let error = '';

            if (!log) {
                error = 'Node did not execute';
            } else {
                switch (test.assertionType) {
                    case 'OUTPUT_EXISTS':
                        passed = !!log.output && Object.keys(log.output as object).length > 0;
                        if (!passed) error = 'Empty output';
                        break;
                    case 'DURATION_UNDER':
                        passed = (log.duration || 0) < (test.expectedValue as number);
                        if (!passed) error = `Duration ${log.duration}ms exceeded limit ${test.expectedValue}ms`;
                        break;
                    case 'TYPE_MATCH':
                        passed = typeof log.output === test.expectedValue;
                        if (!passed) error = `Expected ${test.expectedValue}, got ${typeof log.output}`;
                        break;
                }
            }

            return { ...test, passed, error };
        });

        // Store results in NodeLogs if schema supports it (it does in my previous read)
        for (const res of results) {
            const log = execution.nodeLogs.find(l => l.nodeId === res.nodeId);
            if (log) {
                const currentResults = (log.testResults as any[]) || [];
                await this.prisma.nodeLog.update({
                    where: { id: log.id },
                    data: { testResults: [...currentResults, res] as any }
                });
            }
        }

        return results;
    }
}
