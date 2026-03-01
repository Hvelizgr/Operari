
import { Request, Response } from 'express';
import { n8nService } from '../services/n8n.service';
import { WorkflowValidatorService, ValidationSeverity } from '../services/workflow-validator.service';
import { logger } from '../config/logger.config';
import { ssoService } from '../services/sso.service';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';

const validator = new WorkflowValidatorService();

export class N8nController {
    
    /**
     * Generate a seamless login URL for an n8n instance (Admin Impersonation)
     */
    async getImpersonationUrl(req: AuthRequest, res: Response) {
        try {
            const instanceId = req.params.id as string;
            const user = req.user;

            if (user?.role !== 'ADMIN') {
                return res.status(403).json({ error: 'Only admins can impersonate instances' });
            }

            const instance = await prisma.n8nInstance.findUnique({
                where: { id: instanceId, tenantId: user.tenantId }
            });

            if (!instance) {
                return res.status(404).json({ error: 'Instance not found' });
            }

            const token = ssoService.generateImpersonationToken(user, instanceId);
            
            // In a real scenario, the instance URL would have a special endpoint 
            // handled by a NanoFlow proxy or plugin that accepts this token.
            const impersonationUrl = `${instance.url}/auth/nanoflow-sso?token=${token}&redirect=/`;

            res.json({ url: impersonationUrl });
        } catch (error) {
            logger.error({ error }, 'Failed to generate impersonation URL');
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    // Check connection health
    async checkHealth(req: Request, res: Response) {
        try {
            const isAlive = await n8nService.healthCheck();
            res.json({ 
                connected: isAlive,
                status: isAlive ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error({ error }, 'Health check failed');
            res.status(500).json({ connected: false, error: 'Failed to check n8n health' });
        }
    }

    // List external workflows
    async getWorkflows(req: Request, res: Response) {
        try {
            const workflows = await n8nService.getWorkflows();
            res.json({ data: workflows });
        } catch (error) {
            logger.error({ error }, 'Failed to get workflows');
            res.status(500).json({ error: 'Failed to fetch workflows from n8n' });
        }
    }

    // Get single workflow by ID
    async getWorkflow(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const workflow = await n8nService.getWorkflow(id);
            res.json({ data: workflow });
        } catch (error) {
            logger.error({ error }, 'Failed to get workflow');
            res.status(500).json({ error: 'Failed to fetch workflow from n8n' });
        }
    }

    // Export NanoFlow workflow to n8n
    async exportWorkflow(req: Request, res: Response) {
        try {
            const { name, nodes, connections, active } = req.body;
            
            if (!nodes || !Array.isArray(nodes)) {
                return res.status(400).json({ success: false, error: 'Invalid nodes data' });
            }

            // Transform NanoFlow format to n8n format
            const n8nNodes = nodes.map((node: any, index: number) => {
                const position = node.position || { x: 250 + (index * 200), y: 300 };
                return {
                    id: node.id || `node-${index}`,
                    name: node.title || node.name || `Node ${index}`,
                    type: node.type?.startsWith('n8n-nodes-base.') ? node.type : `n8n-nodes-base.${node.type || 'noOp'}`,
                    position: [position.x || 250, position.y || 300],
                    parameters: node.config || node.parameters || {},
                    typeVersion: 1,
                };
            });

            // Transform connections from NanoFlow array format to n8n object format
            const n8nConnections: Record<string, any> = {};
            
            if (Array.isArray(connections)) {
                connections.forEach((conn: any) => {
                    const sourceNode = nodes.find((n: any) => n.id === conn.source);
                    const targetNode = nodes.find((n: any) => n.id === conn.target);
                    
                    if (sourceNode && targetNode) {
                        const sourceName = sourceNode.title || sourceNode.name || `Node`;
                        const targetName = targetNode.title || targetNode.name || `Node`;
                        
                        if (!n8nConnections[sourceName]) {
                            n8nConnections[sourceName] = { main: [[]] };
                        }
                        
                        n8nConnections[sourceName].main[0].push({
                            node: targetName,
                            type: 'main',
                            index: 0,
                        });
                    }
                });
            }

            const n8nWorkflow = {
                name: name || `NanoFlow Export ${new Date().toISOString()}`,
                nodes: n8nNodes,
                connections: n8nConnections,
                active: active || false,
                settings: {
                    saveExecutionProgress: true,
                    saveManualExecutions: true,
                },
            };

            const createdWorkflow = await n8nService.createWorkflow(n8nWorkflow as any);
            
            res.json({ 
                success: true, 
                data: { 
                    id: createdWorkflow.id, 
                    name: createdWorkflow.name 
                } 
            });
        } catch (error) {
            logger.error({ error }, 'Failed to export workflow to n8n');
            res.status(500).json({ success: false, error: 'Failed to export workflow to n8n' });
        }
    }

    // Get credentials from n8n
    async getCredentials(req: Request, res: Response) {
        try {
            const credentials = await n8nService.getCredentials();
            res.json({ data: credentials });
        } catch (error) {
            logger.error({ error }, 'Failed to get credentials');
            res.status(500).json({ error: 'Failed to fetch credentials from n8n' });
        }
    }

    // Create credential in n8n
    async createCredential(req: Request, res: Response) {
        try {
            const { name, type, data } = req.body;
            
            if (!name || !type) {
                return res.status(400).json({ error: 'Name and type are required' });
            }

            const credential = await n8nService.createCredential({ name, type, data: data || {} });
            res.json({ success: true, data: credential });
        } catch (error) {
            logger.error({ error }, 'Failed to create credential');
            res.status(500).json({ error: 'Failed to create credential in n8n' });
        }
    }

    // Run Static Analysis (The "Workflow Doctor")
    async analyzeWorkflow(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const workflowId = Array.isArray(id) ? id[0] : id;
            const workflow = await n8nService.getWorkflow(workflowId);
            
            const convertedConnections: any[] = [];
            Object.keys(workflow.connections).forEach(sourceNode => {
                const outputs = workflow.connections[sourceNode] as any;
                if (outputs.main) {
                   outputs.main.forEach((outputChannel: any[]) => {
                       outputChannel.forEach((connection: any) => {
                           convertedConnections.push({
                               source: sourceNode,
                               target: connection.node
                           });
                       });
                   });
                }
            });

            const validationResult = validator.validate({
                name: workflow.name,
                nodes: workflow.nodes as any,
                connections: convertedConnections as any
            });

            if (validationResult.isValid) {
                 validationResult.issues.push({
                     severity: ValidationSeverity.INFO,
                     message: "✨ AI Tip: This workflow could be optimized by using a Merge node before the final output."
                 });
            }

            res.json(validationResult);

        } catch (error) {
            logger.error({ error }, 'Analysis failed');
             res.status(500).json({ error: 'Failed to analyze workflow' });
        }
    }
}

export const n8nController = new N8nController();
