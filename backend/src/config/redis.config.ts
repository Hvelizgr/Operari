import Redis from 'ioredis';
import { logger } from '../services/logger.service';

/**
 * Singleton Redis client instance
 */
class RedisClient {
  private static instance: RedisClient;
  private client: Redis | null = null;
  private isConnected: boolean = false;

  private constructor() {
    if (!process.env.REDIS_URL) {
      logger.warn('Redis is not configured. Falling back to in-memory storage.', {
        context: { nodeId: '', nodeName: '', nodeType: '' }, // minimal context
      });
      return;
    }

    try {
      this.client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: times => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: err => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Successfully connected to Redis');
      });

      this.client.on('error', err => {
        this.isConnected = false;
        logger.error('Redis connection error', { error: err });
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });
    } catch (error) {
      logger.error('Failed to initialize Redis client', { error: error as Error });
    }
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

  public async quit(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

export const redisConfig = RedisClient.getInstance();
