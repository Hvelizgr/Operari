import axios from 'axios';
import { WorkflowNode, WorkflowConnection } from '../types/workflow.types';
import { Logger } from './logger.service';

export interface ImportedWorkflow {
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
    tags?: string[];
    source: {
        type: 'url' | 'json' | 'n8n' | 'make' | 'zapier';
        url?: string;
        format: string;
    };
}

export interface ImportResult {
    success: boolean;
    workflow?: ImportedWorkflow;
    error?: string;
    warnings: string[];
    transformations: string[];
}

interface N8nNode {
    id?: string;
    name: string;
    type: string;
    position: [number, number];
    parameters: Record<string, unknown>;
    credentials?: Record<string, { id: string; name: string }>;
    typeVersion?: number;
}

interface N8nWorkflow {
    name: string;
    nodes: N8nNode[];
    connections: Record<string, { main: Array<Array<{ node: string; type: string; index: number }>> }>;
    active?: boolean;
    settings?: Record<string, unknown>;
}

const N8N_TYPE_TO_NANOFLOW: Record<string, string> = {
    'n8n-nodes-base.webhook': 'Webhook',
    'n8n-nodes-base.manualTrigger': 'Trigger',
    'n8n-nodes-base.scheduleTrigger': 'Schedule',
    'n8n-nodes-base.httpRequest': 'HTTP',
    'n8n-nodes-base.set': 'Transform',
    'n8n-nodes-base.code': 'Code',
    'n8n-nodes-base.if': 'Condition',
    'n8n-nodes-base.switch': 'Decision',
    'n8n-nodes-base.merge': 'Join',
    'n8n-nodes-base.splitInBatches': 'Loop',
    'n8n-nodes-base.wait': 'Delay',
    'n8n-nodes-base.function': 'Code',
    'n8n-nodes-base.emailSend': 'Email',
    'n8n-nodes-base.postgres': 'Database',
    'n8n-nodes-base.mysql': 'Database',
    'n8n-nodes-base.slack': 'Slack',
    'n8n-nodes-base.telegram': 'Telegram',
    'n8n-nodes-base.discord': 'Discord',
};

export class WorkflowImportService {
    private static logger = Logger.getInstance();

    static async importFromUrl(url: string): Promise<ImportResult> {
        const warnings: string[] = [];
        const transformations: string[] = [];

        try {
            if (!this.isValidUrl(url)) {
                return {
                    success: false,
                    error: 'Invalid URL format',
                    warnings: [],
                    transformations: []
                };
            }

            const response = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'NanoFlow-Importer/1.0'
                }
            });

            const data = response.data;

            if (typeof data === 'string') {
                try {
                    return this.importFromJson(JSON.parse(data), url, warnings, transformations);
                } catch {
                    return {
                        success: false,
                        error: 'URL did not return valid JSON',
                        warnings: [],
                        transformations: []
                    };
                }
            }

            return this.importFromJson(data, url, warnings, transformations);
        } catch (error) {
            this.logger.error('Failed to import from URL', { error: error as Error, metadata: { url } });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch URL',
                warnings: [],
                transformations: []
            };
        }
    }

    static importFromJson(
        data: unknown,
        sourceUrl?: string,
        warnings: string[] = [],
        transformations: string[] = []
    ): ImportResult {
        try {
            const format = this.detectFormat(data);
            transformations.push(`Detected format: ${format}`);

            switch (format) {
                case 'n8n':
                    return this.importN8nWorkflow(data as N8nWorkflow, sourceUrl, warnings, transformations);
                case 'nanoflow':
                    return this.importNanoFlowWorkflow(data, sourceUrl, warnings, transformations);
                case 'make':
                    return this.importMakeWorkflow(data, sourceUrl, warnings, transformations);
                case 'zapier':
                    return this.importZapierWorkflow(data, sourceUrl, warnings, transformations);
                default:
                    return this.importGenericWorkflow(data, sourceUrl, warnings, transformations);
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to parse workflow',
                warnings,
                transformations
            };
        }
    }

    private static detectFormat(data: unknown): string {
        if (!data || typeof data !== 'object') return 'unknown';

        const obj = data as Record<string, unknown>;

        if (obj.nodes && obj.connections && Array.isArray(obj.nodes)) {
            const firstNode = (obj.nodes as any[])[0];
            if (firstNode?.type?.startsWith('n8n-nodes-base.')) {
                return 'n8n';
            }
            if (firstNode?.position && (firstNode.type || firstNode.nodeType)) {
                return 'nanoflow';
            }
        }

        if (obj.blueprint && obj.organization) {
            return 'make';
        }

        if (obj.zap && obj.steps) {
            return 'zapier';
        }

        return 'generic';
    }

    private static importN8nWorkflow(
        n8n: N8nWorkflow,
        sourceUrl?: string,
        warnings: string[] = [],
        transformations: string[] = []
    ): ImportResult {
        const nodeNameToId = new Map<string, string>();
        const nodes: WorkflowNode[] = [];

        for (let i = 0; i < n8n.nodes.length; i++) {
            const n8nNode = n8n.nodes[i];
            const nodeId = n8nNode.id || `node-${i}-${Date.now()}`;
            nodeNameToId.set(n8nNode.name, nodeId);

            const nanoflowType = N8N_TYPE_TO_NANOFLOW[n8nNode.type] || this.extractNodeType(n8nNode.type);
            
            if (n8nNode.type && !N8N_TYPE_TO_NANOFLOW[n8nNode.type]) {
                warnings.push(`Unknown n8n node type "${n8nNode.type}" mapped to "${nanoflowType}"`);
            }

            const config = this.transformN8nParameters(n8nNode, transformations);

            nodes.push({
                id: nodeId,
                type: nanoflowType,
                title: n8nNode.name,
                position: {
                    x: n8nNode.position[0],
                    y: n8nNode.position[1]
                },
                config,
                inputs: [{ id: 'input', label: 'Input' }],
                outputs: [{ id: 'output', label: 'Output' }]
            });

            transformations.push(`Imported node "${n8nNode.name}" as ${nanoflowType}`);
        }

        const connections: WorkflowConnection[] = [];
        let connectionId = 0;

        for (const [sourceName, conn] of Object.entries(n8n.connections)) {
            const sourceId = nodeNameToId.get(sourceName);
            if (!sourceId) {
                warnings.push(`Connection source "${sourceName}" not found`);
                continue;
            }

            for (let portIndex = 0; portIndex < conn.main.length; portIndex++) {
                for (const target of conn.main[portIndex]) {
                    const targetId = nodeNameToId.get(target.node);
                    if (!targetId) {
                        warnings.push(`Connection target "${target.node}" not found`);
                        continue;
                    }

                    connections.push({
                        id: `conn-${connectionId++}`,
                        source: sourceId,
                        target: targetId,
                        sourcePort: portIndex,
                        targetPort: target.index || 0
                    });
                }
            }
        }

        transformations.push(`Created ${connections.length} connections`);

        return {
            success: true,
            workflow: {
                name: n8n.name || 'Imported n8n Workflow',
                nodes,
                connections,
                source: {
                    type: 'n8n',
                    url: sourceUrl,
                    format: 'n8n-workflow-v1'
                }
            },
            warnings,
            transformations
        };
    }

    private static importNanoFlowWorkflow(
        data: unknown,
        sourceUrl?: string,
        warnings: string[] = [],
        transformations: string[] = []
    ): ImportResult {
        const obj = data as { name?: string; nodes: WorkflowNode[]; connections: WorkflowConnection[] };
        
        transformations.push('Importing native NanoFlow format');

        return {
            success: true,
            workflow: {
                name: obj.name || 'Imported NanoFlow Workflow',
                nodes: obj.nodes,
                connections: obj.connections,
                source: {
                    type: 'json',
                    url: sourceUrl,
                    format: 'nanoflow-v1'
                }
            },
            warnings,
            transformations
        };
    }

    private static importMakeWorkflow(
        data: unknown,
        sourceUrl?: string,
        warnings: string[] = [],
        transformations: string[] = []
    ): ImportResult {
        const obj = data as { blueprint?: { modules?: any[]; name?: string } };
        const modules = obj.blueprint?.modules || [];

        transformations.push('Converting Make.com workflow format');
        warnings.push('Make.com import is experimental - some features may not convert properly');

        const nodes: WorkflowNode[] = [];
        const connections: WorkflowConnection[] = [];

        for (let i = 0; i < modules.length; i++) {
            const mod = modules[i];
            const nodeId = `make-node-${i}`;

            nodes.push({
                id: nodeId,
                type: this.mapMakeModuleToType(mod.type || mod.name),
                title: mod.name || mod.label || `Module ${i + 1}`,
                position: { x: 100 + i * 250, y: 200 },
                config: mod.parameters || {},
                inputs: [{ id: 'input', label: 'Input' }],
                outputs: [{ id: 'output', label: 'Output' }]
            });

            if (i > 0) {
                connections.push({
                    id: `conn-${i}`,
                    source: `make-node-${i - 1}`,
                    target: nodeId,
                    sourcePort: 0,
                    targetPort: 0
                });
            }
        }

        return {
            success: true,
            workflow: {
                name: obj.blueprint?.name || 'Imported Make Workflow',
                nodes,
                connections,
                source: {
                    type: 'make',
                    url: sourceUrl,
                    format: 'make-blueprint'
                }
            },
            warnings,
            transformations
        };
    }

    private static importZapierWorkflow(
        data: unknown,
        sourceUrl?: string,
        warnings: string[] = [],
        transformations: string[] = []
    ): ImportResult {
        const obj = data as { zap?: { name?: string }; steps?: any[] };
        const steps = obj.steps || [];

        transformations.push('Converting Zapier workflow format');
        warnings.push('Zapier import is experimental - some features may not convert properly');

        const nodes: WorkflowNode[] = [];
        const connections: WorkflowConnection[] = [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const nodeId = `zapier-node-${i}`;

            nodes.push({
                id: nodeId,
                type: this.mapZapierStepToType(step.action_type || step.type),
                title: step.title || step.name || `Step ${i + 1}`,
                position: { x: 100 + i * 250, y: 200 },
                config: step.params || step.inputFields || {},
                inputs: [{ id: 'input', label: 'Input' }],
                outputs: [{ id: 'output', label: 'Output' }]
            });

            if (i > 0) {
                connections.push({
                    id: `conn-${i}`,
                    source: `zapier-node-${i - 1}`,
                    target: nodeId,
                    sourcePort: 0,
                    targetPort: 0
                });
            }
        }

        return {
            success: true,
            workflow: {
                name: obj.zap?.name || 'Imported Zapier Workflow',
                nodes,
                connections,
                source: {
                    type: 'zapier',
                    url: sourceUrl,
                    format: 'zapier-zap'
                }
            },
            warnings,
            transformations
        };
    }

    private static importGenericWorkflow(
        data: unknown,
        sourceUrl?: string,
        warnings: string[] = [],
        transformations: string[] = []
    ): ImportResult {
        const obj = data as Record<string, unknown>;
        
        transformations.push('Attempting generic JSON import');
        warnings.push('Unknown format - attempting best-effort import');

        let nodes: WorkflowNode[] = [];
        let connections: WorkflowConnection[] = [];

        if (Array.isArray(obj.nodes)) {
            nodes = (obj.nodes as any[]).map((n, i) => ({
                id: n.id || `node-${i}`,
                type: n.type || n.nodeType || 'Transform',
                title: n.title || n.name || n.label || `Node ${i + 1}`,
                position: n.position || { x: 100 + i * 200, y: 200 },
                config: n.config || n.data || n.parameters || {},
                inputs: n.inputs || ['input'],
                outputs: n.outputs || ['output']
            }));
        }

        if (Array.isArray(obj.connections) || Array.isArray(obj.edges)) {
            const conns = (obj.connections || obj.edges) as any[];
            connections = conns.map((c, i) => ({
                id: c.id || `conn-${i}`,
                source: c.source || c.from || c.sourceId,
                target: c.target || c.to || c.targetId,
                sourcePort: c.sourcePort || c.sourceHandle || 0,
                targetPort: c.targetPort || c.targetHandle || 0
            }));
        }

        return {
            success: nodes.length > 0,
            workflow: nodes.length > 0 ? {
                name: (obj.name as string) || 'Imported Workflow',
                nodes,
                connections,
                source: {
                    type: 'json',
                    url: sourceUrl,
                    format: 'generic'
                }
            } : undefined,
            error: nodes.length === 0 ? 'Could not extract nodes from the provided data' : undefined,
            warnings,
            transformations
        };
    }

    private static transformN8nParameters(
        node: N8nNode,
        _transformations: string[]
    ): Record<string, unknown> {
        const params = node.parameters || {};
        const config: Record<string, unknown> = {};

        switch (node.type) {
            case 'n8n-nodes-base.httpRequest':
                config.url = params.url;
                config.method = params.method || 'GET';
                if (params.headerParameters) {
                    const headers: Record<string, string> = {};
                    const headerParams = (params.headerParameters as { parameters?: { name: string; value: string }[] })?.parameters || [];
                    headerParams.forEach((h) => { headers[h.name] = h.value; });
                    config.headers = headers;
                }
                break;

            case 'n8n-nodes-base.code':
            case 'n8n-nodes-base.function':
                config.code = params.jsCode || params.functionCode || '';
                break;

            case 'n8n-nodes-base.if': {
                const conditions = params.conditions as { string?: { value1?: string; operation?: string; value2?: string }[] } | undefined;
                if (conditions?.string?.[0]) {
                    config.field = this.extractFieldFromExpression(conditions.string[0].value1);
                    config.operator = conditions.string[0].operation;
                    config.value = conditions.string[0].value2;
                }
                break;
            }

            case 'n8n-nodes-base.wait':
                config.duration = params.amount || 1000;
                config.unit = params.unit || 'milliseconds';
                break;

            case 'n8n-nodes-base.webhook':
                config.path = params.path;
                config.method = params.httpMethod || 'POST';
                break;

            default:
                Object.assign(config, params);
        }

        return config;
    }

    private static extractFieldFromExpression(expr?: string): string {
        if (!expr) return 'value';
        const match = expr.match(/\$json\["([^"]+)"\]/);
        return match ? match[1] : 'value';
    }

    private static extractNodeType(n8nType: string): string {
        const parts = n8nType.split('.');
        const typeName = parts[parts.length - 1];
        return typeName.charAt(0).toUpperCase() + typeName.slice(1);
    }

    private static mapMakeModuleToType(moduleType: string): string {
        const mapping: Record<string, string> = {
            'webhook': 'Webhook',
            'http': 'HTTP',
            'router': 'Decision',
            'filter': 'Condition',
            'aggregator': 'Join',
            'iterator': 'Loop',
            'slack': 'Slack',
            'email': 'Email',
        };
        const lower = moduleType.toLowerCase();
        for (const [key, value] of Object.entries(mapping)) {
            if (lower.includes(key)) return value;
        }
        return 'Transform';
    }

    private static mapZapierStepToType(stepType: string): string {
        const mapping: Record<string, string> = {
            'trigger': 'Trigger',
            'action': 'Transform',
            'filter': 'Condition',
            'path': 'Decision',
            'delay': 'Delay',
            'formatter': 'Transform',
        };
        return mapping[stepType?.toLowerCase()] || 'Transform';
    }

    private static isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}
