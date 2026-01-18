/**
 * Standardized error codes for the workflow execution system
 */
export enum ErrorCode {
    // General errors (1xxx)
    UNKNOWN_ERROR = 'ERR_1000',
    VALIDATION_ERROR = 'ERR_1001',
    CONFIGURATION_ERROR = 'ERR_1002',
    TIMEOUT_ERROR = 'ERR_1003',
    UNAUTHORIZED = 'ERR_1004',
    FORBIDDEN = 'ERR_1005',

    // Workflow errors (2xxx)
    WORKFLOW_NOT_FOUND = 'ERR_2000',
    WORKFLOW_INVALID = 'ERR_2001',
    WORKFLOW_DISABLED = 'ERR_2002',
    EXECUTION_NOT_FOUND = 'ERR_2003',

    // Node execution errors (3xxx)
    NODE_EXECUTION_FAILED = 'ERR_3000',
    NODE_NOT_FOUND = 'ERR_3001',
    NODE_CONFIG_INVALID = 'ERR_3002',
    NODE_INPUT_INVALID = 'ERR_3003',
    NODE_OUTPUT_INVALID = 'ERR_3004',
    NODE_TIMEOUT = 'ERR_3005',

    // HTTP/Network errors (4xxx)
    HTTP_REQUEST_FAILED = 'ERR_4000',
    HTTP_TIMEOUT = 'ERR_4001',
    HTTP_CONNECTION_REFUSED = 'ERR_4002',
    HTTP_INVALID_URL = 'ERR_4003',
    HTTP_INVALID_RESPONSE = 'ERR_4004',

    // External service errors (5xxx)
    EMAIL_SEND_FAILED = 'ERR_5000',
    EMAIL_NOT_CONFIGURED = 'ERR_5001',
    DATABASE_OPERATION_FAILED = 'ERR_5002',
    EXTERNAL_SERVICE_UNAVAILABLE = 'ERR_5003',

    // Sandbox/Code execution errors (6xxx)
    SANDBOX_EXECUTION_FAILED = 'ERR_6000',
    SANDBOX_TIMEOUT = 'ERR_6001',
    SANDBOX_MEMORY_EXCEEDED = 'ERR_6002',
    SANDBOX_FORBIDDEN_OPERATION = 'ERR_6003',

    // Condition errors (7xxx)
    CONDITION_EVALUATION_FAILED = 'ERR_7000',
    CONDITION_INVALID_SYNTAX = 'ERR_7001',
}

/**
 * Execution context for error tracing
 */
export interface ExecutionErrorContext {
    workflowId?: string;
    workflowName?: string;
    executionId?: string;
    nodeId?: string;
    nodeName?: string;
    nodeType?: string;
    userId?: string;
    tenantId?: string;
    retryCount?: number;
    maxRetries?: number;
    input?: unknown;
    cyclePath?: string[];
    cycleNodes?: string[];
    [key: string]: unknown;
}

/**
 * Severity levels for errors
 */
export enum ErrorSeverity {
    LOW = 'low',         // Informational, non-blocking
    MEDIUM = 'medium',   // Warning, may affect execution
    HIGH = 'high',       // Error, blocks current operation
    CRITICAL = 'critical' // Critical, may affect entire execution
}

/**
 * Base custom error class with standardized properties
 */
export class CustomError extends Error {
    public readonly code: ErrorCode;
    public readonly context: ExecutionErrorContext;
    public readonly severity: ErrorSeverity;
    public readonly timestamp: Date;
    public readonly isRetryable: boolean;
    public readonly cause?: Error;
    public readonly userMessage: string;

    constructor(options: {
        message: string;
        code: ErrorCode;
        context?: ExecutionErrorContext;
        severity?: ErrorSeverity;
        isRetryable?: boolean;
        cause?: Error;
        userMessage?: string;
    }) {
        super(options.message);
        this.name = this.constructor.name;
        this.code = options.code;
        this.context = options.context || {};
        this.severity = options.severity || ErrorSeverity.HIGH;
        this.timestamp = new Date();
        this.isRetryable = options.isRetryable ?? false;
        this.cause = options.cause;
        this.userMessage = options.userMessage || this.getDefaultUserMessage(options.code);

        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Get a user-friendly message based on error code
     */
    private getDefaultUserMessage(code: ErrorCode): string {
        const messages: Record<ErrorCode, string> = {
            [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again later.',
            [ErrorCode.VALIDATION_ERROR]: 'The provided data is invalid.',
            [ErrorCode.CONFIGURATION_ERROR]: 'There is a configuration issue. Please check your settings.',
            [ErrorCode.TIMEOUT_ERROR]: 'The operation timed out. Please try again.',

            [ErrorCode.WORKFLOW_NOT_FOUND]: 'The workflow was not found.',
            [ErrorCode.WORKFLOW_INVALID]: 'The workflow configuration is invalid.',
            [ErrorCode.WORKFLOW_DISABLED]: 'The workflow is currently disabled.',
            [ErrorCode.EXECUTION_NOT_FOUND]: 'The execution was not found.',

            [ErrorCode.NODE_EXECUTION_FAILED]: 'A node failed to execute.',
            [ErrorCode.NODE_NOT_FOUND]: 'The specified node was not found.',
            [ErrorCode.NODE_CONFIG_INVALID]: 'The node configuration is invalid.',
            [ErrorCode.NODE_INPUT_INVALID]: 'The node received invalid input.',
            [ErrorCode.NODE_OUTPUT_INVALID]: 'The node produced invalid output.',
            [ErrorCode.NODE_TIMEOUT]: 'The node execution timed out.',

            [ErrorCode.HTTP_REQUEST_FAILED]: 'The HTTP request failed.',
            [ErrorCode.HTTP_TIMEOUT]: 'The HTTP request timed out.',
            [ErrorCode.HTTP_CONNECTION_REFUSED]: 'Could not connect to the server.',
            [ErrorCode.HTTP_INVALID_URL]: 'The URL is invalid.',
            [ErrorCode.HTTP_INVALID_RESPONSE]: 'Received an invalid response from the server.',

            [ErrorCode.EMAIL_SEND_FAILED]: 'Failed to send the email.',
            [ErrorCode.EMAIL_NOT_CONFIGURED]: 'Email service is not configured.',
            [ErrorCode.DATABASE_OPERATION_FAILED]: 'Database operation failed.',
            [ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE]: 'An external service is unavailable.',

            [ErrorCode.SANDBOX_EXECUTION_FAILED]: 'Code execution failed.',
            [ErrorCode.SANDBOX_TIMEOUT]: 'Code execution timed out.',
            [ErrorCode.SANDBOX_MEMORY_EXCEEDED]: 'Code execution exceeded memory limits.',
            [ErrorCode.SANDBOX_FORBIDDEN_OPERATION]: 'The code attempted a forbidden operation.',

            [ErrorCode.CONDITION_EVALUATION_FAILED]: 'Failed to evaluate the condition.',
            [ErrorCode.CONDITION_INVALID_SYNTAX]: 'The condition has invalid syntax.',
            
            [ErrorCode.UNAUTHORIZED]: 'You are not authorized to perform this action.',
            [ErrorCode.FORBIDDEN]: 'You do not have permission to access this resource.',
        };
        return messages[code] || 'An error occurred.';
    }

    /**
     * Convert error to a serializable object for logging/storage
     */
    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            userMessage: this.userMessage,
            severity: this.severity,
            isRetryable: this.isRetryable,
            context: this.context,
            timestamp: this.timestamp.toISOString(),
            stack: this.stack,
            cause: this.cause ? {
                name: this.cause.name,
                message: this.cause.message,
                stack: this.cause.stack,
            } : undefined,
        };
    }
}

/**
 * Error for node execution failures
 */
export class NodeExecutionError extends CustomError {
    constructor(options: {
        message: string;
        code?: ErrorCode;
        nodeId: string;
        nodeName: string;
        nodeType: string;
        context?: Omit<ExecutionErrorContext, 'nodeId' | 'nodeName' | 'nodeType'>;
        severity?: ErrorSeverity;
        isRetryable?: boolean;
        cause?: Error;
        userMessage?: string;
    }) {
        super({
            message: options.message,
            code: options.code || ErrorCode.NODE_EXECUTION_FAILED,
            context: {
                ...options.context,
                nodeId: options.nodeId,
                nodeName: options.nodeName,
                nodeType: options.nodeType,
            },
            severity: options.severity,
            isRetryable: options.isRetryable,
            cause: options.cause,
            userMessage: options.userMessage,
        });
    }
}

/**
 * Error for HTTP/network operations
 */
export class HttpError extends CustomError {
    public readonly statusCode?: number;
    public readonly url?: string;

    constructor(options: {
        message: string;
        code?: ErrorCode;
        statusCode?: number;
        url?: string;
        context?: ExecutionErrorContext;
        cause?: Error;
        userMessage?: string;
    }) {
        // HTTP errors are often retryable (network issues, timeouts, 5xx errors)
        const isRetryable = options.statusCode
            ? options.statusCode >= 500 || options.statusCode === 429
            : true;

        super({
            message: options.message,
            code: options.code || ErrorCode.HTTP_REQUEST_FAILED,
            context: options.context,
            severity: ErrorSeverity.HIGH,
            isRetryable,
            cause: options.cause,
            userMessage: options.userMessage,
        });

        this.statusCode = options.statusCode;
        this.url = options.url;
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            statusCode: this.statusCode,
            url: this.url,
        };
    }
}

/**
 * Error for sandbox/code execution
 */
export class SandboxError extends CustomError {
    constructor(options: {
        message: string;
        code?: ErrorCode;
        context?: ExecutionErrorContext;
        cause?: Error;
        userMessage?: string;
    }) {
        super({
            message: options.message,
            code: options.code || ErrorCode.SANDBOX_EXECUTION_FAILED,
            context: options.context,
            severity: ErrorSeverity.HIGH,
            isRetryable: false, // Sandbox errors are typically not retryable
            cause: options.cause,
            userMessage: options.userMessage,
        });
    }
}

/**
 * Error for external services (email, database, etc.)
 */
export class ExternalServiceError extends CustomError {
    public readonly serviceName: string;

    constructor(options: {
        message: string;
        code?: ErrorCode;
        serviceName: string;
        context?: ExecutionErrorContext;
        cause?: Error;
        userMessage?: string;
        isRetryable?: boolean;
    }) {
        super({
            message: options.message,
            code: options.code || ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
            context: options.context,
            severity: ErrorSeverity.HIGH,
            isRetryable: options.isRetryable ?? true,
            cause: options.cause,
            userMessage: options.userMessage,
        });

        this.serviceName = options.serviceName;
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            serviceName: this.serviceName,
        };
    }
}

/**
 * Error for workflow-level issues
 */
export class WorkflowError extends CustomError {
    constructor(options: {
        message: string;
        code?: ErrorCode;
        workflowId: string;
        workflowName?: string;
        context?: Omit<ExecutionErrorContext, 'workflowId' | 'workflowName'>;
        severity?: ErrorSeverity;
        cause?: Error;
        userMessage?: string;
    }) {
        super({
            message: options.message,
            code: options.code || ErrorCode.WORKFLOW_INVALID,
            context: {
                ...options.context,
                workflowId: options.workflowId,
                workflowName: options.workflowName,
            },
            severity: options.severity || ErrorSeverity.CRITICAL,
            isRetryable: false,
            cause: options.cause,
            userMessage: options.userMessage,
        });
    }
}

/**
 * Utility to wrap unknown errors into CustomError
 */
export function wrapError(error: unknown, context?: ExecutionErrorContext): CustomError {
    if (error instanceof CustomError) {
        // Merge context if provided
        if (context) {
            return new CustomError({
                message: error.message,
                code: error.code,
                context: { ...error.context, ...context },
                severity: error.severity,
                isRetryable: error.isRetryable,
                cause: error.cause,
                userMessage: error.userMessage,
            });
        }
        return error;
    }

    if (error instanceof Error) {
        return new CustomError({
            message: error.message,
            code: ErrorCode.UNKNOWN_ERROR,
            context,
            cause: error,
        });
    }

    return new CustomError({
        message: String(error),
        code: ErrorCode.UNKNOWN_ERROR,
        context,
    });
}
