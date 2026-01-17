/**
 * Script to add properties to core node types
 * Run with: npx ts-node src/scripts/add-node-properties.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define properties for core nodes (use correct type names from database)
const NODE_PROPERTIES: Record<string, any[]> = {
    'n8n-nodes-base.HttpRequest': [
        {
            name: 'method',
            displayName: 'Method',
            type: 'options',
            default: 'GET',
            description: 'HTTP method to use',
            options: [
                { name: 'GET', value: 'GET' },
                { name: 'POST', value: 'POST' },
                { name: 'PUT', value: 'PUT' },
                { name: 'DELETE', value: 'DELETE' },
                { name: 'PATCH', value: 'PATCH' },
                { name: 'HEAD', value: 'HEAD' },
            ],
        },
        {
            name: 'url',
            displayName: 'URL',
            type: 'string',
            default: '',
            description: 'The URL to make the request to',
            typeOptions: { expression: true },
        },
        {
            name: 'authentication',
            displayName: 'Authentication',
            type: 'options',
            default: 'none',
            options: [
                { name: 'None', value: 'none' },
                { name: 'Basic Auth', value: 'basicAuth' },
                { name: 'Bearer Token', value: 'bearerToken' },
                { name: 'API Key', value: 'apiKey' },
            ],
        },
        {
            name: 'headers',
            displayName: 'Headers',
            type: 'string',
            default: '{}',
            description: 'Headers as JSON object',
            typeOptions: { rows: 3, expression: true },
        },
        {
            name: 'body',
            displayName: 'Body',
            type: 'string',
            default: '',
            description: 'Request body (for POST/PUT/PATCH)',
            typeOptions: { rows: 5, expression: true },
        },
        {
            name: 'timeout',
            displayName: 'Timeout (ms)',
            type: 'number',
            default: 30000,
            description: 'Request timeout in milliseconds',
        },
    ],

    'n8n-nodes-base.Code': [
        {
            name: 'language',
            displayName: 'Language',
            type: 'options',
            default: 'javascript',
            options: [
                { name: 'JavaScript', value: 'javascript' },
                { name: 'Python', value: 'python' },
            ],
        },
        {
            name: 'code',
            displayName: 'Code',
            type: 'string',
            default: '// Write your code here\nreturn items;',
            description: 'The code to execute',
            typeOptions: { rows: 15, expression: false },
        },
    ],

    'n8n-nodes-base.If': [
        {
            name: 'conditions',
            displayName: 'Conditions',
            type: 'string',
            default: '',
            description: 'Condition expression to evaluate',
            typeOptions: { expression: true },
        },
        {
            name: 'combineOperation',
            displayName: 'Combine',
            type: 'options',
            default: 'all',
            options: [
                { name: 'All (AND)', value: 'all' },
                { name: 'Any (OR)', value: 'any' },
            ],
        },
    ],

    'n8n-nodes-base.Set': [
        {
            name: 'mode',
            displayName: 'Mode',
            type: 'options',
            default: 'manual',
            options: [
                { name: 'Manual', value: 'manual' },
                { name: 'JSON', value: 'json' },
            ],
        },
        {
            name: 'values',
            displayName: 'Values',
            type: 'string',
            default: '{}',
            description: 'Values to set as JSON',
            typeOptions: { rows: 5, expression: true },
        },
        {
            name: 'keepOnlySet',
            displayName: 'Keep Only Set',
            type: 'boolean',
            default: false,
            description: 'Only keep the values that are set, remove all others',
        },
    ],

    'n8n-nodes-base.Merge': [
        {
            name: 'mode',
            displayName: 'Mode',
            type: 'options',
            default: 'append',
            options: [
                { name: 'Append', value: 'append' },
                { name: 'Merge By Key', value: 'mergeByKey' },
                { name: 'Merge By Position', value: 'mergeByPosition' },
                { name: 'Keep Key Matches', value: 'keepKeyMatches' },
            ],
        },
        {
            name: 'joinMode',
            displayName: 'Join Mode',
            type: 'options',
            default: 'inner',
            options: [
                { name: 'Inner Join', value: 'inner' },
                { name: 'Left Join', value: 'left' },
                { name: 'Outer Join', value: 'outer' },
            ],
        },
        {
            name: 'propertyName',
            displayName: 'Property Name',
            type: 'string',
            default: 'id',
            description: 'Property to match on',
        },
    ],

    'n8n-nodes-base.Webhook': [
        {
            name: 'httpMethod',
            displayName: 'HTTP Method',
            type: 'options',
            default: 'POST',
            options: [
                { name: 'GET', value: 'GET' },
                { name: 'POST', value: 'POST' },
                { name: 'PUT', value: 'PUT' },
                { name: 'DELETE', value: 'DELETE' },
            ],
        },
        {
            name: 'path',
            displayName: 'Path',
            type: 'string',
            default: '/webhook',
            description: 'The path to listen on',
        },
        {
            name: 'responseMode',
            displayName: 'Response Mode',
            type: 'options',
            default: 'onReceived',
            options: [
                { name: 'On Received', value: 'onReceived' },
                { name: 'Last Node', value: 'lastNode' },
                { name: 'Custom Response', value: 'customResponse' },
            ],
        },
    ],

    'n8n-nodes-base.ScheduleTrigger': [
        {
            name: 'rule',
            displayName: 'Trigger Rule',
            type: 'options',
            default: 'interval',
            options: [
                { name: 'Interval', value: 'interval' },
                { name: 'Cron', value: 'cron' },
            ],
        },
        {
            name: 'interval',
            displayName: 'Interval (minutes)',
            type: 'number',
            default: 60,
            description: 'Trigger every N minutes',
        },
        {
            name: 'cronExpression',
            displayName: 'Cron Expression',
            type: 'string',
            default: '0 * * * *',
            description: 'Cron expression for scheduling',
        },
    ],

    'n8n-nodes-base.Function': [
        {
            name: 'functionCode',
            displayName: 'JavaScript Code',
            type: 'string',
            default: '// Process items\nreturn items;',
            description: 'JavaScript code to execute',
            typeOptions: { rows: 15 },
        },
    ],

    'n8n-nodes-base.NoOp': [],

    'n8n-nodes-base.Start': [],

    'n8n-nodes-base.ManualTrigger': [],

    'n8n-nodes-base.Agent': [
        {
            name: 'promptType',
            displayName: 'Prompt Type',
            type: 'options',
            default: 'define',
            options: [
                { name: 'Define Below', value: 'define' },
                { name: 'Use System Message', value: 'system' },
            ],
        },
        {
            name: 'text',
            displayName: 'Prompt',
            type: 'string',
            default: '',
            description: 'The prompt to send to the agent',
            typeOptions: { rows: 5, expression: true },
        },
        {
            name: 'systemMessage',
            displayName: 'System Message',
            type: 'string',
            default: 'You are a helpful assistant.',
            description: 'System message for the agent',
            typeOptions: { rows: 3 },
        },
        {
            name: 'maxIterations',
            displayName: 'Max Iterations',
            type: 'number',
            default: 10,
            description: 'Maximum number of iterations',
        },
    ],

    'n8n-nodes-base.LmChatOpenAi': [
        {
            name: 'model',
            displayName: 'Model',
            type: 'options',
            default: 'gpt-4',
            options: [
                { name: 'GPT-4', value: 'gpt-4' },
                { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
                { name: 'GPT-4o', value: 'gpt-4o' },
                { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
                { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
            ],
        },
        {
            name: 'temperature',
            displayName: 'Temperature',
            type: 'number',
            default: 0.7,
            description: 'Sampling temperature (0-2)',
        },
        {
            name: 'maxTokens',
            displayName: 'Max Tokens',
            type: 'number',
            default: 4096,
            description: 'Maximum tokens in response',
        },
    ],

    'n8n-nodes-base.LmChatAnthropic': [
        {
            name: 'model',
            displayName: 'Model',
            type: 'options',
            default: 'claude-3-5-sonnet-20241022',
            options: [
                { name: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
                { name: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
                { name: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
                { name: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
            ],
        },
        {
            name: 'temperature',
            displayName: 'Temperature',
            type: 'number',
            default: 0.7,
            description: 'Sampling temperature (0-1)',
        },
        {
            name: 'maxTokens',
            displayName: 'Max Tokens',
            type: 'number',
            default: 4096,
            description: 'Maximum tokens in response',
        },
    ],
};

// Subtitles for nodes (cleaned, no expressions)
const NODE_SUBTITLES: Record<string, { en: string; es: string }> = {
    'n8n-nodes-base.HttpRequest': { en: 'HTTP Request', es: 'Petición HTTP' },
    'n8n-nodes-base.Code': { en: 'Custom Code', es: 'Código Personalizado' },
    'n8n-nodes-base.If': { en: 'Conditional', es: 'Condicional' },
    'n8n-nodes-base.Set': { en: 'Set Values', es: 'Establecer Valores' },
    'n8n-nodes-base.Merge': { en: 'Merge Data', es: 'Combinar Datos' },
    'n8n-nodes-base.Webhook': { en: 'Webhook Trigger', es: 'Disparador Webhook' },
    'n8n-nodes-base.ScheduleTrigger': { en: 'Schedule', es: 'Programado' },
    'n8n-nodes-base.Function': { en: 'Function', es: 'Función' },
    'n8n-nodes-base.NoOp': { en: 'No Operation', es: 'Sin Operación' },
    'n8n-nodes-base.Start': { en: 'Start', es: 'Inicio' },
    'n8n-nodes-base.ManualTrigger': { en: 'Manual Trigger', es: 'Disparador Manual' },
    'n8n-nodes-base.Agent': { en: 'AI Agent', es: 'Agente IA' },
    'n8n-nodes-base.LmChatOpenAi': { en: 'OpenAI Chat', es: 'Chat OpenAI' },
    'n8n-nodes-base.LmChatAnthropic': { en: 'Anthropic Claude', es: 'Anthropic Claude' },
};

async function main() {
    console.log('Starting node properties update...\n');

    for (const [nodeType, properties] of Object.entries(NODE_PROPERTIES)) {
        try {
            const subtitle = NODE_SUBTITLES[nodeType];
            const updateData: any = { properties };

            if (subtitle) {
                updateData.subtitle = subtitle;
            }

            const result = await prisma.nodeType.updateMany({
                where: { type: nodeType },
                data: updateData,
            });

            if (result.count > 0) {
                console.log(`✅ Updated ${nodeType} with ${properties.length} properties`);
            } else {
                console.log(`⚠️  Node type ${nodeType} not found in database`);
            }
        } catch (error) {
            console.error(`❌ Error updating ${nodeType}:`, error);
        }
    }

    // Clean up expression subtitles for all other nodes
    console.log('\nCleaning expression subtitles...');

    const nodesWithExpressions = await prisma.nodeType.findMany({
        where: {
            OR: [
                { subtitle: { path: ['en'], string_contains: '={{' } },
                { subtitle: { path: ['es'], string_contains: '={{' } },
            ]
        }
    });

    for (const node of nodesWithExpressions) {
        const typeName = node.type.split('.').pop() || node.type;
        const cleanSubtitle = {
            en: typeName.replace(/([A-Z])/g, ' $1').trim(),
            es: typeName.replace(/([A-Z])/g, ' $1').trim(),
        };

        await prisma.nodeType.update({
            where: { id: node.id },
            data: { subtitle: cleanSubtitle },
        });

        console.log(`  Cleaned subtitle for ${node.type}`);
    }

    console.log('\n✅ Node properties update complete!');
    await prisma.$disconnect();
}

main().catch(console.error);
