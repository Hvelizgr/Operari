import { EventEmitter } from 'events';

export interface HumanStepRequest {
    id: string;
    workflowId: string;
    executionId: string;
    nodeId: string;
    type: 'approval' | 'input' | 'correction';
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
    payload: any;
    result?: any;
    requestedAt: Date;
    resolvedAt?: Date;
    expiresAt?: Date;
    metadata?: Record<string, any>;
}

export class HumanLoopService {
    private static eventEmitter = new EventEmitter();

    static async createStep(data: Omit<HumanStepRequest, 'id' | 'status' | 'requestedAt'>): Promise<HumanStepRequest> {
        // In a real implementation, this would save to a new table in DB
        // For now, we simulate with a generic metadata/execution log or a mock if table doesn't exist
        // Assuming we might need a migration, but I'll create the service logic first
        
        console.log(`[HumanLoop] Requesting human intervention for execution ${data.executionId} at node ${data.nodeId}`);
        
        const step: HumanStepRequest = {
            id: Math.random().toString(36).substring(7),
            ...data,
            status: 'PENDING',
            requestedAt: new Date(),
        };

        // Notify via EventEmitter so socket.io or other services can push to UI
        this.eventEmitter.emit('step_created', step);
        
        return step;
    }

    static async resolveStep(stepId: string, status: 'APPROVED' | 'REJECTED' | 'COMPLETED', result?: any): Promise<void> {
        console.log(`[HumanLoop] Step ${stepId} resolved with status ${status}`);
        
        this.eventEmitter.emit('step_resolved', { stepId, status, result });
        
        // Here we would resume the workflow execution in BullMQ or n8n
    }

    static onStepCreated(callback: (step: HumanStepRequest) => void) {
        this.eventEmitter.on('step_created', callback);
    }

    static onStepResolved(callback: (data: { stepId: string; status: string; result?: any }) => void) {
        this.eventEmitter.on('step_resolved', callback);
    }
}
