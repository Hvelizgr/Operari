import { CustomError } from '../errors/custom-error';
import { Logger } from './logger.service';

export interface RetryOptions {
    maxRetries: number;
    initialDelay: number; // ms
    maxDelay: number; // ms
    backoffFactor: number;
    useJitter: boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    useJitter: true,
};

export class RetryService {
    private static instance: RetryService;
    private logger: Logger;

    private constructor() {
        this.logger = Logger.getInstance();
    }

    public static getInstance(): RetryService {
        if (!RetryService.instance) {
            RetryService.instance = new RetryService();
        }
        return RetryService.instance;
    }

    /**
     * Executes a function with smart retry logic
     */
    async executeWithRetry<T>(
        fn: () => Promise<T>,
        options: Partial<RetryOptions> = {},
        onRetry?: (error: Error, attempt: number, delay: number) => void
    ): Promise<T> {
        const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                // Check if error is retryable
                const isRetryable = error instanceof CustomError ? error.isRetryable : true;
                
                if (!isRetryable || attempt >= config.maxRetries) {
                    throw error;
                }

                // Calculate delay
                let delay = config.initialDelay * Math.pow(config.backoffFactor, attempt);
                
                // Add jitter
                if (config.useJitter) {
                    delay = delay * (0.5 + Math.random());
                }

                // Cap delay
                delay = Math.min(delay, config.maxDelay);

                // Handle specific HTTP Retry-After header if available
                if (error && (error as any).headers && (error as any).headers['retry-after']) {
                    const retryAfter = parseInt((error as any).headers['retry-after'], 10);
                    if (!isNaN(retryAfter)) {
                        delay = Math.max(delay, retryAfter * 1000);
                    }
                }

                if (onRetry) {
                    onRetry(lastError, attempt + 1, delay);
                }

                this.logger.warn(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`, {
                    error: lastError,
                });

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }
}

export const retryService = RetryService.getInstance();
