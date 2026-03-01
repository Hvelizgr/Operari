import { InstanceService } from './instance.service';

export interface SyncResult {
    instanceId: string;
    status: 'SUCCESS' | 'FAILED';
    syncedWorkflows: string[];
    errors?: string[];
}

export class WorkflowSyncService {
    static async syncToInstance(
        sourceWorkflow: any,
        targetInstanceId: string
    ): Promise<SyncResult> {
        console.log(`[WorkflowSync] Syncing workflow ${sourceWorkflow.id} to instance ${targetInstanceId}`);

        try {
            const instanceService = InstanceService.getInstance();
            const instance = await instanceService.getInstanceById(targetInstanceId);
            if (!instance) throw new Error('Instance not found');

            // Simulate pushing workflow via n8n API
            // await n8nService.pushWorkflow(instance.apiUrl, instance.apiKey, sourceWorkflow);

            return {
                instanceId: targetInstanceId,
                status: 'SUCCESS',
                syncedWorkflows: [sourceWorkflow.id]
            };
        } catch (error: any) {
            return {
                instanceId: targetInstanceId,
                status: 'FAILED',
                syncedWorkflows: [],
                errors: [error.message]
            };
        }
    }

    static async broadcastSync(workflow: any, _tags: string[]): Promise<SyncResult[]> {
        // Find all instances and sync (tags filtering would require schema update)
        const instanceService = InstanceService.getInstance();
        const instances = await instanceService.listAllInstances();
        const results: SyncResult[] = [];

        for (const instance of instances) {
            // TODO: Add tags field to N8nInstance model for proper filtering
            results.push(await this.syncToInstance(workflow, instance.id));
        }

        return results;
    }
}
