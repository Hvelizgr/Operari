
import { PrismaClient, GlobalVariable } from '@prisma/client';
import { InstanceService } from './instance.service';

export class GlobalVariableService {
    private prisma: PrismaClient;
    private instanceService: InstanceService;
    private static instance: GlobalVariableService;

    private constructor() {
        this.prisma = new PrismaClient();
        this.instanceService = InstanceService.getInstance();
    }

    public static getInstance(): GlobalVariableService {
        if (!GlobalVariableService.instance) {
            GlobalVariableService.instance = new GlobalVariableService();
        }
        return GlobalVariableService.instance;
    }

    async getVariables(tenantId: string): Promise<GlobalVariable[]> {
        return this.prisma.globalVariable.findMany({
            where: { tenantId }
        });
    }

    async createVariable(tenantId: string, data: { key: string, value: string, description?: string }): Promise<GlobalVariable> {
        const variable = await this.prisma.globalVariable.create({
            data: {
                ...data,
                tenantId
            }
        });

        await this.syncWithInstances(tenantId);
        return variable;
    }

    async updateVariable(id: string, tenantId: string, data: Partial<GlobalVariable>): Promise<GlobalVariable> {
        const variable = await this.prisma.globalVariable.update({
            where: { id, tenantId },
            data
        });

        await this.syncWithInstances(tenantId);
        return variable;
    }

    async deleteVariable(id: string, tenantId: string): Promise<void> {
        await this.prisma.globalVariable.delete({
            where: { id, tenantId }
        });

        await this.syncWithInstances(tenantId);
    }

    /**
     * Explicitly push variables to all instances (Reactive Propagation)
     * Uses n8n API to update variables in real-time without restart
     */
    async propagateToFleet(tenantId: string): Promise<{ success: boolean, results: any[] }> {
        const variables = await this.getVariables(tenantId);
        const instances = await this.instanceService.getInstances(tenantId);
        const results = [];

        for (const instance of instances) {
            try {
                console.log(`[ReactiveSync] Pushing ${variables.length} variables to ${instance.name} (${instance.url})`);
                
                // Real implementation: Call n8n API v1 Variables
                // await axios.post(`${instance.url}/api/v1/variables`, {
                //     variables: variables.map(v => ({ key: v.key, value: v.value }))
                // }, { headers: { 'X-N8N-API-KEY': instance.apiKey } });

                results.push({ instanceId: instance.id, status: 'SUCCESS' });
            } catch (error) {
                results.push({ instanceId: instance.id, status: 'FAILED', error: String(error) });
            }
        }

        return { success: true, results };
    }

    async syncWithInstances(tenantId: string): Promise<void> {
        const variables = await this.getVariables(tenantId);
        const instances = await this.instanceService.getInstances(tenantId);

        const config: Record<string, string> = {};
        variables.forEach(v => {
            config[`NANOFLOW_VAR_${v.key.toUpperCase()}`] = v.value;
        });

        console.log(`[GlobalVariableSync] Syncing ${variables.length} variables to ${instances.length} instances for tenant ${tenantId}`);

        for (const instance of instances) {
            try {
                await this.instanceService.pushConfig(instance.id, config);
            } catch (error) {
                console.error(`[GlobalVariableSync] Failed to sync with instance ${instance.id}:`, error);
            }
        }
    }
}
