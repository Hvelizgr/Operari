import { CustomError, ExecutionErrorContext } from '../errors/custom-error';

/**
 * Log levels ordered by severity
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Structured log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: ExecutionErrorContext;
  error?: {
    code?: string;
    message: string;
    stack?: string;
    cause?: {
      name: string;
      message: string;
      stack?: string;
    };
  };
  metadata?: Record<string, unknown>;
  duration?: number;
}

/**
 * Configuration for the logger
 */
export interface LoggerConfig {
  minLevel: LogLevel;
  includeStackTrace: boolean;
  pretty: boolean;
}

/**
 * Log level numeric values for comparison
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Structured Logger Service
 * Provides consistent logging with execution context
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;

  private constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      minLevel: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
      includeStackTrace: process.env.NODE_ENV !== 'production',
      pretty: process.env.NODE_ENV !== 'production',
      ...config,
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Create a child logger with preset context
   */
  child(context: ExecutionErrorContext): ContextLogger {
    return new ContextLogger(this, context);
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.config.minLevel];
  }

  /**
   * Format and output a log entry
   */
  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const output = this.config.pretty ? this.formatPretty(entry) : JSON.stringify(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        process.stdout.write(output + '\n');
        break;
      case LogLevel.WARN:
      case LogLevel.ERROR:
        process.stderr.write(output + '\n');
        break;
    }
  }

  /**
   * Format log entry for human-readable output
   */
  private formatPretty(entry: LogEntry): string {
    const levelColors: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m', // Green
      [LogLevel.WARN]: '\x1b[33m', // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    const color = levelColors[entry.level];

    let output = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp} - ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
    }

    if (entry.error) {
      output += `\n  Error: [${entry.error.code || 'UNKNOWN'}] ${entry.error.message}`;
      if (entry.error.stack && this.config.includeStackTrace) {
        output += `\n  Stack: ${entry.error.stack}`;
      }
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      output += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    if (entry.duration !== undefined) {
      output += `\n  Duration: ${entry.duration}ms`;
    }

    return output;
  }

  /**
   * Create a log entry from parameters
   */
  private createEntry(
    level: LogLevel,
    message: string,
    options?: {
      context?: ExecutionErrorContext;
      error?: Error | CustomError;
      metadata?: Record<string, unknown>;
      duration?: number;
    }
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    if (options?.context) {
      entry.context = options.context;
    }

    if (options?.error) {
      if (options.error instanceof CustomError) {
        entry.error = {
          code: options.error.code,
          message: options.error.message,
          stack: this.config.includeStackTrace ? options.error.stack : undefined,
          cause: options.error.cause
            ? {
                name: options.error.cause.name,
                message: options.error.cause.message,
                stack: this.config.includeStackTrace ? options.error.cause.stack : undefined,
              }
            : undefined,
        };
        // Merge error context if not already provided
        if (!entry.context && options.error.context) {
          entry.context = options.error.context;
        }
      } else {
        entry.error = {
          message: options.error.message,
          stack: this.config.includeStackTrace ? options.error.stack : undefined,
        };
      }
    }

    if (options?.metadata) {
      entry.metadata = options.metadata;
    }

    if (options?.duration !== undefined) {
      entry.duration = options.duration;
    }

    return entry;
  }

  /**
   * Log debug message
   */
  debug(
    message: string,
    options?: {
      context?: ExecutionErrorContext;
      metadata?: Record<string, unknown>;
    }
  ): void {
    this.log(this.createEntry(LogLevel.DEBUG, message, options));
  }

  /**
   * Log info message
   */
  info(
    message: string,
    options?: {
      context?: ExecutionErrorContext;
      metadata?: Record<string, unknown>;
    }
  ): void {
    this.log(this.createEntry(LogLevel.INFO, message, options));
  }

  /**
   * Log warning message
   */
  warn(
    message: string,
    options?: {
      context?: ExecutionErrorContext;
      error?: Error | CustomError;
      metadata?: Record<string, unknown>;
    }
  ): void {
    this.log(this.createEntry(LogLevel.WARN, message, options));
  }

  /**
   * Log error message
   */
  error(
    message: string,
    options?: {
      context?: ExecutionErrorContext;
      error?: Error | CustomError;
      metadata?: Record<string, unknown>;
      duration?: number;
    }
  ): void {
    this.log(this.createEntry(LogLevel.ERROR, message, options));
  }

  /**
   * Log a CustomError with full context
   */
  logError(error: CustomError, additionalMessage?: string): void {
    const message = additionalMessage ? `${additionalMessage}: ${error.message}` : error.message;

    this.error(message, {
      context: error.context,
      error,
    });
  }

  /**
   * Log execution start
   */
  executionStart(context: ExecutionErrorContext): void {
    this.info('Execution started', { context });
  }

  /**
   * Log execution end
   */
  executionEnd(context: ExecutionErrorContext, duration: number, success: boolean): void {
    if (success) {
      this.info('Execution completed successfully', { context, metadata: { duration } });
    } else {
      this.error('Execution failed', { context, metadata: { duration } });
    }
  }

  /**
   * Log node execution start
   */
  nodeStart(context: ExecutionErrorContext): void {
    this.debug(`Node execution started: ${context.nodeName}`, { context });
  }

  /**
   * Log node execution end
   */
  nodeEnd(context: ExecutionErrorContext, duration: number, success: boolean): void {
    if (success) {
      this.debug(`Node execution completed: ${context.nodeName}`, {
        context,
        metadata: { duration },
      });
    } else {
      this.warn(`Node execution failed: ${context.nodeName}`, { context });
    }
  }

  /**
   * Log retry attempt
   */
  retryAttempt(
    context: ExecutionErrorContext,
    attempt: number,
    maxAttempts: number,
    error: Error
  ): void {
    this.warn(`Retry attempt ${attempt}/${maxAttempts}`, {
      context: { ...context, retryCount: attempt, maxRetries: maxAttempts },
      error,
    });
  }
}

/**
 * Context-aware logger that automatically includes execution context
 */
export class ContextLogger {
  private logger: Logger;
  private context: ExecutionErrorContext;

  constructor(logger: Logger, context: ExecutionErrorContext) {
    this.logger = logger;
    this.context = context;
  }

  /**
   * Merge additional context
   */
  withContext(additionalContext: Partial<ExecutionErrorContext>): ContextLogger {
    return new ContextLogger(this.logger, { ...this.context, ...additionalContext });
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.logger.debug(message, { context: this.context, metadata });
  }

  info(message: string, options?: { metadata?: Record<string, unknown>; duration?: number }): void {
    this.logger.info(message, { context: this.context, ...options });
  }

  warn(
    message: string,
    options?: { error?: Error | CustomError; metadata?: Record<string, unknown> }
  ): void {
    this.logger.warn(message, { context: this.context, ...options });
  }

  error(
    message: string,
    options?: { error?: Error | CustomError; metadata?: Record<string, unknown>; duration?: number }
  ): void {
    this.logger.error(message, { context: this.context, ...options });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
