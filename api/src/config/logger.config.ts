import pino from 'pino';
import { randomUUID } from 'crypto';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    formatters: {
        level: (label) => {
            return { level: label };
        },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
        env: process.env.NODE_ENV,
    },
});

export const createRequestLogger = (requestId?: string) => {
    return logger.child({
        requestId: requestId || randomUUID(),
    });
};

export const createUserLogger = (userId: string, tenantId: string, requestId?: string) => {
    return logger.child({
        userId,
        tenantId,
        requestId: requestId || randomUUID(),
    });
};
