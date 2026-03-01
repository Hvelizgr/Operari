import { Response, NextFunction } from 'express';
import { metricService, MetricFilter } from '../services/metric.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class MetricController {
    async getMetrics(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tenantId = req.user?.tenantId || 'default-tenant';

            const { workflowId, nodeId, metricName, from, to, limit } = req.query;

            const filter: MetricFilter = {
                tenantId: tenantId,
                workflowId: workflowId as string,
                nodeId: nodeId as string,
                metricName: metricName as string,
                from: from ? new Date(from as string) : undefined,
                to: to ? new Date(to as string) : undefined,
                limit: limit ? parseInt(limit as string) : 100
            };

            const metrics = await metricService.getMetrics(filter);
            res.json(metrics);
        } catch (error) {
            next(error);
        }
    }

    async getStats(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const tenantId = req.user?.tenantId || 'default-tenant';

            const { workflowId, nodeId, metricName, from, to } = req.query;

            const filter: MetricFilter = {
                tenantId: tenantId,
                workflowId: workflowId as string,
                nodeId: nodeId as string,
                metricName: metricName as string,
                from: from ? new Date(from as string) : undefined,
                to: to ? new Date(to as string) : undefined
            };

            const stats = await metricService.getAggregatedMetrics(filter);
            res.json(stats);
        } catch (error) {
            next(error);
        }
    }
}

export const metricController = new MetricController();
