import { AIService, AIGenerationResult } from '../ai.service';
import { n8nService } from '../n8n.service';
import { InstanceService } from '../instance.service';

export class AIFlowOrchestratorService {
    /**
     * Completes Phase 3: Item 2 of Strategic Analysis.
     * Takes a natural language prompt, generates n8n JSON via LLM,
     * and deploys it to the specified instance.
     */
    static async generateAndDeploy(
        prompt: string,
        instanceId: string,
        _tenantId: string
    ): Promise<{ workflowId: string; explanation: string }> {
        console.log(`[AIFlowOrchestrator] Generating workflow for prompt: "${prompt}" on instance ${instanceId}`);

        // 1. Generate Workflow JSON via LLM
        const aiResult: AIGenerationResult = await AIService.generateWorkflow(prompt);

        // 2. Get instance details
        const instanceService = InstanceService.getInstance();
        const instance = await instanceService.getInstanceById(instanceId);
        if (!instance) throw new Error('Target instance not found');

        // 3. Format for n8n API
        const n8nWorkflow = {
            name: `AI: ${prompt.substring(0, 30)}...`,
            nodes: aiResult.nodes,
            connections: this.mapConnections(aiResult.connections),
            settings: {
                executionOrder: 'v1'
            }
        };

        // 4. Push to n8n - Use createWorkflow method from n8nService
        const response = await n8nService.createWorkflow(n8nWorkflow as any);

        return {
            workflowId: response.id || 'unknown',
            explanation: aiResult.explanation
        };
    }

    private static mapConnections(connections: any[]): any {
        const mapped: any = {};
        connections.forEach(conn => {
            if (!mapped[conn.source]) mapped[conn.source] = { main: [[]] };
            mapped[conn.source].main[0].push({
                node: conn.target,
                type: 'main',
                index: conn.sourcePort || 0
            });
        });
        return mapped;
    }
}
