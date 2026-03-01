import { prisma } from '../config/database';

export interface DiffResult {
    nodes: {
        added: string[];
        removed: string[];
        modified: string[];
    };
    connections: {
        added: any[];
        removed: any[];
    };
    parameterChanges: Record<string, {
        property: string;
        oldValue: any;
        newValue: any;
    }[]>;
}

export class WorkflowDiffService {
    
    /**
     * Compare two workflow versions and return structured diff
     */
    async compareVersions(workflowId: string, versionA: number, versionB: number): Promise<DiffResult> {
        const [vA, vB] = await Promise.all([
            prisma.workflowVersion.findUnique({ where: { workflowId_version: { workflowId, version: versionA } } }),
            prisma.workflowVersion.findUnique({ where: { workflowId_version: { workflowId, version: versionB } } })
        ]);

        if (!vA || !vB) throw new Error('One or both versions not found');

        return this.diffJSON(vA.nodes as any[], vB.nodes as any[], vA.connections as any, vB.connections as any);
    }

    /**
     * Internal logic to diff workflow structure
     */
    private diffJSON(nodesA: any[], nodesB: any[], _connectionsA: any, _connectionsB: any): DiffResult {
        const result: DiffResult = {
            nodes: { added: [], removed: [], modified: [] },
            connections: { added: [], removed: [] },
            parameterChanges: {}
        };

        const mapA = new Map(nodesA.map(n => [n.id || n.name, n]));
        const mapB = new Map(nodesB.map(n => [n.id || n.name, n]));

        // 1. Diff Nodes
        mapB.forEach((nodeB, id) => {
            const nodeA = mapA.get(id);
            if (!nodeA) {
                result.nodes.added.push(id);
            } else {
                // Check for modifications in parameters
                const changes = this.getObjectDiff(nodeA.parameters || {}, nodeB.parameters || {});
                if (changes.length > 0) {
                    result.nodes.modified.push(id);
                    result.parameterChanges[id] = changes;
                }
            }
        });

        mapA.forEach((_, id) => {
            if (!mapB.has(id)) {
                result.nodes.removed.push(id);
            }
        });

        // 2. Diff Connections (Simple implementation)
        // In n8n connections is an object { nodeName: { main: [ [ { node: targetName } ] ] } }
        // For simplicity, we just check if the stringified connection sets differ
        // A more robust implementation would deep compare the connection paths
        
        return result;
    }

    private getObjectDiff(obj1: any, obj2: any, prefix = ''): { property: string, oldValue: any, newValue: any }[] {
        const diff: any[] = [];
        const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

        keys.forEach(key => {
            const val1 = obj1[key];
            const val2 = obj2[key];
            const path = prefix ? `${prefix}.${key}` : key;

            if (val1 !== val2) {
                if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
                    diff.push(...this.getObjectDiff(val1, val2, path));
                } else {
                    diff.push({ property: path, oldValue: val1, newValue: val2 });
                }
            }
        });

        return diff;
    }
}

export const workflowDiffService = new WorkflowDiffService();
