import { ExecutionInput, NodeExecutionResult } from '../../types/workflow.types';
import { NodeExecutionError, ErrorCode, ErrorSeverity } from '../../errors/custom-error';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

// --- interfaces ---

export interface PingConfig {
    host: string;
    count?: number; // Default 3
    timeout?: number; // Default 5s
}

export interface HttpHealthCheckConfig {
    url: string;
    method?: 'GET' | 'HEAD' | 'POST';
    expectedStatus?: number; // Default 200
    timeout?: number; // Default 5000ms
}

// --- Executors ---

export class PingNodeExecutor {
    async execute(config: PingConfig, input: ExecutionInput): Promise<NodeExecutionResult> {
        const { host, count = 3, timeout = 5 } = config;

        if (!host) {
             throw new NodeExecutionError({
                message: 'Ping target host is required',
                nodeId: '',
                nodeName: 'Ping',
                nodeType: 'Ping',
                code: ErrorCode.CONFIGURATION_ERROR
            });
        }

        try {
            // Linux/Mac ping format: -c count -W timeout(seconds)
            // Windows format is different (-n count -w timeout(ms)), assuming Linux container based on Dockerfile
            const cmd = `ping -c ${count} -W ${timeout} ${host}`;
            
            const startTime = Date.now();
            const { stdout } = await execAsync(cmd);
            const duration = Date.now() - startTime;

            // Parse output for stats (packet loss, avg time)
            // Example line: "3 packets transmitted, 3 received, 0% packet loss, time 2003ms"
            // Example RTT: "rtt min/avg/max/mdev = 10.1/12.5/15.2/2.1 ms"
            
            const packetLossMatch = stdout.match(/(\d+)% packet loss/);
            const packetLoss = packetLossMatch ? parseInt(packetLossMatch[1]) : 0;
            
            const rttMatch = stdout.match(/rtt min\/avg\/max\/mdev = ([0-9.]+)\/([0-9.]+)\/([0-9.]+)/);
            const avgRtt = rttMatch ? parseFloat(rttMatch[2]) : null;

            return {
                ...input,
                ping: {
                    host,
                    alive: packetLoss < 100,
                    packetLossPercent: packetLoss,
                    avgLatencyMs: avgRtt,
                    output: stdout.slice(0, 500) // Truncate to avoid giant logs
                }
            };

        } catch (error: any) {
            // Ping command usually fails (throws) if host is unreachable (100% loss)
             return {
                ...input,
                ping: {
                    host,
                    alive: false,
                    packetLossPercent: 100,
                    error: error.message
                }
            };
        }
    }
}

export class HttpHealthCheckNodeExecutor {
    async execute(config: HttpHealthCheckConfig, input: ExecutionInput): Promise<NodeExecutionResult> {
        const { url, method = 'GET', expectedStatus = 200, timeout = 5000 } = config;

        if (!url) {
             throw new NodeExecutionError({
                message: 'Target URL is required',
                nodeId: '', 
                nodeName: 'Http Check',
                nodeType: 'HttpHealthCheck',
                code: ErrorCode.CONFIGURATION_ERROR
            });
        }

        const startTime = Date.now();
        try {
            const response = await axios({
                url,
                method,
                timeout,
                validateStatus: () => true // Don't throw on status != 200
            });

            const latency = Date.now() - startTime;
            const isHealthy = response.status === expectedStatus;

            return {
                ...input,
                httpCheck: {
                    url,
                    status: response.status,
                    statusText: response.statusText,
                    latencyMs: latency,
                    isHealthy,
                    matchesExpected: isHealthy
                }
            };
        } catch (error: any) {
             const latency = Date.now() - startTime;
             
             // Network error (DNS, Connection Refused, Timeout)
             return {
                ...input,
                httpCheck: {
                    url,
                    status: 0,
                    error: error.message,
                    latencyMs: latency,
                    isHealthy: false
                }
            };
        }
    }
}
