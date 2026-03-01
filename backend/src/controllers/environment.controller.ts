import { Request, Response } from 'express';
import { EnvironmentService } from '../services/environment.service';
import { EnvironmentType } from '@prisma/client';

export class EnvironmentController {
    static async setEnvironment(req: Request, res: Response) {
        try {
            const { instanceId, environment } = req.body;
            if (!instanceId || !environment) {
                return res.status(400).json({ error: 'instanceId and environment are required' });
            }

            const result = await EnvironmentService.getInstance().setInstanceEnvironment(
                instanceId,
                environment as EnvironmentType
            );
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async promoteWorkflow(req: Request, res: Response) {
        try {
            const { workflowId, sourceInstanceId, targetInstanceId } = req.body;
            const tenantId = (req as any).user.tenantId;

            if (!workflowId || !sourceInstanceId || !targetInstanceId) {
                return res.status(400).json({ error: 'workflowId, sourceInstanceId and targetInstanceId are required' });
            }

            const result = await EnvironmentService.getInstance().promoteWorkflow(
                workflowId,
                sourceInstanceId,
                targetInstanceId,
                tenantId
            );
            res.json({ success: true, result });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getByEnvironment(req: Request, res: Response) {
        try {
            const { env } = req.params;
            const tenantId = (req as any).user.tenantId;

            const result = await EnvironmentService.getInstance().getInstancesByEnvironment(
                tenantId,
                env as EnvironmentType
            );
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}
