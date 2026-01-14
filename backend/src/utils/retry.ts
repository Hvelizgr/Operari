import { CustomError, ErrorCode, HttpError, ExternalServiceError, ErrorSeverity } from '../errors/custom-error';
import { Logger } from '../services/logger.service';

/**
 * Retry configuration options
 */
export interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    timeout?: number;
    isRetryable?: (error: unknown) => boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000,      // 1 second
    maxDelay: 30000,         // 30 seconds
    backoffMultiplier: 2,
    timeout: 30000,          // 30 seconds per attempt
    isRetryable: (error: unknown) => {
        if (error instanceof CustomError) {
            return error.isRetryable;
        }
        if (error instanceof HttpError) {
            // Retry on network errors, timeouts, and 5xx errors
            return error.statusCode ? error.statusCode >= 500 || error.statusCode === 429 : true;
        }
        return false;
    },
};

/**
 * Calculate delay for exponential backoff with jitter
 * Formula: min(maxDelay, initialDelay * multiplier ^ attempt + jitter)
 */
export function calculateBackoffDelay(
    attempt: number,
    options: Required<RetryOptions>
): number {
    const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
    const delay = Math.min(options.maxDelay, exponentialDelay + jitter);
    return Math.round(delay);
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    label: string,
    options?: Partial<RetryOptions>
): Promise<T> {
    const mergedOptions: Required<RetryOptions> = {
        ...DEFAULT_RETRY_OPTIONS,
        ...options,
    };

    const logger = Logger.getInstance();
    let lastError: unknown;

    for (let attempt = 0; attempt <= mergedOptions.maxRetries; attempt++) {
        try {
            // Execute with timeout
            const result = await Promise.race([
                fn(),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`Operation timeout after ${mergedOptions.timeout}ms`)),
                        mergedOptions.timeout
                    )
                ),
            ]);

            if (attempt > 0) {
                logger.info(`${label}: Succeeded after ${attempt} retries`);
            }

            return result;
        } catch (error) {
            lastError = error;

            // Check if error is retryable and if we have retries left
            if (!mergedOptions.isRetryable(error) || attempt === mergedOptions.maxRetries) {
                if (attempt > 0) {
                    logger.warn(`${label}: Failed after ${attempt} retries`, {
                        error: error instanceof Error ? error : new Error(String(error)),
                    });
                }
                throw error;
            }

            // Calculate delay and log retry attempt
            const delay = calculateBackoffDelay(attempt, mergedOptions);
            logger.warn(`${label}: Retry attempt ${attempt + 1}/${mergedOptions.maxRetries + 1} after ${delay}ms`, {
                error: error instanceof Error ? error : new Error(String(error)),
            });

            await sleep(delay);
        }
    }

    // Should never reach here, but just in case
    throw lastError || new Error(`${label}: Failed after ${mergedOptions.maxRetries} retries`);
}

/**
 * Execute HTTP request with exponential backoff retry logic
 * Specifically designed for HTTP operations
 */
export async function withHttpRetry<T>(
    fn: () => Promise<T>,
    label: string,
    options?: Partial<RetryOptions>
): Promise<T> {
    const mergedOptions: Required<RetryOptions> = {
        ...DEFAULT_RETRY_OPTIONS,
        maxRetries: options?.maxRetries ?? 3,
        timeout: options?.timeout ?? 30000,
        ...options,
    };

    const logger = Logger.getInstance();
    let lastError: unknown;

    for (let attempt = 0; attempt <= mergedOptions.maxRetries; attempt++) {
        try {
            const result = await Promise.race([
                fn(),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new HttpError({
                            message: `HTTP operation timeout after ${mergedOptions.timeout}ms`,
                            code: ErrorCode.HTTP_TIMEOUT,
                        })),
                        mergedOptions.timeout
                    )
                ),
            ]);

            if (attempt > 0) {
                logger.info(`${label}: HTTP request succeeded after ${attempt} retries`);
            }

            return result;
        } catch (error) {
            lastError = error;

            // Check if error is retryable and if we have retries left
            if (!mergedOptions.isRetryable(error) || attempt === mergedOptions.maxRetries) {
                if (attempt > 0) {
                    logger.error(`${label}: HTTP request failed after ${attempt} retries`, {
                        error: error instanceof Error ? error : new Error(String(error)),
                    });
                }
                throw error;
            }

            // Calculate delay and log retry attempt
            const delay = calculateBackoffDelay(attempt, mergedOptions);
            logger.retryAttempt({}, attempt + 1, mergedOptions.maxRetries + 1, error instanceof Error ? error : new Error(String(error)));

            await sleep(delay);
        }
    }

    throw lastError || new HttpError({
        message: `${label}: Failed after ${mergedOptions.maxRetries} retries`,
        code: ErrorCode.HTTP_REQUEST_FAILED,
    });
}

/**
 * Execute external service operation with exponential backoff retry logic
 * Specifically designed for external services (email, database, etc.)
 */
export async function withExternalServiceRetry<T>(
    fn: () => Promise<T>,
    serviceName: string,
    options?: Partial<RetryOptions>
): Promise<T> {
    const mergedOptions: Required<RetryOptions> = {
        ...DEFAULT_RETRY_OPTIONS,
        maxRetries: options?.maxRetries ?? 3,
        timeout: options?.timeout ?? 30000,
        ...options,
    };

    const logger = Logger.getInstance();
    let lastError: unknown;

    for (let attempt = 0; attempt <= mergedOptions.maxRetries; attempt++) {
        try {
            const result = await Promise.race([
                fn(),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new ExternalServiceError({
                            message: `${serviceName} operation timeout after ${mergedOptions.timeout}ms`,
                            code: ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
                            serviceName,
                        })),
                        mergedOptions.timeout
                    )
                ),
            ]);

            if (attempt > 0) {
                logger.info(`${serviceName}: Operation succeeded after ${attempt} retries`);
            }

            return result;
        } catch (error) {
            lastError = error;

            // Check if error is retryable and if we have retries left
            if (!mergedOptions.isRetryable(error) || attempt === mergedOptions.maxRetries) {
                if (attempt > 0) {
                    logger.error(`${serviceName}: Operation failed after ${attempt} retries`, {
                        error: error instanceof Error ? error : new Error(String(error)),
                    });
                }
                throw error;
            }

            // Calculate delay and log retry attempt
            const delay = calculateBackoffDelay(attempt, mergedOptions);
            logger.retryAttempt({}, attempt + 1, mergedOptions.maxRetries + 1, error instanceof Error ? error : new Error(String(error)));

            await sleep(delay);
        }
    }

    throw lastError || new ExternalServiceError({
        message: `${serviceName}: Failed after ${mergedOptions.maxRetries} retries`,
        code: ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
        serviceName,
    });
}
