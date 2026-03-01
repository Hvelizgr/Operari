import { SLAStatus } from '@prisma/client';
import { logger } from './logger.service';
import { NotificationService, NotificationPriority, NotificationChannel } from './notification.service';
import { prisma } from '../server';
const notificationService = NotificationService.getInstance();

export class SLAService {
  /**
   * Create or update an SLA definition
   */
  async upsertSLA(data: {
    tenantId: string;
    workflowId?: string;
    name: string;
    description?: string;
    maxDuration?: number;
    minSuccessRate?: number;
    alertOnBreach?: boolean;
  }) {
    try {
      const sla = await prisma.sLADefinition.upsert({
        where: {
          workflowId: data.workflowId || 'global', // Using 'global' as a dummy for non-workflow SLAs if needed, or handle differently
        },
        update: {
          name: data.name,
          description: data.description,
          maxDuration: data.maxDuration,
          minSuccessRate: data.minSuccessRate,
          alertOnBreach: data.alertOnBreach ?? true,
        },
        create: {
          tenantId: data.tenantId,
          workflowId: data.workflowId,
          name: data.name,
          description: data.description,
          maxDuration: data.maxDuration,
          minSuccessRate: data.minSuccessRate,
          alertOnBreach: data.alertOnBreach ?? true,
        },
      });
      return sla;
    } catch (error) {
      logger.error('Error upserting SLA:', { error: error as Error });
      throw error;
    }
  }

  /**
   * Get SLA for a specific workflow
   */
  async getSLAByWorkflow(workflowId: string) {
    return prisma.sLADefinition.findUnique({
      where: { workflowId },
    });
  }

  /**
   * Check compliance for a specific execution
   */
  async checkExecutionCompliance(executionId: string) {
    try {
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
        include: {
          workflow: {
            include: {
              slaDefinition: true,
            },
          },
        },
      });

      if (!execution || !execution.workflow.slaDefinition) {
        return;
      }

      const sla = execution.workflow.slaDefinition;
      const breaches: { type: string; actual: number; threshold: number }[] = [];

      // Check duration
      if (sla.maxDuration && execution.duration && execution.duration > sla.maxDuration) {
        breaches.push({
          type: 'DURATION',
          actual: execution.duration,
          threshold: sla.maxDuration,
        });
      }

      // Check status (minSuccessRate is usually calculated over time, but we can log a breach if this one failed)
      if (execution.status === 'FAILED') {
        // Technically a single failure doesn't mean success rate SLA is breached, 
        // but we can track it as an ERROR breach for this execution context.
        breaches.push({
          type: 'ERROR',
          actual: 0,
          threshold: 1,
        });
      }

      if (breaches.length > 0) {
        for (const breach of breaches) {
          await prisma.sLACompliance.create({
            data: {
              slaId: sla.id,
              executionId: execution.id,
              status: SLAStatus.BREACHED,
              breachType: breach.type,
              actualValue: breach.actual,
              thresholdValue: breach.threshold,
            },
          });

          if (sla.alertOnBreach) {
            await this.notifySLABreach(sla, execution, breach);
          }
        }
      } else {
        await prisma.sLACompliance.create({
          data: {
            slaId: sla.id,
            executionId: execution.id,
            status: SLAStatus.COMPLIANT,
            actualValue: execution.duration || 0,
            thresholdValue: sla.maxDuration || 0,
          },
        });
      }
    } catch (error) {
      logger.error('Error checking SLA compliance:', { error: error as Error });
    }
  }

  private async notifySLABreach(sla: any, execution: any, breach: any) {
    const message = `SLA '${sla.name}' breached for workflow '${execution.workflow.name}'. Breach Type: ${breach.type}. Actual: ${breach.actual}, Threshold: ${breach.threshold}`;
    
    await notificationService.send({
      tenantId: sla.tenantId,
      title: 'SLA Breach Detected',
      message,
      priority: NotificationPriority.HIGH,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      metadata: {
        slaId: sla.id,
        workflowId: execution.workflowId,
        executionId: execution.id,
        breachType: breach.type,
      },
    });
  }

  /**
   * Get compliance report for a tenant
   */
  async getTenantComplianceReport(tenantId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const compliance = await prisma.sLACompliance.findMany({
      where: {
        sla: {
          tenantId,
        },
        timestamp: {
          gte: startDate,
        },
      },
      include: {
        sla: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return compliance;
  }
}
