
import { PrismaClient, Template } from '@prisma/client';

export class TemplateMarketplaceService {
    private prisma: PrismaClient;
    private static instance: TemplateMarketplaceService;

    private constructor() {
        this.prisma = new PrismaClient();
    }

    public static getInstance(): TemplateMarketplaceService {
        if (!TemplateMarketplaceService.instance) {
            TemplateMarketplaceService.instance = new TemplateMarketplaceService();
        }
        return TemplateMarketplaceService.instance;
    }

    async getPublicTemplates(): Promise<Template[]> {
        return this.prisma.template.findMany({
            where: { isPublic: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getTemplateById(id: string): Promise<Template | null> {
        return this.prisma.template.findUnique({
            where: { id }
        });
    }

    async importTemplateToWorkflow(templateId: string, tenantId: string): Promise<any> {
        const template = await this.getTemplateById(templateId);
        if (!template) throw new Error('Template not found');

        // Logic to create a new workflow based on the template
        console.log(`[Marketplace] Importing template "${template.name}" to tenant ${tenantId}`);
        
        // This would typically call WorkflowService.createWorkflow
        return {
            success: true,
            workflowName: `${template.name} (Imported)`,
            nodes: template.nodes,
            connections: template.connections
        };
    }

    async publishTemplate(data: { name: string, description: string, nodes: any, connections: any, isPublic?: boolean }): Promise<Template> {
        return this.prisma.template.create({
            data: {
                ...data,
                isPublic: data.isPublic ?? true
            }
        });
    }

    /**
     * Gap B: SDLC - Blueprints/Templates Globales
     * Deploys a template to multiple n8n instances in the fleet.
     */
    async deployTemplateToFleet(
        templateId: string,
        instanceIds: string[],
        tenantId: string
    ): Promise<any> {
        const template = await this.getTemplateById(templateId);
        if (!template) throw new Error('Template not found');

        console.log(`[Marketplace] Deploying template "${(template.name as any).en}" to fleet of ${instanceIds.length} instances`);

        const instances = await this.prisma.n8nInstance.findMany({
            where: {
                id: { in: instanceIds },
                tenantId
            }
        });

        const results = await Promise.all(instances.map(async (instance) => {
            try {
                const n8nWorkflow = {
                    name: `Template: ${(template.name as any).en}`,
                    nodes: template.nodes,
                    connections: template.connections,
                    settings: { executionOrder: 'v1' }
                };

                const response = await require('./n8n.service').N8nService.pushWorkflow(
                    instance.url,
                    instance.apiKey!,
                    n8nWorkflow
                );

                return { instanceId: instance.id, status: 'SUCCESS', workflowId: response.id };
            } catch (error: any) {
                return { instanceId: instance.id, status: 'FAILED', error: error.message };
            }
        }));

        return results;
    }
}
