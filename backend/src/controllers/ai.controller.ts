import { Request, Response } from 'express';
import { AIService } from '../services/ai.service';
import { AIFlowOrchestratorService } from '../services/ai/flow-orchestrator.service';
import { thinkingProcessService } from '../services/ai/thinking-process.service';

export class AIController {
    static async generate(req: Request, res: Response) {
        try {
            const { prompt, sessionId } = req.body;
            if (!prompt) {
                res.status(400).json({ error: 'Prompt is required' });
                return;
            }

            if (sessionId) {
                await thinkingProcessService.addStep(sessionId, {
                    title: 'Analyzing Prompt',
                    content: `Starting generation for: ${prompt.substring(0, 50)}...`,
                    type: 'reasoning'
                });
            }

            const result = await AIService.generateWorkflow(prompt);

            if (sessionId) {
                await thinkingProcessService.addStep(sessionId, {
                    title: 'Workflow Generated',
                    content: result.explanation,
                    type: 'observation',
                    metadata: { nodeCount: result.nodes.length }
                });
            }

            res.json(result);
        } catch (error: any) {
            console.error('AI Controller Error:', error);
            res.status(500).json({ error: 'Failed to process AI request' });
        }
    }

    static async generateAndDeploy(req: Request, res: Response) {
        try {
            const { prompt, instanceId } = req.body;
            const tenantId = (req as any).user.tenantId;

            if (!prompt || !instanceId) {
                res.status(400).json({ error: 'Prompt and instanceId are required' });
                return;
            }

            const result = await AIFlowOrchestratorService.generateAndDeploy(prompt, instanceId, tenantId);
            res.json(result);
        } catch (error: any) {
            console.error('AI Controller Error:', error);
            res.status(500).json({ error: error.message || 'Failed to generate and deploy workflow' });
        }
    }

    static async getThinkingProcess(req: Request, res: Response) {
        try {
            const sessionId = req.params.sessionId as string;
            const process = await thinkingProcessService.getProcess(sessionId);
            res.json(process);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get thinking process' });
        }
    }

    static async clearThinkingProcess(req: Request, res: Response) {
        try {
            const sessionId = req.params.sessionId as string;
            await thinkingProcessService.clearProcess(sessionId);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to clear thinking process' });
        }
    }

    static async suggestConfig(req: Request, res: Response) {
        try {
            const { node, workflowContext, lang } = req.body;
            if (!node || !workflowContext) {
                res.status(400).json({ error: 'Node and workflowContext are required' });
                return;
            }

            const result = await AIService.suggestNodeConfig(node, workflowContext, lang);
            res.json(result);
        } catch (error: any) {
            console.error('AI Suggest Config Error:', error);
            res.status(500).json({ error: 'Failed to suggest configuration' });
        }
    }

    static async debugWorkflow(req: Request, res: Response) {
        try {
            const { question, context, lang } = req.body;
            if (!question || !context) {
                res.status(400).json({ error: 'Question and context are required' });
                return;
            }

            const result = await AIService.debugWorkflow(question, context, lang);
            res.json(result);
        } catch (error: any) {
            console.error('AI Debug Workflow Error:', error);
            res.status(500).json({ error: 'Failed to debug workflow' });
        }
    }

    static async askAboutNode(req: Request, res: Response) {
        try {
            const { question, node, nodeLog, lang } = req.body;
            if (!question || !node) {
                res.status(400).json({ error: 'Question and node are required' });
                return;
            }

            const result = await AIService.askAboutNode(question, node, nodeLog, lang);
            res.json(result);
        } catch (error: any) {
            console.error('AI Ask About Node Error:', error);
            res.status(500).json({ error: 'Failed to answer question about node' });
        }
    }

    static async explainError(req: Request, res: Response) {
        try {
            const { errorMessage, context, lang } = req.body;
            if (!errorMessage) {
                res.status(400).json({ error: 'Error message is required' });
                return;
            }

            const result = await AIService.explainError(errorMessage, context || {}, lang);
            res.json(result);
        } catch (error: any) {
            console.error('AI Explain Error Error:', error);
            res.status(500).json({ error: 'Failed to explain error' });
        }
    }

    static async suggestNextNode(req: Request, res: Response) {
        try {
            const { nodes, connections, lastNodeId, lang } = req.body;
            if (!nodes || !connections) {
                res.status(400).json({ error: 'Nodes and connections are required' });
                return;
            }

            const result = await AIService.suggestNextNode(nodes, connections, lastNodeId, lang);
            res.json(result);
        } catch (error: any) {
            console.error('AI Suggest Next Node Error:', error);
            res.status(500).json({ error: 'Failed to suggest next node' });
        }
    }

    static async generateDocumentation(req: Request, res: Response) {
        try {
            const { nodes, connections, lang } = req.body;
            if (!nodes || !connections) {
                res.status(400).json({ error: 'Nodes and connections are required' });
                return;
            }

            const result = await AIService.generateDocumentation(nodes, connections, lang);
            res.json(result);
        } catch (error: any) {
            console.error('AI Generate Documentation Error:', error);
            res.status(500).json({ error: 'Failed to generate documentation' });
        }
    }

    static async predictFailures(req: Request, res: Response) {
        try {
            const { nodes, connections, lang } = req.body;
            if (!nodes || !connections) {
                res.status(400).json({ error: 'Nodes and connections are required' });
                return;
            }

            const result = await AIService.predictPotentialFailures(nodes, connections, lang);
            res.json(result);
        } catch (error: any) {
            console.error('AI Predict Failures Error:', error);
            res.status(500).json({ error: 'Failed to predict failures' });
        }
    }

    static async suggestOptimizations(req: Request, res: Response) {
        try {
            const { nodes, connections, lang } = req.body;
            if (!nodes || !connections) {
                res.status(400).json({ error: 'Nodes and connections are required' });
                return;
            }

            const result = await AIService.suggestOptimizations(nodes, connections, lang);
            res.json(result);
        } catch (error: any) {
            console.error('AI Suggest Optimizations Error:', error);
            res.status(500).json({ error: 'Failed to suggest optimizations' });
        }
    }
}
