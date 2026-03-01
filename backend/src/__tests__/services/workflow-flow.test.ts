import { Workflow } from '../../types/workflow.types';

describe('Workflow Flow Tests', () => {
    describe('Simple Linear Flow', () => {
        const linearWorkflow: Workflow = {
            id: 'test-linear',
            name: 'Linear Flow Test',
            nodes: [
                {
                    id: 'start',
                    type: 'Start',
                    title: 'Start',
                    position: { x: 0, y: 0 },
                    config: {},
                },
                {
                    id: 'transform',
                    type: 'Transform',
                    title: 'Add Field',
                    position: { x: 200, y: 0 },
                    config: {
                        mapping: {
                            processed: true,
                            original: '{{ data }}'
                        }
                    },
                },
                {
                    id: 'end',
                    type: 'End',
                    title: 'End',
                    position: { x: 400, y: 0 },
                    config: {},
                },
            ],
            connections: [
                { id: 'c1', sourceId: 'start', targetId: 'transform', sourcePort: 'output', targetPort: 'input' },
                { id: 'c2', sourceId: 'transform', targetId: 'end', sourcePort: 'output', targetPort: 'input' },
            ],
        };

        it('should have correct node count', () => {
            expect(linearWorkflow.nodes.length).toBe(3);
        });

        it('should have correct connection count', () => {
            expect(linearWorkflow.connections.length).toBe(2);
        });

        it('should have valid node references in connections', () => {
            const nodeIds = new Set(linearWorkflow.nodes.map(n => n.id));
            linearWorkflow.connections.forEach(conn => {
                expect(nodeIds.has(conn.sourceId)).toBe(true);
                expect(nodeIds.has(conn.targetId)).toBe(true);
            });
        });
    });

    describe('Conditional Branch Flow', () => {
        const branchWorkflow: Workflow = {
            id: 'test-branch',
            name: 'Branch Flow Test',
            nodes: [
                {
                    id: 'start',
                    type: 'Start',
                    title: 'Start',
                    position: { x: 0, y: 0 },
                    config: {},
                },
                {
                    id: 'condition',
                    type: 'Condition',
                    title: 'Check Value',
                    position: { x: 200, y: 0 },
                    config: {
                        field: 'value',
                        operator: 'greaterThan',
                        value: '10',
                    },
                },
                {
                    id: 'true_branch',
                    type: 'Transform',
                    title: 'True Branch',
                    position: { x: 400, y: -100 },
                    config: { mapping: { result: 'high' } },
                },
                {
                    id: 'false_branch',
                    type: 'Transform',
                    title: 'False Branch',
                    position: { x: 400, y: 100 },
                    config: { mapping: { result: 'low' } },
                },
                {
                    id: 'end',
                    type: 'End',
                    title: 'End',
                    position: { x: 600, y: 0 },
                    config: {},
                },
            ],
            connections: [
                { id: 'c1', sourceId: 'start', targetId: 'condition', sourcePort: 'output', targetPort: 'input' },
                { id: 'c2', sourceId: 'condition', targetId: 'true_branch', sourcePort: 'true', targetPort: 'input' },
                { id: 'c3', sourceId: 'condition', targetId: 'false_branch', sourcePort: 'false', targetPort: 'input' },
                { id: 'c4', sourceId: 'true_branch', targetId: 'end', sourcePort: 'output', targetPort: 'input' },
                { id: 'c5', sourceId: 'false_branch', targetId: 'end', sourcePort: 'output', targetPort: 'input' },
            ],
        };

        it('should have branching structure', () => {
            const conditionNode = branchWorkflow.nodes.find(n => n.type === 'Condition');
            expect(conditionNode).toBeDefined();

            const outgoingConnections = branchWorkflow.connections.filter(c => c.sourceId === 'condition');
            expect(outgoingConnections.length).toBe(2);
            expect(outgoingConnections.map(c => c.sourcePort).sort()).toEqual(['false', 'true']);
        });

        it('should have merge point at end', () => {
            const incomingToEnd = branchWorkflow.connections.filter(c => c.targetId === 'end');
            expect(incomingToEnd.length).toBe(2);
        });
    });

    describe('Loop Flow', () => {
        const loopWorkflow: Workflow = {
            id: 'test-loop',
            name: 'Loop Flow Test',
            nodes: [
                {
                    id: 'start',
                    type: 'Start',
                    title: 'Start',
                    position: { x: 0, y: 0 },
                    config: {},
                },
                {
                    id: 'loop',
                    type: 'Loop',
                    title: 'For Each Item',
                    position: { x: 200, y: 0 },
                    config: {
                        iterateOver: 'items',
                        maxIterations: 100,
                    },
                },
                {
                    id: 'process',
                    type: 'Transform',
                    title: 'Process Item',
                    position: { x: 400, y: 0 },
                    config: {
                        mapping: { processed: true }
                    },
                },
                {
                    id: 'end',
                    type: 'End',
                    title: 'End',
                    position: { x: 600, y: 0 },
                    config: {},
                },
            ],
            connections: [
                { id: 'c1', sourceId: 'start', targetId: 'loop', sourcePort: 'output', targetPort: 'input' },
                { id: 'c2', sourceId: 'loop', targetId: 'process', sourcePort: 'item', targetPort: 'input' },
                { id: 'c3', sourceId: 'process', targetId: 'loop', sourcePort: 'output', targetPort: 'loopBack' },
                { id: 'c4', sourceId: 'loop', targetId: 'end', sourcePort: 'done', targetPort: 'input' },
            ],
        };

        it('should have loop back connection', () => {
            const loopBackConn = loopWorkflow.connections.find(c => 
                c.sourceId === 'process' && c.targetId === 'loop'
            );
            expect(loopBackConn).toBeDefined();
        });

        it('should have done exit from loop', () => {
            const doneConn = loopWorkflow.connections.find(c => 
                c.sourceId === 'loop' && c.sourcePort === 'done'
            );
            expect(doneConn).toBeDefined();
        });
    });

    describe('Parallel Execution Flow', () => {
        const parallelWorkflow: Workflow = {
            id: 'test-parallel',
            name: 'Parallel Flow Test',
            nodes: [
                {
                    id: 'start',
                    type: 'Start',
                    title: 'Start',
                    position: { x: 0, y: 0 },
                    config: {},
                },
                {
                    id: 'split',
                    type: 'Split',
                    title: 'Split',
                    position: { x: 200, y: 0 },
                    config: {},
                },
                {
                    id: 'branch_a',
                    type: 'HTTP',
                    title: 'API A',
                    position: { x: 400, y: -100 },
                    config: { url: 'https://api-a.com', method: 'GET' },
                },
                {
                    id: 'branch_b',
                    type: 'HTTP',
                    title: 'API B',
                    position: { x: 400, y: 100 },
                    config: { url: 'https://api-b.com', method: 'GET' },
                },
                {
                    id: 'merge',
                    type: 'Merge',
                    title: 'Merge',
                    position: { x: 600, y: 0 },
                    config: { mode: 'waitAll' },
                },
                {
                    id: 'end',
                    type: 'End',
                    title: 'End',
                    position: { x: 800, y: 0 },
                    config: {},
                },
            ],
            connections: [
                { id: 'c1', sourceId: 'start', targetId: 'split', sourcePort: 'output', targetPort: 'input' },
                { id: 'c2', sourceId: 'split', targetId: 'branch_a', sourcePort: 'output_1', targetPort: 'input' },
                { id: 'c3', sourceId: 'split', targetId: 'branch_b', sourcePort: 'output_2', targetPort: 'input' },
                { id: 'c4', sourceId: 'branch_a', targetId: 'merge', sourcePort: 'output', targetPort: 'input_1' },
                { id: 'c5', sourceId: 'branch_b', targetId: 'merge', sourcePort: 'output', targetPort: 'input_2' },
                { id: 'c6', sourceId: 'merge', targetId: 'end', sourcePort: 'output', targetPort: 'input' },
            ],
        };

        it('should have split node with multiple outputs', () => {
            const splitOutputs = parallelWorkflow.connections.filter(c => c.sourceId === 'split');
            expect(splitOutputs.length).toBe(2);
        });

        it('should have merge node with multiple inputs', () => {
            const mergeInputs = parallelWorkflow.connections.filter(c => c.targetId === 'merge');
            expect(mergeInputs.length).toBe(2);
        });
    });

    describe('Flow Validation', () => {
        it('should detect orphan nodes', () => {
            const workflowWithOrphan: Workflow = {
                id: 'test-orphan',
                name: 'Orphan Test',
                nodes: [
                    { id: 'start', type: 'Start', title: 'Start', position: { x: 0, y: 0 }, config: {} },
                    { id: 'orphan', type: 'Transform', title: 'Orphan', position: { x: 200, y: 100 }, config: {} },
                    { id: 'end', type: 'End', title: 'End', position: { x: 400, y: 0 }, config: {} },
                ],
                connections: [
                    { id: 'c1', sourceId: 'start', targetId: 'end', sourcePort: 'output', targetPort: 'input' },
                ],
            };

            const connectedNodeIds = new Set<string>();
            workflowWithOrphan.connections.forEach(conn => {
                connectedNodeIds.add(conn.sourceId);
                connectedNodeIds.add(conn.targetId);
            });

            const orphanNodes = workflowWithOrphan.nodes.filter(n => !connectedNodeIds.has(n.id));
            expect(orphanNodes.length).toBe(1);
            expect(orphanNodes[0].id).toBe('orphan');
        });

        it('should detect cycles', () => {
            const workflowWithCycle: Workflow = {
                id: 'test-cycle',
                name: 'Cycle Test',
                nodes: [
                    { id: 'a', type: 'Transform', title: 'A', position: { x: 0, y: 0 }, config: {} },
                    { id: 'b', type: 'Transform', title: 'B', position: { x: 200, y: 0 }, config: {} },
                    { id: 'c', type: 'Transform', title: 'C', position: { x: 400, y: 0 }, config: {} },
                ],
                connections: [
                    { id: 'c1', sourceId: 'a', targetId: 'b', sourcePort: 'output', targetPort: 'input' },
                    { id: 'c2', sourceId: 'b', targetId: 'c', sourcePort: 'output', targetPort: 'input' },
                    { id: 'c3', sourceId: 'c', targetId: 'a', sourcePort: 'output', targetPort: 'input' },
                ],
            };

            function hasCycle(workflow: Workflow): boolean {
                const visited = new Set<string>();
                const recursionStack = new Set<string>();
                const adjList = new Map<string, string[]>();

                workflow.nodes.forEach(n => adjList.set(n.id, []));
                workflow.connections.forEach(c => {
                    const targets = adjList.get(c.sourceId) || [];
                    targets.push(c.targetId);
                    adjList.set(c.sourceId, targets);
                });

                function dfs(nodeId: string): boolean {
                    visited.add(nodeId);
                    recursionStack.add(nodeId);

                    const neighbors = adjList.get(nodeId) || [];
                    for (const neighbor of neighbors) {
                        if (!visited.has(neighbor)) {
                            if (dfs(neighbor)) return true;
                        } else if (recursionStack.has(neighbor)) {
                            return true;
                        }
                    }

                    recursionStack.delete(nodeId);
                    return false;
                }

                for (const node of workflow.nodes) {
                    if (!visited.has(node.id)) {
                        if (dfs(node.id)) return true;
                    }
                }

                return false;
            }

            expect(hasCycle(workflowWithCycle)).toBe(true);
        });
    });
});
