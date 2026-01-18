import * as os from 'os';
import { ExecutionInput, NodeExecutionResult } from '../../types/workflow.types';
import { NodeExecutionError, ErrorCode, ErrorSeverity } from '../../errors/custom-error';
import { exec } from 'child_process';
import { promisify } from 'util';
import { metricService } from '../../services/metric.service'; // Import MetricService

const execAsync = promisify(exec);

// --- interfaces ---

export interface DiskUsageConfig {
    path?: string; // Default to root '/'
    thresholdPercent?: number; // Optional check
}

export interface CpuMonitorConfig {
    sampleTimeMs?: number; // Time to measure CPU load if needed
}

export interface MemoryMonitorConfig {
    unit?: 'MB' | 'GB';
}

// --- Executors ---

export class DiskUsageNodeExecutor {
    async execute(config: DiskUsageConfig, input: ExecutionInput): Promise<NodeExecutionResult> {
        const path = config.path || '/';

        try {
            // "df -kP" works on Linux/Mac to get disk usage
            // output usually: Filesystem 1024-blocks Used Available Capacity Mounted on
            const { stdout } = await execAsync(`df -kP "${path}"`);
            const lines = stdout.trim().split('\n');
            if (lines.length < 2) throw new Error('Unexpected df output');

            const parts = lines[1].split(/\s+/);
            // parts[1] = total, parts[2] = used, parts[3] = avail, parts[4] = percentage
            
            const total = parseInt(parts[1]) * 1024; // bytes
            const used = parseInt(parts[2]) * 1024;
            const free = parseInt(parts[3]) * 1024;
            const percentage = parseFloat(parts[4].replace('%', ''));

            // Record metric
            const ctx = (input as any)._context;
            if (ctx && ctx.tenantId) {
                metricService.recordMetric({
                    tenantId: ctx.tenantId,
                    nodeId: ctx.nodeId,
                    workflowId: ctx.workflowId,
                    metricName: 'disk_usage_percent',
                    value: percentage,
                    unit: '%',
                    tags: { path, totalBytes: total }
                });
            }

            return {
                ...input,
                disk: {
                    path,
                    totalBytes: total,
                    usedBytes: used,
                    freeBytes: free,
                    usagePercent: percentage,
                    isFullerThanThreshold: config.thresholdPercent ? percentage > config.thresholdPercent : undefined
                }
            };
        } catch (error) {
             // Fallback for non-unix environments or errors
             throw new NodeExecutionError({
                message: `Failed to check disk usage: ${error instanceof Error ? error.message : String(error)}`,
                nodeId: '', // Injected by caller usually
                nodeName: 'Disk Usage',
                nodeType: 'DiskUsage',
                code: ErrorCode.NODE_EXECUTION_FAILED,
                severity: ErrorSeverity.MEDIUM
            });
        }
    }
}

export class MemoryMonitorNodeExecutor {
    async execute(config: MemoryMonitorConfig, input: ExecutionInput): Promise<NodeExecutionResult> {
        try {
            const total = os.totalmem();
            const free = os.freemem();
            const used = total - free;
            const usagePercent = (used / total) * 100;
            
            const unit = config.unit || 'MB';
            const divisor = unit === 'GB' ? 1024 * 1024 * 1024 : 1024 * 1024;

            // Record metric
            const ctx = (input as any)._context;
            if (ctx && ctx.tenantId) {
                metricService.recordMetric({
                    tenantId: ctx.tenantId,
                    nodeId: ctx.nodeId,
                    workflowId: ctx.workflowId,
                    metricName: 'memory_usage_percent',
                    value: Number(usagePercent.toFixed(2)),
                    unit: '%',
                    tags: { totalBytes: total }
                });
            }

            return {
                ...input,
                memory: {
                    unit,
                    total: Number((total / divisor).toFixed(2)),
                    used: Number((used / divisor).toFixed(2)),
                    free: Number((free / divisor).toFixed(2)),
                    usagePercent: Number(usagePercent.toFixed(2))
                }
            };
        } catch (error) {
            throw new NodeExecutionError({
                message: `Failed to check memory: ${error instanceof Error ? error.message : String(error)}`,
                nodeId: '',
                nodeName: 'Memory Monitor',
                nodeType: 'MemoryMonitor',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }
    }
}

export class CpuMonitorNodeExecutor {
    async execute(config: CpuMonitorConfig, input: ExecutionInput): Promise<NodeExecutionResult> {
        try {
            const cpus = os.cpus();
            const loadAvg = os.loadavg(); // [1, 5, 15] min averages

            // Calculate active usage currently
            // Simplest way is taking the avg of all cores times
            const usagePercent = await this.getRealCpuUsage(config.sampleTimeMs || 100);

            // Record metric
            const ctx = (input as any)._context;
            if (ctx && ctx.tenantId) {
                metricService.recordMetric({
                    tenantId: ctx.tenantId,
                    nodeId: ctx.nodeId,
                    workflowId: ctx.workflowId,
                    metricName: 'cpu_usage_percent',
                    value: Number(usagePercent.toFixed(2)),
                    unit: '%',
                    tags: { cores: cpus.length, loadAvg1m: loadAvg[0] }
                });
            }

            return {
                ...input,
                cpu: {
                    cores: cpus.length,
                    model: cpus[0].model,
                    loadAvg1m: loadAvg[0],
                    loadAvg5m: loadAvg[1],
                    usagePercent: Number(usagePercent.toFixed(2))
                }
            };
        } catch (error) {
            throw new NodeExecutionError({
                message: `Failed to check CPU: ${error instanceof Error ? error.message : String(error)}`,
                nodeId: '',
                nodeName: 'CPU Monitor',
                nodeType: 'CpuMonitor',
                code: ErrorCode.NODE_EXECUTION_FAILED,
            });
        }
    }

    private async getRealCpuUsage(sampleTime: number): Promise<number> {
        const start = this.cpuAverage();
        await new Promise(resolve => setTimeout(resolve, sampleTime));
        const end = this.cpuAverage();

        const idleDiff = end.idle - start.idle;
        const totalDiff = end.total - start.total;

        const percentage = 100 - (100 * idleDiff / totalDiff);
        return percentage;
    }

    private cpuAverage() {
        // Local helper
        let totalIdle = 0; 
        let totalTick = 0;
        const cpus = os.cpus();
      
        for(let i = 0, len = cpus.length; i < len; i++) {
          const cpu = cpus[i];
          for(const type in cpu.times) {
            totalTick += (cpu.times as any)[type];
          }     
          totalIdle += cpu.times.idle;
        }
      
        return { idle: totalIdle / cpus.length,  total: totalTick / cpus.length};
      }
}
