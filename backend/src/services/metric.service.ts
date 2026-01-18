import { prisma } from '../config/database';
import { CustomError, ErrorCode } from '../errors/custom-error';

export interface MetricData {
    tenantId: string;
    nodeId?: string;
    workflowId?: string;
    metricName: string;
    value: number;
    unit?: string;
    tags?: Record<string, any>;
    timestamp?: Date;
}

export interface MetricFilter {
    tenantId: string;
    workflowId?: string;
    nodeId?: string;
    metricName?: string;
    from?: Date;
    to?: Date;
    limit?: number;
}

export class MetricService {
    
    async recordMetric(data: MetricData): Promise<void> {
        try {
            await prisma.metric.create({
                data: {
                    tenantId: data.tenantId,
                    nodeId: data.nodeId,
                    workflowId: data.workflowId,
                    metricName: data.metricName,
                    value: data.value,
                    unit: data.unit,
                    tags: data.tags || {},
                    timestamp: data.timestamp || new Date()
                }
            });
        } catch (error) {
            console.error('Failed to record metric:', error);
        }
    }

    async getMetrics(filter: MetricFilter) {
        try {
            const where: any = {
                tenantId: filter.tenantId
            };
            
            if (filter.workflowId) where.workflowId = filter.workflowId;
            if (filter.nodeId) where.nodeId = filter.nodeId;
            if (filter.metricName) where.metricName = filter.metricName;
            
            if (filter.from || filter.to) {
                where.timestamp = {};
                if (filter.from) where.timestamp.gte = filter.from;
                if (filter.to) where.timestamp.lte = filter.to;
            }

            return await prisma.metric.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                take: filter.limit || 100
            });
        } catch (error) {
            throw new CustomError({
                message: 'Failed to retrieve metrics',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }

    /**
     * Get aggregated stats (avg, min, max) for a time range
     */
    async getAggregatedMetrics(filter: MetricFilter) {
        try {
            const where: any = {
                tenantId: filter.tenantId
            };
            
            if (filter.workflowId) where.workflowId = filter.workflowId;
            if (filter.nodeId) where.nodeId = filter.nodeId;
            if (filter.metricName) where.metricName = filter.metricName;
            
            if (filter.from || filter.to) {
                where.timestamp = {};
                if (filter.from) where.timestamp.gte = filter.from;
                if (filter.to) where.timestamp.lte = filter.to;
            }

            return await prisma.metric.aggregate({
                where,
                _avg: { value: true },
                _min: { value: true },
                _max: { value: true },
                _count: { value: true }
            });
        } catch (error) {
             throw new CustomError({
                message: 'Failed to aggregate metrics',
                code: ErrorCode.UNKNOWN_ERROR,
                cause: error as Error
            });
        }
    }
}

export const metricService = new MetricService();
