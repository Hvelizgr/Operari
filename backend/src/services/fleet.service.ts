
import { PrismaClient, N8nInstance } from '@prisma/client';
import axios from 'axios';
import { logger } from '../config/logger.config';
import { exec } from 'child_process';
import { promisify } from 'util';

const _execAsync = promisify(exec);

export class FleetService {
    private prisma: PrismaClient;
    private static instance: FleetService;

    private constructor() {
        this.prisma = new PrismaClient();
    }

    public static getInstance(): FleetService {
        if (!FleetService.instance) {
            FleetService.instance = new FleetService();
        }
        return FleetService.instance;
    }

    /**
     * Physical restart of a container via Docker API/CLI
     * This is the "Physical Auto-Healing" core logic
     */
    private async physicalRestart(instance: N8nInstance): Promise<boolean> {
        try {
            // In a production environment, this would call the Docker Socket API (/containers/{id}/restart)
            // or the Kubernetes API. For this implementation, we simulate using Docker CLI
            // assuming the container name is 'nanoflow-n8n-' + instance.id
            const containerName = `nanoflow-n8n-${instance.id}`;
            
            logger.warn({ containerName }, 'Issuing physical container restart command');
            
            // We simulate the execution. In a real environment with Docker access:
            // await execAsync(`docker restart ${containerName}`);
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate IO delay
            return true;
        } catch (error) {
            logger.error({ err: error }, 'Physical restart failed');
            return false;
        }
    }

    /**
     * Triggers a workflow in a target instance
     */
    async triggerRemoteWorkflow(
        instanceId: string, 
        workflowId: string, 
        payload: any
    ): Promise<any> {
        const instance = await this.prisma.n8nInstance.findUnique({ where: { id: instanceId } });
        if (!instance) throw new Error('Target instance not found');

        logger.info({ instanceId, workflowId }, 'Triggering remote workflow across instances');

        try {
            const response = await axios.post(
                `${instance.url}/api/v1/workflows/${workflowId}/run`,
                { data: payload },
                {
                    headers: {
                        'X-N8N-API-KEY': instance.apiKey || '',
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error: any) {
            logger.error({ err: error, instanceId }, 'Failed to trigger remote workflow');
            throw new Error(`Remote trigger failed: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Cross-instance relay: Allows Instance A to send data to Instance B via NanoFlow
     */
    async relayTrigger(
        sourceInstanceId: string,
        targetInstanceId: string,
        targetWorkflowId: string,
        data: any
    ): Promise<any> {
        logger.info({ sourceInstanceId, targetInstanceId }, 'Relaying cross-instance trigger');
        
        // Log the relay event for audit
        await this.prisma.auditLog.create({
            data: {
                tenantId: 'system', // Should be source tenant
                userId: 'system',
                action: 'CROSS_INSTANCE_TRIGGER',
                resourceType: 'INSTANCE',
                resourceId: targetInstanceId,
                details: {
                    sourceInstanceId,
                    targetWorkflowId,
                    payloadSize: JSON.stringify(data).length
                }
            }
        });

        return this.triggerRemoteWorkflow(targetInstanceId, targetWorkflowId, data);
    }

    /**
     * Auto-healing logic: Checks health and attempts restart if supported
     */
    async autoHeal(instanceId: string): Promise<{ fixed: boolean, message: string }> {
        const instance = await this.prisma.n8nInstance.findUnique({ where: { id: instanceId } });
        if (!instance) return { fixed: false, message: 'Instance not found' };

        if (instance.status === 'ONLINE') return { fixed: true, message: 'Already healthy' };

        logger.warn({ instanceId }, 'Attempting auto-healing for instance');

        // Update status to RECOVERING
        await this.prisma.n8nInstance.update({
            where: { id: instanceId },
            data: { status: 'RECOVERING' }
        });

        // 1. Attempt Physical Restart
        const restarted = await this.physicalRestart(instance);
        
        if (!restarted) {
            return { fixed: false, message: 'Physical restart failed' };
        }

        // 2. Wait for service to be ONLINE
        let attempts = 0;
        while (attempts < 10) {
            try {
                const response = await axios.get(`${instance.url}/healthz`, { timeout: 2000 });
                if (response.status === 200) {
                    await this.prisma.n8nInstance.update({
                        where: { id: instanceId },
                        data: { status: 'ONLINE' }
                    });
                    return { fixed: true, message: 'Instance physically recovered and online' };
                }
            } catch (e) {
                // Not online yet
            }
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return { fixed: false, message: 'Container restarted but service is not responding' };
    }

    /**
     * Aggregates recent executions from all connected instances
     */
    async getGlobalExecutions(tenantId: string, limit: number = 20): Promise<any[]> {
        const instances = await this.prisma.n8nInstance.findMany({ where: { tenantId } });
        
        const allExecutions = await Promise.all(
            instances.map(async (instance) => {
                try {
                    const response = await axios.get(`${instance.url}/api/v1/executions`, {
                        params: { limit },
                        headers: { 'X-N8N-API-KEY': instance.apiKey || '' }
                    });
                    
                    return (response.data.data || []).map((exec: any) => ({
                        ...exec,
                        instanceName: instance.name,
                        instanceId: instance.id
                    }));
                } catch (error) {
                    logger.error({ instanceId: instance.id }, 'Failed to fetch executions for aggregator');
                    return [];
                }
            })
        );

        return allExecutions
            .flat()
            .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
            .slice(0, limit);
    }

    /**
     * Update all instances in a tenant's fleet to a new version
     */
    async updateFleet(tenantId: string, version?: string): Promise<number> {
        const instances = await this.prisma.n8nInstance.findMany({ where: { tenantId } });

        logger.info({ tenantId, instanceCount: instances.length, version }, 'Starting fleet update');

        // In a real environment, this would trigger container image updates
        // For now, we just log the update request
        for (const instance of instances) {
            await this.prisma.n8nInstance.update({
                where: { id: instance.id },
                data: { status: 'UPDATING' }
            });

            // Simulate update process
            setTimeout(async () => {
                await this.prisma.n8nInstance.update({
                    where: { id: instance.id },
                    data: { status: 'ONLINE' }
                });
            }, 5000);
        }

        return instances.length;
    }

    /**
     * AI Debugger for any execution in the fleet
     */
    async debugExecution(instanceId: string, executionId: string): Promise<any> {
        const instance = await this.prisma.n8nInstance.findUnique({ where: { id: instanceId } });
        if (!instance) throw new Error('Instance not found');

        // Fetch execution details from target n8n
        const response = await axios.get(`${instance.url}/api/v1/executions/${executionId}`, {
            headers: { 'X-N8N-API-KEY': instance.apiKey || '' }
        });

        const execution = response.data;
        if (execution.status !== 'failed') {
            return { message: 'Execution did not fail, no debugging needed.' };
        }

        // Use existing AIService to analyze
        const { AIService } = require('./ai.service');
        return AIService.explainError(execution.error || 'Unknown error', {
            nodeType: 'Remote Node',
            stackTrace: JSON.stringify(execution.data?.resultData?.runData)
        });
    }

    /**
     * Get all instances for a tenant
     */
    async getInstances(tenantId: string): Promise<N8nInstance[]> {
        return this.prisma.n8nInstance.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });
    }
}
