import { prisma } from '../server';

export class ReportingService {
  /**
   * Get overall execution statistics for a tenant
   */
  async getExecutionStats(tenantId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await prisma.execution.groupBy({
      by: ['status'],
      where: {
        workflow: { tenantId },
        startedAt: { gte: startDate },
      },
      _count: {
        _all: true,
      },
    });

    return stats.reduce((acc: any, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    }, { SUCCESS: 0, FAILED: 0, RUNNING: 0, PENDING: 0, CANCELLED: 0 });
  }

  /**
   * Get SLA compliance summary
   */
  async getSLASummary(tenantId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const compliance = await prisma.sLACompliance.groupBy({
      by: ['status'],
      where: {
        sla: { tenantId },
        timestamp: { gte: startDate },
      },
      _count: {
        _all: true,
      },
    });

    const result = compliance.reduce((acc: any, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    }, { COMPLIANT: 0, BREACHED: 0 });

    const total = result.COMPLIANT + result.BREACHED;
    const rate = total > 0 ? (result.COMPLIANT / total) * 100 : 100;

    return {
      ...result,
      total,
      complianceRate: parseFloat(rate.toFixed(2)),
    };
  }

  /**
   * Get average duration over time (daily)
   */
  async getDurationTrends(tenantId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Using raw query for easier date grouping if needed, 
    // but Prisma can also do it via findMany and manual grouping if SQLite/Postgres compatibility is a concern.
    // Let's use findMany for better type safety.
    const executions = await prisma.execution.findMany({
      where: {
        workflow: { tenantId },
        startedAt: { gte: startDate },
        status: 'SUCCESS',
        duration: { not: null },
      },
      select: {
        startedAt: true,
        duration: true,
      },
    });

    const grouped = executions.reduce((acc: any, curr) => {
      const date = curr.startedAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { sum: 0, count: 0 };
      }
      acc[date].sum += curr.duration || 0;
      acc[date].count += 1;
      return acc;
    }, {});

    return Object.keys(grouped).map(date => ({
      date,
      avgDuration: parseFloat((grouped[date].sum / grouped[date].count).toFixed(2)),
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get top workflows by execution count
   */
  async getTopWorkflows(tenantId: string, days = 7, limit = 5) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const topWorkflows = await prisma.execution.groupBy({
      by: ['workflowId'],
      where: {
        workflow: { tenantId },
        startedAt: { gte: startDate },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          workflowId: 'desc',
        },
      },
      take: limit,
    });

    // Enhance with workflow names
    const workflowIds = topWorkflows.map(w => w.workflowId);
    const workflows = await prisma.workflow.findMany({
      where: { id: { in: workflowIds } },
      select: { id: true, name: true },
    });

    return topWorkflows.map(w => ({
      workflowId: w.workflowId,
      name: workflows.find(wf => wf.id === w.workflowId)?.name || 'Unknown',
      count: w._count._all,
    }));
  }

  /**
   * Get detailed SLA breaches
   */
  async getRecentBreaches(tenantId: string, limit = 10) {
    return prisma.sLACompliance.findMany({
      where: {
        sla: { tenantId },
        status: 'BREACHED',
      },
      include: {
        sla: {
          select: {
            name: true,
            workflow: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
