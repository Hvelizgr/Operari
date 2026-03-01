import { WorkflowNode, WorkflowConnection } from '../types/workflow.types';
import { Workflow } from '@prisma/client';

export interface N8nWorkflowFormat {
  name: string;
  nodes: N8nNodeFormat[];
  connections: N8nConnectionFormat;
  active?: boolean;
  settings?: {
    saveExecutionProgress?: boolean;
    saveManualExecutions?: boolean;
    executionTimeout?: number;
  };
}

export interface N8nNodeFormat {
  id?: string;
  name: string;
  type: string;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  typeVersion?: number;
}

export interface N8nConnectionFormat {
  [sourceNodeName: string]: {
    main: Array<Array<{ node: string; type: string; index: number }>>;
  };
}

const NODE_TYPE_MAPPING: Record<string, string> = {
  'Webhook': 'n8n-nodes-base.webhook',
  'Trigger': 'n8n-nodes-base.manualTrigger',
  'ManualTrigger': 'n8n-nodes-base.manualTrigger',
  'Schedule': 'n8n-nodes-base.scheduleTrigger',
  'HTTP': 'n8n-nodes-base.httpRequest',
  'Api': 'n8n-nodes-base.httpRequest',
  'Email': 'n8n-nodes-base.emailSend',
  'Transform': 'n8n-nodes-base.set',
  'Code': 'n8n-nodes-base.code',
  'Condition': 'n8n-nodes-base.if',
  'If': 'n8n-nodes-base.if',
  'Database': 'n8n-nodes-base.postgres',
  'SQL': 'n8n-nodes-base.postgres',
  'Delay': 'n8n-nodes-base.wait',
  'Wait': 'n8n-nodes-base.wait',
  'Loop': 'n8n-nodes-base.splitInBatches',
  'Iterator': 'n8n-nodes-base.splitInBatches',
  'Decision': 'n8n-nodes-base.switch',
  'Split': 'n8n-nodes-base.splitInBatches',
  'Join': 'n8n-nodes-base.merge',
  'Merge': 'n8n-nodes-base.merge',
  'Set': 'n8n-nodes-base.set',
  'Function': 'n8n-nodes-base.function',
  'Switch': 'n8n-nodes-base.switch',
};

export function transformNanoFlowToN8n(workflow: Workflow): N8nWorkflowFormat {
  const nodes = workflow.nodes as unknown as WorkflowNode[];
  const connections = workflow.connections as unknown as WorkflowConnection[];

  const nodeIdToName = new Map<string, string>();
  nodes.forEach((node, index) => {
    const safeName = node.title.replace(/[^a-zA-Z0-9_]/g, '_') || `Node_${index}`;
    nodeIdToName.set(node.id, safeName);
  });

  const n8nNodes: N8nNodeFormat[] = nodes.map((node) => {
    const nodeName = nodeIdToName.get(node.id)!;
    const nodeType = mapNodeType(node.type);
    const parameters = transformNodeParameters(node);

    return {
      id: node.id,
      name: nodeName,
      type: nodeType,
      position: [node.position.x, node.position.y],
      parameters,
      typeVersion: 1,
    };
  });

  const n8nConnections: N8nConnectionFormat = {};

  for (const conn of connections) {
    const sourceName = nodeIdToName.get(conn.source);
    const targetName = nodeIdToName.get(conn.target);

    if (!sourceName || !targetName) continue;

    if (!n8nConnections[sourceName]) {
      n8nConnections[sourceName] = { main: [[]] };
    }

    const sourcePort = conn.sourcePort ?? 0;
    while (n8nConnections[sourceName].main.length <= sourcePort) {
      n8nConnections[sourceName].main.push([]);
    }

    n8nConnections[sourceName].main[sourcePort].push({
      node: targetName,
      type: 'main',
      index: conn.targetPort ?? 0,
    });
  }

  return {
    name: workflow.name || 'NanoFlow Workflow',
    nodes: n8nNodes,
    connections: n8nConnections,
    active: false,
    settings: {
      saveExecutionProgress: true,
      saveManualExecutions: true,
      executionTimeout: 300,
    },
  };
}

function mapNodeType(nanoflowType: string): string {
  if (nanoflowType.startsWith('n8n-nodes-base.')) {
    return nanoflowType;
  }
  return NODE_TYPE_MAPPING[nanoflowType] || `n8n-nodes-base.${nanoflowType.toLowerCase()}`;
}

function transformNodeParameters(node: WorkflowNode): Record<string, unknown> {
  const config = (node.config || {}) as Record<string, unknown>;
  const type = node.type;

  switch (type) {
    case 'HTTP':
    case 'Api': {
      const result: Record<string, unknown> = {
        url: config.url || '',
        method: config.method || 'GET',
        options: {
          response: { response: { fullResponse: true } },
        },
      };
      if (config.headers) {
        result.headerParameters = { parameters: Object.entries(config.headers as Record<string, string>).map(([name, value]) => ({ name, value })) };
      }
      if (config.body) {
        result.bodyParameters = { parameters: [{ name: 'body', value: JSON.stringify(config.body) }] };
      }
      return result;
    }

    case 'Code':
    case 'Transform':
      return {
        jsCode: config.code || '// Your code here\nreturn items;',
        mode: 'runOnceForAllItems',
      };

    case 'Condition':
    case 'If':
      return {
        conditions: {
          string: [
            {
              value1: `={{$json["${config.field || 'value'}"]}}`,
              operation: mapConditionOperator(config.operator as string | undefined),
              value2: config.value || '',
            },
          ],
        },
      };

    case 'Delay':
    case 'Wait':
      return {
        amount: config.duration || 1000,
        unit: 'milliseconds',
      };

    case 'Email':
      return {
        toEmail: config.to || '',
        subject: config.subject || '',
        text: config.body || '',
        html: config.html || '',
      };

    case 'Loop':
    case 'Iterator':
    case 'Split':
      return {
        batchSize: 1,
        options: {},
      };

    case 'Webhook':
      return {
        path: config.path || `webhook-${node.id}`,
        httpMethod: config.method || 'POST',
        responseMode: 'onReceived',
        responseData: 'allEntries',
      };

    case 'Schedule':
      return {
        rule: {
          interval: [{ field: 'cronExpression', expression: config.cron || '0 * * * *' }],
        },
      };

    case 'Switch':
    case 'Decision':
      return {
        dataType: 'string',
        value1: config.expression || '={{$json["value"]}}',
        rules: {
          rules: [
            { value: 'true', output: 0 },
            { value: 'false', output: 1 },
          ],
        },
        fallbackOutput: 1,
      };

    default:
      if (type.startsWith('n8n-nodes-base.')) {
        return config;
      }
      return config;
  }
}

function mapConditionOperator(operator?: string): string {
  const operatorMap: Record<string, string> = {
    'equals': 'equals',
    'notEquals': 'notEquals',
    'contains': 'contains',
    'greaterThan': 'larger',
    'lessThan': 'smaller',
    'isEmpty': 'isEmpty',
    'isNotEmpty': 'isNotEmpty',
  };
  return operatorMap[operator || 'equals'] || 'equals';
}

export function transformN8nResultToNanoFlow(
  n8nExecution: {
    id: string;
    finished: boolean;
    status: string;
    data?: {
      resultData?: {
        runData?: Record<string, Array<{ data: { main: Array<Array<{ json: unknown }>> } }>>;
      };
    };
    startedAt: string;
    stoppedAt?: string;
  },
  nodeIdToName: Map<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    executionId: n8nExecution.id,
    status: n8nExecution.status,
    finished: n8nExecution.finished,
    startedAt: n8nExecution.startedAt,
    stoppedAt: n8nExecution.stoppedAt,
    nodeOutputs: {} as Record<string, unknown>,
  };

  const runData = n8nExecution.data?.resultData?.runData;
  if (runData) {
    const nodeOutputs: Record<string, unknown> = {};
    const nameToId = new Map<string, string>();
    nodeIdToName.forEach((name, id) => nameToId.set(name, id));

    for (const [nodeName, executions] of Object.entries(runData)) {
      const nodeId = nameToId.get(nodeName) || nodeName;
      const lastExecution = executions[executions.length - 1];
      
      if (lastExecution?.data?.main?.[0]) {
        const items = lastExecution.data.main[0].map(item => item.json);
        nodeOutputs[nodeId] = items.length === 1 ? items[0] : items;
      }
    }
    result.nodeOutputs = nodeOutputs;
  }

  return result;
}
