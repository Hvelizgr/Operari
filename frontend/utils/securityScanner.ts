/**
 * Security Scanner
 * Detects hardcoded credentials and secrets in workflow nodes
 */

import type { WorkflowNode } from '@nanoflow/shared';

export interface SecurityIssue {
    nodeId: string;
    nodeTitle: string;
    field: string;
    type: SecurityIssueType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    value?: string; // Masked value for display
}

export type SecurityIssueType =
    | 'api_key'
    | 'password'
    | 'secret'
    | 'token'
    | 'private_key'
    | 'connection_string'
    | 'aws_credentials'
    | 'generic_secret';

export interface ScanResult {
    issues: SecurityIssue[];
    scannedNodes: number;
    hasIssues: boolean;
    highestSeverity: SecurityIssue['severity'] | null;
}

// Patterns to detect secrets
const SECRET_PATTERNS: Array<{
    pattern: RegExp;
    type: SecurityIssueType;
    severity: SecurityIssue['severity'];
    message: string;
}> = [
    // API Keys
    {
        pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/i,
        type: 'api_key',
        severity: 'high',
        message: 'Hardcoded API key detected',
    },
    {
        pattern: /['"]?[a-zA-Z0-9]{32,}['"]?/,
        type: 'api_key',
        severity: 'medium',
        message: 'Possible API key or token (long alphanumeric string)',
    },
    // Passwords
    {
        pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{4,})['"]?/i,
        type: 'password',
        severity: 'critical',
        message: 'Hardcoded password detected',
    },
    // Secrets
    {
        pattern: /(?:secret|client[_-]?secret)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{16,})['"]?/i,
        type: 'secret',
        severity: 'critical',
        message: 'Hardcoded secret detected',
    },
    // Tokens
    {
        pattern: /(?:bearer|token|auth[_-]?token|access[_-]?token)\s*[:=]?\s*['"]?([a-zA-Z0-9_\-\.]{20,})['"]?/i,
        type: 'token',
        severity: 'high',
        message: 'Hardcoded token detected',
    },
    // JWT tokens
    {
        pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/,
        type: 'token',
        severity: 'critical',
        message: 'JWT token detected',
    },
    // Private Keys
    {
        pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
        type: 'private_key',
        severity: 'critical',
        message: 'Private key detected',
    },
    // AWS Credentials
    {
        pattern: /AKIA[0-9A-Z]{16}/,
        type: 'aws_credentials',
        severity: 'critical',
        message: 'AWS Access Key ID detected',
    },
    {
        pattern: /(?:aws[_-]?secret|secret[_-]?access[_-]?key)\s*[:=]\s*['"]?([a-zA-Z0-9/+=]{40})['"]?/i,
        type: 'aws_credentials',
        severity: 'critical',
        message: 'AWS Secret Access Key detected',
    },
    // Connection Strings
    {
        pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@/i,
        type: 'connection_string',
        severity: 'high',
        message: 'Database connection string with credentials detected',
    },
    // Generic patterns
    {
        pattern: /(?:credentials?|auth)\s*[:=]\s*\{[^}]*(?:user|pass|key|secret)[^}]*\}/i,
        type: 'generic_secret',
        severity: 'medium',
        message: 'Possible credentials object detected',
    },
];

// Fields to skip (commonly contain non-secret long strings)
const SKIP_FIELDS = new Set([
    'id',
    'nodeId',
    'type',
    'position',
    'title',
    'description',
    'name',
    'label',
    'icon',
    'color',
    'category',
]);

/**
 * Mask a secret value for display
 */
function maskValue(value: string): string {
    if (value.length <= 8) return '****';
    return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

/**
 * Scan a single value for secrets
 */
function scanValue(
    value: string,
    nodeId: string,
    nodeTitle: string,
    field: string
): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    for (const { pattern, type, severity, message } of SECRET_PATTERNS) {
        if (pattern.test(value)) {
            issues.push({
                nodeId,
                nodeTitle,
                field,
                type,
                severity,
                message,
                value: maskValue(value.substring(0, 50)),
            });
            break; // One issue per field is enough
        }
    }

    return issues;
}

/**
 * Recursively scan an object for secrets
 */
function scanObject(
    obj: Record<string, any>,
    nodeId: string,
    nodeTitle: string,
    path: string = ''
): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    for (const [key, value] of Object.entries(obj)) {
        const fieldPath = path ? `${path}.${key}` : key;

        // Skip known safe fields
        if (SKIP_FIELDS.has(key.toLowerCase())) continue;

        if (typeof value === 'string' && value.length > 8) {
            issues.push(...scanValue(value, nodeId, nodeTitle, fieldPath));
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            issues.push(...scanObject(value, nodeId, nodeTitle, fieldPath));
        } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
                if (typeof item === 'string' && item.length > 8) {
                    issues.push(...scanValue(item, nodeId, nodeTitle, `${fieldPath}[${index}]`));
                } else if (typeof item === 'object' && item !== null) {
                    issues.push(...scanObject(item, nodeId, nodeTitle, `${fieldPath}[${index}]`));
                }
            });
        }
    }

    return issues;
}

/**
 * Scan workflow nodes for security issues
 */
export function scanWorkflowSecurity(nodes: WorkflowNode[]): ScanResult {
    const issues: SecurityIssue[] = [];
    let scannedNodes = 0;

    for (const node of nodes) {
        // Skip organizational nodes
        if (node.type.startsWith('custom.note') || node.type.startsWith('custom.frame')) {
            continue;
        }

        scannedNodes++;

        // Scan node config
        if (node.config && typeof node.config === 'object') {
            issues.push(...scanObject(node.config as Record<string, any>, node.id, node.title, 'config'));
        }
    }

    // Determine highest severity
    let highestSeverity: SecurityIssue['severity'] | null = null;
    const severityOrder: SecurityIssue['severity'][] = ['low', 'medium', 'high', 'critical'];

    for (const issue of issues) {
        if (!highestSeverity || severityOrder.indexOf(issue.severity) > severityOrder.indexOf(highestSeverity)) {
            highestSeverity = issue.severity;
        }
    }

    return {
        issues,
        scannedNodes,
        hasIssues: issues.length > 0,
        highestSeverity,
    };
}

/**
 * Get color for severity level
 */
export function getSeverityColor(severity: SecurityIssue['severity']): string {
    switch (severity) {
        case 'low': return '#f59e0b'; // yellow
        case 'medium': return '#f97316'; // orange
        case 'high': return '#ef4444'; // red
        case 'critical': return '#dc2626'; // dark red
    }
}

/**
 * Get label for severity level
 */
export function getSeverityLabel(severity: SecurityIssue['severity'], lang: 'en' | 'es'): string {
    const labels = {
        low: { en: 'Low', es: 'Bajo' },
        medium: { en: 'Medium', es: 'Medio' },
        high: { en: 'High', es: 'Alto' },
        critical: { en: 'Critical', es: 'Crítico' },
    };
    return labels[severity][lang];
}
