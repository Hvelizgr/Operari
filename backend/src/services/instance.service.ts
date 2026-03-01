
import { PrismaClient, N8nInstance } from '@prisma/client';
import axios from 'axios';

export class InstanceService {
    private prisma: PrismaClient;
    private static instance: InstanceService;

    private constructor() {
        this.prisma = new PrismaClient();
    }

    public static getInstance(): InstanceService {
        if (!InstanceService.instance) {
            InstanceService.instance = new InstanceService();
        }
        return InstanceService.instance;
    }

    async getInstances(tenantId: string): Promise<N8nInstance[]> {
        return this.prisma.n8nInstance.findMany({
            where: { tenantId }
        });
    }

    async getInstanceById(instanceId: string): Promise<N8nInstance | null> {
        return this.prisma.n8nInstance.findUnique({
            where: { id: instanceId }
        });
    }

    async listAllInstances(): Promise<N8nInstance[]> {
        return this.prisma.n8nInstance.findMany();
    }

    async createInstance(tenantId: string, data: { name: string, url: string, apiKey?: string }): Promise<N8nInstance> {
        return this.prisma.n8nInstance.create({
            data: {
                ...data,
                tenantId,
                status: 'UNKNOWN'
            }
        });
    }

    async updateInstance(id: string, data: Partial<N8nInstance>): Promise<N8nInstance> {
        return this.prisma.n8nInstance.update({
            where: { id },
            data
        });
    }

    async deleteInstance(id: string): Promise<void> {
        await this.prisma.n8nInstance.delete({
            where: { id }
        });
    }

    async refreshInstanceStatus(id: string): Promise<N8nInstance> {
        const instance = await this.prisma.n8nInstance.findUnique({ where: { id } });
        if (!instance) throw new Error('Instance not found');

        try {
            // Real-world implementation would call n8n API health endpoint
            const response = await axios.get(`${instance.url}/healthz`, { timeout: 5000 });
            
            // Mocking some stats for the demo if n8n doesn't provide them directly in healthz
            const status = response.status === 200 ? 'ONLINE' : 'ERROR';
            
            return this.updateInstance(id, {
                status,
                cpuUsage: Math.random() * 30, // Mocked
                ramUsage: 200 + Math.random() * 500, // Mocked in MB
                version: '1.24.0' // Mocked
            });
        } catch (error) {
            return this.updateInstance(id, {
                status: 'OFFLINE',
                cpuUsage: 0,
                ramUsage: 0
            });
        }
    }

    async provisionInstance(tenantId: string, name: string, _config: any): Promise<N8nInstance> {
        // En un entorno real, esto llamaría a un Helm chart o Terraform
        // Aquí simulamos el provisioning
        console.log(`[Provisioning] Creating new n8n worker for tenant ${tenantId} with name ${name}`);
        
        const instance = await this.createInstance(tenantId, {
            name,
            url: `http://n8n-${name.toLowerCase().replace(/\s+/g, '-')}.internal:5678`,
            apiKey: 'mock-provisioned-key'
        });

        await this.updateInstance(instance.id, { status: 'PROVISIONING' });

        // Simulamos retardo de despliegue
        setTimeout(async () => {
            await this.updateInstance(instance.id, { status: 'ONLINE' });
        }, 5000);

        return instance;
    }

    async pushConfig(id: string, config: Record<string, string>): Promise<void> {
        const instance = await this.prisma.n8nInstance.findUnique({ where: { id } });
        if (!instance) throw new Error('Instance not found');

        console.log(`[RemoteConfig] Pushing env vars to ${instance.name}:`, config);
        // Implementación real: API call o actualización de K8s ConfigMap
        await this.updateInstance(id, {
            status: 'RESTARTING'
        });

        setTimeout(async () => {
            await this.updateInstance(id, { status: 'ONLINE' });
        }, 3000);
    }
}
