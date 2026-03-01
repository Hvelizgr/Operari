import { PrismaClient, N8nInstance, EnvironmentType } from '@prisma/client';
import { n8nService } from './n8n.service';

export class EnvironmentService {
    private prisma: PrismaClient;
    private static instance: EnvironmentService;

    private constructor() {
        this.prisma = new PrismaClient();
    }

    public static getInstance(): EnvironmentService {
        if (!EnvironmentService.instance) {
            EnvironmentService.instance = new EnvironmentService();
        }
        return EnvironmentService.instance;
    }

    async setInstanceEnvironment(instanceId: string, environment: EnvironmentType): Promise<N8nInstance> {
        return this.prisma.n8nInstance.update({
            where: { id: instanceId },
            data: { environment }
        });
    }

    async getInstancesByEnvironment(tenantId: string, environment: EnvironmentType): Promise<N8nInstance[]> {
        return this.prisma.n8nInstance.findMany({
            where: { tenantId, environment }
        });
    }

    /**
     * Promotes a workflow from one environment to another.
     * Logic:
     * 1. Get workflow from source instance.
     * 2. Replace credentials/variables for target environment.
     * 3. Push to target instance.
     */
    async promoteWorkflow(
        workflowId: string,
        sourceInstanceId: string,
        targetInstanceId: string,
        tenantId: string
    ): Promise<any> {
        console.log(`[EnvironmentService] Promoting workflow ${workflowId} from ${sourceInstanceId} to ${targetInstanceId}`);

        const sourceInstance = await this.prisma.n8nInstance.findUnique({ where: { id: sourceInstanceId } });
        const targetInstance = await this.prisma.n8nInstance.findUnique({ where: { id: targetInstanceId } });

        if (!sourceInstance || !targetInstance) {
            throw new Error('Source or Target instance not found');
        }

        // 1. Get workflow JSON from source
        const workflowJson = await n8nService.getWorkflow(workflowId);

        // 2. Transformation Logic (Gap B: SDLC)
        // Here we would rewrite credentials IDs based on target environment mappings
        const transformedWorkflow = await this.transformWorkflowForEnvironment(
            workflowJson,
            sourceInstance.environment,
            targetInstance.environment,
            tenantId
        );

        // 3. Push to target
        return n8nService.createWorkflow(transformedWorkflow);
    }

    private async transformWorkflowForEnvironment(
        workflow: any,
        sourceEnv: EnvironmentType,
        targetEnv: EnvironmentType,
        _tenantId: string
    ): Promise<any> {
        // Simple placeholder for transformation logic
        // In a real scenario, we would lookup credentials in the target environment
        // that match the "Name" or "Type" of the source credentials.
        
        console.log(`[EnvironmentService] Transforming workflow from ${sourceEnv} to ${targetEnv}`);
        
        const transformedNodes = workflow.nodes.map((node: any) => {
            if (node.credentials) {
                // Here we would perform the mapping logic
                // For now, we just log it
                console.log(`[EnvironmentService] Mapping credentials for node ${node.name}`);
            }
            return node;
        });

        return {
            ...workflow,
            nodes: transformedNodes
        };
    }
}
