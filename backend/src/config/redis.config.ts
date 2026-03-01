import Redis from 'ioredis';
import { logger } from '../services/logger.service';

class RedisClient {
    private static instance: RedisClient;
    private client: Redis | null = null;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 10;
    private healthCheckInterval: NodeJS.Timeout | null = null;

    private constructor() {
        if (!process.env.REDIS_URL) {
            logger.warn('Redis is not configured. Falling back to in-memory storage.', {
                context: { nodeId: '', nodeName: '', nodeType: '' }
            });
            return;
        }

        this.initializeClient();
    }

    private initializeClient() {
        try {
            this.client = new Redis(process.env.REDIS_URL!, {
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                lazyConnect: false,
                retryStrategy: (times) => {
                    this.reconnectAttempts = times;
                    if (times > this.maxReconnectAttempts) {
                        logger.error(`Redis max reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
                        return null;
                    }
                    const delay = Math.min(times * 100, 5000);
                    logger.warn(`Redis reconnecting... attempt ${times}, delay ${delay}ms`);
                    return delay;
                },
                reconnectOnError: (err) => {
                    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
                    return targetErrors.some(e => err.message.includes(e));
                },
            });

            this.setupEventHandlers();
            this.startHealthCheck();
        } catch (error) {
            logger.error('Failed to initialize Redis client', { error: error as Error });
        }
    }

    private setupEventHandlers() {
        if (!this.client) return;

        this.client.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            logger.info('Successfully connected to Redis');
        });

        this.client.on('ready', () => {
            this.isConnected = true;
            logger.info('Redis client ready');
        });

        this.client.on('error', (err) => {
            if (err.message.includes('ECONNREFUSED')) {
                logger.warn('Redis connection refused - server may be down');
            } else {
                logger.error('Redis connection error', { error: err });
            }
        });

        this.client.on('close', () => {
            this.isConnected = false;
            logger.warn('Redis connection closed');
        });

        this.client.on('reconnecting', () => {
            logger.info('Redis attempting to reconnect...');
        });

        this.client.on('end', () => {
            this.isConnected = false;
            logger.warn('Redis connection ended');
        });
    }

    private startHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(async () => {
            if (this.client && this.isConnected) {
                try {
                    await this.client.ping();
                } catch (error) {
                    logger.warn('Redis health check failed', { error: error as Error });
                    this.isConnected = false;
                }
            }
        }, 30000);
    }

    public static getInstance(): RedisClient {
        if (!RedisClient.instance) {
            RedisClient.instance = new RedisClient();
        }
        return RedisClient.instance;
    }

    public getClient(): Redis | null {
        return this.client;
    }

    public isReady(): boolean {
        return this.isConnected && this.client?.status === 'ready';
    }

    public getStatus(): { connected: boolean; status: string; reconnectAttempts: number } {
        return {
            connected: this.isConnected,
            status: this.client?.status || 'not-initialized',
            reconnectAttempts: this.reconnectAttempts,
        };
    }

    public async quit(): Promise<void> {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        if (this.client) {
            try {
                await this.client.quit();
            } catch (error) {
                logger.warn('Error during Redis quit', { error: error as Error });
            }
            this.isConnected = false;
        }
    }

    public async forceReconnect(): Promise<boolean> {
        if (this.client) {
            try {
                await this.client.quit();
            } catch { /* ignore disconnect errors */ }
        }
        this.initializeClient();
        return new Promise((resolve) => {
            setTimeout(() => resolve(this.isReady()), 2000);
        });
    }
}

export const redisConfig = RedisClient.getInstance();
