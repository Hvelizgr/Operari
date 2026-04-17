import pino from 'pino';
import { randomUUID } from 'crypto';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Redaction paths. Anything matched here is replaced with `[Redacted]`
 * before the log line is serialized, so shipping logs to Axiom /
 * Loki / Datadog never exports a credential. Patterns cover:
 *   - request auth headers in both shapes Express uses (`req.headers`
 *     and a camelCased copy the logger.middleware.ts leaves behind)
 *   - the most common body keys across our auth/billing/webhook
 *     routes (password, token, secret, apiKey, totpCode, signature)
 *   - Stripe + webhook signatures in inbound payloads
 *
 * Adding a new redaction path is cheaper than adding another
 * codepath-specific logger.child(). Prefer extending this list when
 * you notice a new sensitive field appearing in logs.
 */
const REDACT_PATHS = [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["set-cookie"]',
    'req.headers["x-api-key"]',
    'req.headers["x-webhook-signature"]',
    'req.headers["x-hub-signature-256"]',
    'req.headers["x-stripe-signature"]',
    'headers.authorization',
    'headers.cookie',
    '*.password',
    '*.passwordHash',
    '*.newPassword',
    '*.currentPassword',
    '*.token',
    '*.secret',
    '*.apiKey',
    '*.api_key',
    '*.totpCode',
    '*.signature',
];

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
    redact: {
        paths: REDACT_PATHS,
        censor: '[Redacted]',
        // `remove: true` would delete the key entirely. We keep it so
        // log queries can still grep for "password was set" shape
        // (key presence) without exposing the value.
        remove: false,
    },
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
