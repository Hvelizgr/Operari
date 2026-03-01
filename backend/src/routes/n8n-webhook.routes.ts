import { Router, Request, Response } from 'express';
import { logger } from '../config/logger.config';

const router = Router();

interface N8nWebhookPayload {
    executionId: string;
    workflowId: string;
    status: 'success' | 'error' | 'running' | 'waiting';
    finished: boolean;
    startedAt: string;
    stoppedAt?: string;
    mode: string;
    data?: {
        resultData?: {
            runData?: Record<string, any>;
        };
    };
    error?: {
        message: string;
        stack?: string;
    };
}

interface ExecutionProgressEvent {
    type: 'node_started' | 'node_finished' | 'execution_started' | 'execution_finished' | 'execution_error';
    executionId: string;
    workflowId: string;
    nodeId?: string;
    nodeName?: string;
    status?: string;
    timestamp: string;
    data?: any;
    error?: string;
}

const executionCallbacks = new Map<string, ((event: ExecutionProgressEvent) => void)[]>();

export function subscribeToExecution(executionId: string, callback: (event: ExecutionProgressEvent) => void): () => void {
    if (!executionCallbacks.has(executionId)) {
        executionCallbacks.set(executionId, []);
    }
    executionCallbacks.get(executionId)!.push(callback);
    
    return () => {
        const callbacks = executionCallbacks.get(executionId);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
            if (callbacks.length === 0) {
                executionCallbacks.delete(executionId);
            }
        }
    };
}

function notifySubscribers(executionId: string, event: ExecutionProgressEvent) {
    const callbacks = executionCallbacks.get(executionId);
    if (callbacks) {
        callbacks.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                logger.error({ error, executionId }, 'Error in execution callback');
            }
        });
    }
}

router.post('/execution-started', (req: Request, res: Response) => {
    try {
        const payload: N8nWebhookPayload = req.body;
        
        logger.info({ 
            executionId: payload.executionId, 
            workflowId: payload.workflowId 
        }, 'n8n execution started');

        const event: ExecutionProgressEvent = {
            type: 'execution_started',
            executionId: payload.executionId,
            workflowId: payload.workflowId,
            status: 'running',
            timestamp: new Date().toISOString(),
        };

        notifySubscribers(payload.executionId, event);
        res.json({ success: true, message: 'Execution start received' });
    } catch (error) {
        logger.error({ error }, 'Failed to process execution-started webhook');
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/node-started', (req: Request, res: Response) => {
    try {
        const { executionId, workflowId, nodeId, nodeName } = req.body;
        
        logger.info({ executionId, nodeId, nodeName }, 'n8n node started');

        const event: ExecutionProgressEvent = {
            type: 'node_started',
            executionId,
            workflowId,
            nodeId,
            nodeName,
            status: 'running',
            timestamp: new Date().toISOString(),
        };

        notifySubscribers(executionId, event);
        res.json({ success: true, message: 'Node start received' });
    } catch (error) {
        logger.error({ error }, 'Failed to process node-started webhook');
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/node-finished', (req: Request, res: Response) => {
    try {
        const { executionId, workflowId, nodeId, nodeName, output, error } = req.body;
        
        logger.info({ 
            executionId, 
            nodeId, 
            nodeName, 
            hasError: !!error 
        }, 'n8n node finished');

        const event: ExecutionProgressEvent = {
            type: 'node_finished',
            executionId,
            workflowId,
            nodeId,
            nodeName,
            status: error ? 'error' : 'success',
            timestamp: new Date().toISOString(),
            data: output,
            error: error?.message,
        };

        notifySubscribers(executionId, event);
        res.json({ success: true, message: 'Node finish received' });
    } catch (error) {
        logger.error({ error }, 'Failed to process node-finished webhook');
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/execution-finished', (req: Request, res: Response) => {
    try {
        const payload: N8nWebhookPayload = req.body;
        
        logger.info({ 
            executionId: payload.executionId, 
            workflowId: payload.workflowId,
            status: payload.status 
        }, 'n8n execution finished');

        const event: ExecutionProgressEvent = {
            type: 'execution_finished',
            executionId: payload.executionId,
            workflowId: payload.workflowId,
            status: payload.status,
            timestamp: new Date().toISOString(),
            data: payload.data?.resultData?.runData,
        };

        notifySubscribers(payload.executionId, event);
        
        setTimeout(() => {
            executionCallbacks.delete(payload.executionId);
        }, 60000);

        res.json({ success: true, message: 'Execution finish received' });
    } catch (error) {
        logger.error({ error }, 'Failed to process execution-finished webhook');
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/execution-error', (req: Request, res: Response) => {
    try {
        const payload: N8nWebhookPayload = req.body;
        
        logger.error({ 
            executionId: payload.executionId, 
            workflowId: payload.workflowId,
            error: payload.error 
        }, 'n8n execution error');

        const event: ExecutionProgressEvent = {
            type: 'execution_error',
            executionId: payload.executionId,
            workflowId: payload.workflowId,
            status: 'error',
            timestamp: new Date().toISOString(),
            error: payload.error?.message || 'Unknown error',
        };

        notifySubscribers(payload.executionId, event);
        
        setTimeout(() => {
            executionCallbacks.delete(payload.executionId);
        }, 60000);

        res.json({ success: true, message: 'Execution error received' });
    } catch (error) {
        logger.error({ error }, 'Failed to process execution-error webhook');
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/status/:executionId', (req: Request, res: Response) => {
    const executionId = req.params.executionId as string;
    const hasSubscribers = executionCallbacks.has(executionId);
    
    res.json({
        executionId,
        hasSubscribers,
        subscriberCount: hasSubscribers ? executionCallbacks.get(executionId)!.length : 0,
    });
});

export default router;
