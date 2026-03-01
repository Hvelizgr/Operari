import { prisma } from '../config/database';
import { Logger } from './logger.service';

export interface SmartInsight {
    id: string;
    type: 'NODE_FAILURE' | 'API_OUTAGE' | 'FLEET_STRESS';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    message: string;
    affectedInstances: number;
    affectedWorkflows: number;
    metadata: any;
    timestamp: Date;
}

export class CorrelationService {
    private logger: Logger;

    constructor() {
        this.logger = Logger.getInstance();
    }

    /**
     * Analyze errors across the entire fleet to find common patterns
     */
    async getGlobalInsights(tenantId: string): Promise<SmartInsight[]> {
        const insights: SmartInsight[] = [];
        const lookbackPeriod = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

        try {
            // 1. Fetch recent errors with their execution and workflow info
            const recentErrors = await prisma.executionError.findMany({
                where: {
                    createdAt: { gte: lookbackPeriod },
                    execution: {
                        workflow: {
                            tenantId
                        }
                    }
                },
                include: {
                    execution: {
                        include: {
                            workflow: true
                        }
                    }
                }
            });

            if (recentErrors.length === 0) return [];

            // 2. Correlation: Group by Node Type (from context)
            const nodeTypeFailures: Record<string, {
                count: number,
                workflows: Set<string>,
                instances: Set<string>,
                errorMessages: Set<string>
            }> = {};

            recentErrors.forEach(err => {
                const context = err.context as any;
                const nodeType = context?.nodeType || 'unknown';
                
                if (!nodeTypeFailures[nodeType]) {
                    nodeTypeFailures[nodeType] = {
                        count: 0,
                        workflows: new Set(),
                        instances: new Set(),
                        errorMessages: new Set()
                    };
                }

                nodeTypeFailures[nodeType].count++;
                nodeTypeFailures[nodeType].workflows.add(err.execution.workflowId);
                // Note: We don't have direct instanceId in ExecutionError yet, 
                // but we can infer it if we had instance mapping or if it was in metadata
                // For now, let's use workflows as a proxy for "distribution"
                nodeTypeFailures[nodeType].errorMessages.add(err.message);
            });

            // 3. Detect Patterns
            for (const [nodeType, data] of Object.entries(nodeTypeFailures)) {
                if (nodeType === 'unknown') continue;

                // Threshold: If more than 3 different workflows fail with the same node type
                if (data.workflows.size >= 3) {
                    insights.push({
                        id: `node-fail-${nodeType}-${Date.now()}`,
                        type: 'NODE_FAILURE',
                        severity: data.workflows.size > 5 ? 'HIGH' : 'MEDIUM',
                        title: `Global Failure Pattern: ${nodeType}`,
                        message: `The '${nodeType}' node is failing across ${data.workflows.size} different workflows. This may indicate an external API issue or a common misconfiguration.`,
                        affectedInstances: 1, // Placeholder
                        affectedWorkflows: data.workflows.size,
                        metadata: {
                            nodeType,
                            sampleErrors: Array.from(data.errorMessages).slice(0, 3)
                        },
                        timestamp: new Date()
                    });
                }
            }

            // 4. Fleet Stress Detection (CPU/RAM spikes correlated with errors)
            // This would integrate with FleetService in a real scenario
            
            return insights;
        } catch (error) {
            this.logger.error('Failed to generate smart insights', {
                error: error instanceof Error ? error : new Error(String(error))
            });
            return [];
        }
    }
}

export const correlationService = new CorrelationService();
