
import { PrismaClient } from '@prisma/client';

export interface BottleneckInfo {
    nodeId: string;
    nodeName: string;
    nodeType: string;
    avgDuration: number;
    failureRate: number;
    executionCount: number;
    impactScore: number; // Combined score of duration and failure rate
}

export interface ProcessMiningStats {
    workflowId: string;
    totalExecutions: number;
    avgTotalDuration: number;
    bottlenecks: BottleneckInfo[];
    pathAnalysis: {
        frequentPaths: string[][];
        failurePaths: string[][];
    };
}

export class ProcessMiningService {
    private prisma: PrismaClient;
    private static instance: ProcessMiningService;

    private constructor() {
        this.prisma = new PrismaClient();
    }

    public static getInstance(): ProcessMiningService {
        if (!ProcessMiningService.instance) {
            ProcessMiningService.instance = new ProcessMiningService();
        }
        return ProcessMiningService.instance;
    }

    async analyzeWorkflow(workflowId: string, limit: number = 100): Promise<ProcessMiningStats> {
        const executions = await this.prisma.execution.findMany({
            where: { workflowId },
            include: { nodeLogs: true },
            orderBy: { startedAt: 'desc' },
            take: limit
        });

        if (executions.length === 0) {
            return {
                workflowId,
                totalExecutions: 0,
                avgTotalDuration: 0,
                bottlenecks: [],
                pathAnalysis: { frequentPaths: [], failurePaths: [] }
            };
        }

        const totalExecutions = executions.length;
        const avgTotalDuration = executions.reduce((acc, exec) => acc + (exec.duration || 0), 0) / totalExecutions;

        // Aggregating node stats
        const nodeStats: Record<string, { 
            name: string, 
            type: string, 
            durations: number[], 
            failures: number, 
            count: number 
        }> = {};

        executions.forEach(exec => {
            exec.nodeLogs.forEach(log => {
                if (!nodeStats[log.nodeId]) {
                    nodeStats[log.nodeId] = {
                        name: log.nodeName,
                        type: log.nodeType,
                        durations: [],
                        failures: 0,
                        count: 0
                    };
                }
                const stats = nodeStats[log.nodeId];
                stats.count++;
                if (log.duration) stats.durations.push(log.duration);
                if (log.status === 'FAILED') stats.failures++;
            });
        });

        const bottlenecks: BottleneckInfo[] = Object.entries(nodeStats).map(([nodeId, stats]) => {
            const avgDuration = stats.durations.length > 0 
                ? stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length 
                : 0;
            const failureRate = stats.failures / stats.count;
            
            // Heuristic impact score: weighted combination of relative duration and failure rate
            const impactScore = (avgDuration / avgTotalDuration) * 0.6 + (failureRate * 10) * 0.4;

            return {
                nodeId,
                nodeName: stats.name,
                nodeType: stats.type,
                avgDuration,
                failureRate,
                executionCount: stats.count,
                impactScore
            };
        }).sort((a, b) => b.impactScore - a.impactScore);

        return {
            workflowId,
            totalExecutions,
            avgTotalDuration,
            bottlenecks: bottlenecks.slice(0, 5), // Top 5 bottlenecks
            pathAnalysis: {
                frequentPaths: [], // Placeholder for future complex path analysis
                failurePaths: []
            }
        };
    }

    async getGlobalBottlenecks(tenantId: string): Promise<BottleneckInfo[]> {
        // Find most problematic nodes across all workflows for a tenant
        const workflows = await this.prisma.workflow.findMany({
            where: { tenantId },
            select: { id: true }
        });

        const allBottlenecks: BottleneckInfo[] = [];
        for (const wf of workflows) {
            const analysis = await this.analyzeWorkflow(wf.id, 50);
            allBottlenecks.push(...analysis.bottlenecks);
        }

        return allBottlenecks
            .sort((a, b) => b.impactScore - a.impactScore)
            .slice(0, 10);
    }
}
