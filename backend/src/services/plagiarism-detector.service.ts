import { Workflow, WorkflowNode } from '../types/workflow.types';

export interface PlagiarismResult {
    similarity: number;
    isLikelyPlagiarism: boolean;
    details: {
        structuralSimilarity: number;
        nodeTypeSimilarity: number;
        configSimilarity: number;
        connectionPatternSimilarity: number;
    };
    suspiciousPatterns: string[];
}

export interface WorkflowComparison {
    workflow1Id: string;
    workflow2Id: string;
    result: PlagiarismResult;
}

export class PlagiarismDetectorService {
    private static instance: PlagiarismDetectorService;
    private readonly PLAGIARISM_THRESHOLD = 0.85;

    public static getInstance(): PlagiarismDetectorService {
        if (!PlagiarismDetectorService.instance) {
            PlagiarismDetectorService.instance = new PlagiarismDetectorService();
        }
        return PlagiarismDetectorService.instance;
    }

    compare(workflow1: Workflow, workflow2: Workflow): PlagiarismResult {
        const structuralSimilarity = this.calculateStructuralSimilarity(workflow1, workflow2);
        const nodeTypeSimilarity = this.calculateNodeTypeSimilarity(workflow1, workflow2);
        const configSimilarity = this.calculateConfigSimilarity(workflow1, workflow2);
        const connectionPatternSimilarity = this.calculateConnectionPatternSimilarity(workflow1, workflow2);

        const weights = {
            structural: 0.3,
            nodeType: 0.25,
            config: 0.25,
            connection: 0.2,
        };

        const overallSimilarity = 
            structuralSimilarity * weights.structural +
            nodeTypeSimilarity * weights.nodeType +
            configSimilarity * weights.config +
            connectionPatternSimilarity * weights.connection;

        const suspiciousPatterns = this.detectSuspiciousPatterns(workflow1, workflow2);

        return {
            similarity: Math.round(overallSimilarity * 100) / 100,
            isLikelyPlagiarism: overallSimilarity >= this.PLAGIARISM_THRESHOLD,
            details: {
                structuralSimilarity: Math.round(structuralSimilarity * 100) / 100,
                nodeTypeSimilarity: Math.round(nodeTypeSimilarity * 100) / 100,
                configSimilarity: Math.round(configSimilarity * 100) / 100,
                connectionPatternSimilarity: Math.round(connectionPatternSimilarity * 100) / 100,
            },
            suspiciousPatterns,
        };
    }

    compareMultiple(workflows: Workflow[]): WorkflowComparison[] {
        const comparisons: WorkflowComparison[] = [];

        for (let i = 0; i < workflows.length; i++) {
            for (let j = i + 1; j < workflows.length; j++) {
                const result = this.compare(workflows[i], workflows[j]);
                comparisons.push({
                    workflow1Id: workflows[i].id,
                    workflow2Id: workflows[j].id,
                    result,
                });
            }
        }

        return comparisons.sort((a, b) => b.result.similarity - a.result.similarity);
    }

    private calculateStructuralSimilarity(w1: Workflow, w2: Workflow): number {
        const nodeCountDiff = Math.abs(w1.nodes.length - w2.nodes.length);
        const connCountDiff = Math.abs(w1.connections.length - w2.connections.length);

        const maxNodes = Math.max(w1.nodes.length, w2.nodes.length);
        const maxConns = Math.max(w1.connections.length, w2.connections.length);

        if (maxNodes === 0 && maxConns === 0) return 1;

        const nodeSimilarity = maxNodes > 0 ? 1 - (nodeCountDiff / maxNodes) : 1;
        const connSimilarity = maxConns > 0 ? 1 - (connCountDiff / maxConns) : 1;

        return (nodeSimilarity + connSimilarity) / 2;
    }

    private calculateNodeTypeSimilarity(w1: Workflow, w2: Workflow): number {
        const types1 = this.getNodeTypeDistribution(w1.nodes);
        const types2 = this.getNodeTypeDistribution(w2.nodes);

        const allTypes = new Set([...Object.keys(types1), ...Object.keys(types2)]);
        
        if (allTypes.size === 0) return 1;

        let matchScore = 0;
        let totalScore = 0;

        allTypes.forEach(type => {
            const count1 = types1[type] || 0;
            const count2 = types2[type] || 0;
            const maxCount = Math.max(count1, count2);
            const minCount = Math.min(count1, count2);

            totalScore += maxCount;
            matchScore += minCount;
        });

        return totalScore > 0 ? matchScore / totalScore : 1;
    }

    private calculateConfigSimilarity(w1: Workflow, w2: Workflow): number {
        const configs1 = w1.nodes.map(n => this.normalizeConfig(n.config));
        const configs2 = w2.nodes.map(n => this.normalizeConfig(n.config));

        if (configs1.length === 0 && configs2.length === 0) return 1;
        if (configs1.length === 0 || configs2.length === 0) return 0;

        let totalSimilarity = 0;
        let comparisons = 0;

        configs1.forEach(c1 => {
            let bestMatch = 0;
            configs2.forEach(c2 => {
                const sim = this.compareConfigs(c1, c2);
                bestMatch = Math.max(bestMatch, sim);
            });
            totalSimilarity += bestMatch;
            comparisons++;
        });

        return comparisons > 0 ? totalSimilarity / comparisons : 0;
    }

    private calculateConnectionPatternSimilarity(w1: Workflow, w2: Workflow): number {
        const pattern1 = this.getConnectionPattern(w1);
        const pattern2 = this.getConnectionPattern(w2);

        const allPatterns = new Set([...pattern1, ...pattern2]);
        
        if (allPatterns.size === 0) return 1;

        const set1 = new Set(pattern1);
        const set2 = new Set(pattern2);

        let intersection = 0;
        allPatterns.forEach(p => {
            if (set1.has(p) && set2.has(p)) intersection++;
        });

        return intersection / allPatterns.size;
    }

    private getNodeTypeDistribution(nodes: WorkflowNode[]): Record<string, number> {
        const dist: Record<string, number> = {};
        nodes.forEach(node => {
            dist[node.type] = (dist[node.type] || 0) + 1;
        });
        return dist;
    }

    private normalizeConfig(config: any): string {
        if (!config) return '';
        
        const normalized = { ...config };
        delete normalized.x;
        delete normalized.y;
        delete normalized.id;
        delete normalized.timestamp;
        
        return JSON.stringify(normalized, Object.keys(normalized).sort());
    }

    private compareConfigs(c1: string, c2: string): number {
        if (c1 === c2) return 1;
        if (!c1 || !c2) return 0;

        const set1 = new Set(c1.split(''));
        const set2 = new Set(c2.split(''));
        
        let intersection = 0;
        set1.forEach(char => {
            if (set2.has(char)) intersection++;
        });

        const union = new Set([...set1, ...set2]).size;
        return union > 0 ? intersection / union : 0;
    }

    private getConnectionPattern(workflow: Workflow): string[] {
        const nodeTypeMap = new Map<string, string>();
        workflow.nodes.forEach(n => nodeTypeMap.set(n.id, n.type));

        return workflow.connections.map(conn => {
            const sourceType = nodeTypeMap.get(conn.sourceId) || 'unknown';
            const targetType = nodeTypeMap.get(conn.targetId) || 'unknown';
            return `${sourceType}->${targetType}`;
        }).sort();
    }

    private detectSuspiciousPatterns(w1: Workflow, w2: Workflow): string[] {
        const patterns: string[] = [];

        if (w1.nodes.length === w2.nodes.length) {
            patterns.push('EXACT_NODE_COUNT');
        }

        if (w1.connections.length === w2.connections.length) {
            patterns.push('EXACT_CONNECTION_COUNT');
        }

        const types1 = Object.keys(this.getNodeTypeDistribution(w1.nodes)).sort().join(',');
        const types2 = Object.keys(this.getNodeTypeDistribution(w2.nodes)).sort().join(',');
        if (types1 === types2) {
            patterns.push('IDENTICAL_NODE_TYPE_SET');
        }

        const connPattern1 = this.getConnectionPattern(w1).join('|');
        const connPattern2 = this.getConnectionPattern(w2).join('|');
        if (connPattern1 === connPattern2) {
            patterns.push('IDENTICAL_FLOW_STRUCTURE');
        }

        const configHashes1 = w1.nodes.map(n => this.normalizeConfig(n.config)).sort();
        const configHashes2 = w2.nodes.map(n => this.normalizeConfig(n.config)).sort();
        const commonConfigs = configHashes1.filter(c => configHashes2.includes(c)).length;
        if (commonConfigs > Math.min(w1.nodes.length, w2.nodes.length) * 0.8) {
            patterns.push('HIGH_CONFIG_OVERLAP');
        }

        return patterns;
    }
}
