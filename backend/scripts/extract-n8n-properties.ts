/**
 * Script para generar properties de nodos para NanoFlow
 * Uso: npx ts-node scripts/extract-n8n-properties.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_PATH = path.join(__dirname, '../prisma/seed-nodes-with-properties.ts');

interface NanoFlowProperty {
    name: string;
    displayName: string;
    type: 'string' | 'number' | 'boolean' | 'options' | 'collection' | 'json' | 'color' | 'dateTime';
    default?: any;
    description?: string;
    required?: boolean;
    options?: Array<{ name: string; value: string | number | boolean; description?: string }>;
    typeOptions?: {
        rows?: number;
        expression?: boolean;
        password?: boolean;
        multiline?: boolean;
    };
    displayOptions?: {
        show?: Record<string, any[]>;
        hide?: Record<string, any[]>;
    };
}

// Colores por categoria
const CATEGORY_COLORS: Record<string, string> = {
    'triggers': 'bg-green-500',
    'core': 'bg-blue-500',
    'flow': 'bg-yellow-500',
    'ai': 'bg-rose-500',
    'data': 'bg-purple-500',
    'communication': 'bg-indigo-500',
    'productivity': 'bg-teal-500',
    'storage': 'bg-orange-500',
    'marketing': 'bg-pink-500',
    'developer': 'bg-gray-600',
    'payment': 'bg-emerald-500',
    'social': 'bg-sky-500',
};

// Nodos prioritarios con properties completas
const PRIORITY_NODES: Record<string, { category: string; icon: string; label: string; description: string; properties: NanoFlowProperty[]; outputs?: Array<{ name: string; type: string }> }> = {
    'n8n-nodes-base.httpRequest': {
        category: 'core',
        icon: 'Globe',
        label: 'HTTP Request',
        description: 'Make HTTP requests to any API',
        properties: [
            { name: 'method', displayName: 'Method', type: 'options', default: 'GET', options: [{ name: 'GET', value: 'GET' }, { name: 'POST', value: 'POST' }, { name: 'PUT', value: 'PUT' }, { name: 'PATCH', value: 'PATCH' }, { name: 'DELETE', value: 'DELETE' }, { name: 'HEAD', value: 'HEAD' }] },
            { name: 'url', displayName: 'URL', type: 'string', default: '', required: true, typeOptions: { expression: true } },
            { name: 'authentication', displayName: 'Authentication', type: 'options', default: 'none', options: [{ name: 'None', value: 'none' }, { name: 'Basic Auth', value: 'basicAuth' }, { name: 'Header Auth', value: 'headerAuth' }, { name: 'OAuth2', value: 'oAuth2' }] },
            { name: 'sendBody', displayName: 'Send Body', type: 'boolean', default: false },
            { name: 'bodyType', displayName: 'Body Type', type: 'options', default: 'json', options: [{ name: 'JSON', value: 'json' }, { name: 'Form Data', value: 'formData' }, { name: 'Raw', value: 'raw' }], displayOptions: { show: { sendBody: [true] } } },
            { name: 'body', displayName: 'Body', type: 'json', default: '{}', typeOptions: { rows: 5, expression: true }, displayOptions: { show: { sendBody: [true] } } },
            { name: 'sendHeaders', displayName: 'Send Headers', type: 'boolean', default: false },
            { name: 'headers', displayName: 'Headers', type: 'json', default: '{}', displayOptions: { show: { sendHeaders: [true] } } },
            { name: 'timeout', displayName: 'Timeout (ms)', type: 'number', default: 30000 },
        ]
    },

    'n8n-nodes-base.webhook': {
        category: 'triggers',
        icon: 'Webhook',
        label: 'Webhook',
        description: 'Starts workflow on HTTP request',
        properties: [
            { name: 'httpMethod', displayName: 'HTTP Method', type: 'options', default: 'GET', options: [{ name: 'GET', value: 'GET' }, { name: 'POST', value: 'POST' }, { name: 'PUT', value: 'PUT' }, { name: 'DELETE', value: 'DELETE' }] },
            { name: 'path', displayName: 'Path', type: 'string', default: 'webhook', required: true },
            { name: 'authentication', displayName: 'Authentication', type: 'options', default: 'none', options: [{ name: 'None', value: 'none' }, { name: 'Basic Auth', value: 'basicAuth' }, { name: 'Header Auth', value: 'headerAuth' }] },
            { name: 'responseMode', displayName: 'Response Mode', type: 'options', default: 'onReceived', options: [{ name: 'When Received', value: 'onReceived' }, { name: 'Last Node', value: 'lastNode' }, { name: 'Custom', value: 'responseNode' }] },
            { name: 'responseCode', displayName: 'Response Code', type: 'number', default: 200 },
        ]
    },

    'n8n-nodes-base.scheduleTrigger': {
        category: 'triggers',
        icon: 'Clock',
        label: 'Schedule Trigger',
        description: 'Starts workflow on a schedule',
        properties: [
            { name: 'rule', displayName: 'Trigger Interval', type: 'options', default: 'minutes', options: [{ name: 'Seconds', value: 'seconds' }, { name: 'Minutes', value: 'minutes' }, { name: 'Hours', value: 'hours' }, { name: 'Days', value: 'days' }, { name: 'Weeks', value: 'weeks' }, { name: 'Cron', value: 'cronExpression' }] },
            { name: 'intervalValue', displayName: 'Interval', type: 'number', default: 1 },
            { name: 'cronExpression', displayName: 'Cron Expression', type: 'string', default: '0 * * * *', displayOptions: { show: { rule: ['cronExpression'] } } },
        ]
    },

    'n8n-nodes-base.if': {
        category: 'flow',
        icon: 'GitBranch',
        label: 'IF',
        description: 'Conditional routing (true/false)',
        outputs: [{ name: 'true', type: 'main' }, { name: 'false', type: 'main' }],
        properties: [
            { name: 'conditions', displayName: 'Conditions', type: 'collection', default: {} },
            { name: 'combineOperation', displayName: 'Combine', type: 'options', default: 'all', options: [{ name: 'ALL (AND)', value: 'all' }, { name: 'ANY (OR)', value: 'any' }] },
        ]
    },

    'n8n-nodes-base.switch': {
        category: 'flow',
        icon: 'List',
        label: 'Switch',
        description: 'Route to multiple outputs based on value',
        outputs: [{ name: '0', type: 'main' }, { name: '1', type: 'main' }, { name: '2', type: 'main' }, { name: '3', type: 'main' }],
        properties: [
            { name: 'mode', displayName: 'Mode', type: 'options', default: 'rules', options: [{ name: 'Rules', value: 'rules' }, { name: 'Expression', value: 'expression' }] },
            { name: 'expression', displayName: 'Expression', type: 'string', default: '', typeOptions: { rows: 3, expression: true }, displayOptions: { show: { mode: ['expression'] } } },
            { name: 'fallbackOutput', displayName: 'Fallback Output', type: 'options', default: 'none', options: [{ name: 'None', value: 'none' }, { name: 'Extra Output', value: 'extra' }] },
        ]
    },

    'n8n-nodes-base.code': {
        category: 'core',
        icon: 'Code',
        label: 'Code',
        description: 'Run custom JavaScript or Python',
        properties: [
            { name: 'language', displayName: 'Language', type: 'options', default: 'javaScript', options: [{ name: 'JavaScript', value: 'javaScript' }, { name: 'Python', value: 'python' }] },
            { name: 'jsCode', displayName: 'JavaScript Code', type: 'string', default: '// Add your code here\nreturn items;', typeOptions: { rows: 10 }, displayOptions: { show: { language: ['javaScript'] } } },
            { name: 'pythonCode', displayName: 'Python Code', type: 'string', default: '# Add your code here\nreturn items', typeOptions: { rows: 10 }, displayOptions: { show: { language: ['python'] } } },
        ]
    },

    'n8n-nodes-base.set': {
        category: 'core',
        icon: 'Edit',
        label: 'Set',
        description: 'Set values and variables',
        properties: [
            { name: 'mode', displayName: 'Mode', type: 'options', default: 'manual', options: [{ name: 'Manual', value: 'manual' }, { name: 'Raw JSON', value: 'raw' }] },
            { name: 'assignments', displayName: 'Assignments', type: 'collection', default: {}, displayOptions: { show: { mode: ['manual'] } } },
            { name: 'jsonOutput', displayName: 'JSON', type: 'json', default: '{}', typeOptions: { rows: 5 }, displayOptions: { show: { mode: ['raw'] } } },
            { name: 'includeOtherFields', displayName: 'Include Other Input Fields', type: 'boolean', default: false },
        ]
    },

    'n8n-nodes-base.merge': {
        category: 'flow',
        icon: 'GitMerge',
        label: 'Merge',
        description: 'Merge multiple inputs',
        properties: [
            { name: 'mode', displayName: 'Mode', type: 'options', default: 'append', options: [{ name: 'Append', value: 'append' }, { name: 'Combine', value: 'combine' }, { name: 'Choose Branch', value: 'chooseBranch' }] },
            { name: 'combinationMode', displayName: 'Combination Mode', type: 'options', default: 'mergeByPosition', options: [{ name: 'Merge By Position', value: 'mergeByPosition' }, { name: 'Merge By Fields', value: 'mergeByFields' }, { name: 'Multiplex', value: 'multiplex' }], displayOptions: { show: { mode: ['combine'] } } },
        ]
    },

    'n8n-nodes-base.wait': {
        category: 'flow',
        icon: 'Clock',
        label: 'Wait',
        description: 'Pause workflow execution',
        properties: [
            { name: 'resume', displayName: 'Resume', type: 'options', default: 'timeInterval', options: [{ name: 'After Time Interval', value: 'timeInterval' }, { name: 'At Specified Time', value: 'specificTime' }, { name: 'On Webhook Call', value: 'webhook' }] },
            { name: 'amount', displayName: 'Wait Amount', type: 'number', default: 1, displayOptions: { show: { resume: ['timeInterval'] } } },
            { name: 'unit', displayName: 'Wait Unit', type: 'options', default: 'seconds', options: [{ name: 'Seconds', value: 'seconds' }, { name: 'Minutes', value: 'minutes' }, { name: 'Hours', value: 'hours' }, { name: 'Days', value: 'days' }], displayOptions: { show: { resume: ['timeInterval'] } } },
        ]
    },

    'n8n-nodes-base.filter': {
        category: 'flow',
        icon: 'Filter',
        label: 'Filter',
        description: 'Filter items based on conditions',
        properties: [
            { name: 'conditions', displayName: 'Conditions', type: 'collection', default: {} },
            { name: 'combineOperation', displayName: 'Combine', type: 'options', default: 'all', options: [{ name: 'AND', value: 'all' }, { name: 'OR', value: 'any' }] },
        ]
    },

    'n8n-nodes-base.openAi': {
        category: 'ai',
        icon: 'MessageSquare',
        label: 'OpenAI',
        description: 'Interact with OpenAI GPT models',
        properties: [
            { name: 'resource', displayName: 'Resource', type: 'options', default: 'chat', options: [{ name: 'Chat', value: 'chat' }, { name: 'Image', value: 'image' }, { name: 'Audio', value: 'audio' }, { name: 'Embedding', value: 'embedding' }] },
            { name: 'model', displayName: 'Model', type: 'options', default: 'gpt-4o-mini', options: [{ name: 'GPT-4o', value: 'gpt-4o' }, { name: 'GPT-4o Mini', value: 'gpt-4o-mini' }, { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' }, { name: 'GPT-4', value: 'gpt-4' }, { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }], displayOptions: { show: { resource: ['chat'] } } },
            { name: 'prompt', displayName: 'Prompt', type: 'string', default: '', required: true, typeOptions: { rows: 5, expression: true }, displayOptions: { show: { resource: ['chat'] } } },
            { name: 'systemMessage', displayName: 'System Message', type: 'string', default: '', typeOptions: { rows: 3, expression: true }, displayOptions: { show: { resource: ['chat'] } } },
            { name: 'temperature', displayName: 'Temperature', type: 'number', default: 0.7, description: '0 = deterministic, 1 = creative' },
            { name: 'maxTokens', displayName: 'Max Tokens', type: 'number', default: 1024 },
        ]
    },

    'n8n-nodes-base.anthropic': {
        category: 'ai',
        icon: 'MessageSquare',
        label: 'Anthropic',
        description: 'Use Claude AI models',
        properties: [
            { name: 'model', displayName: 'Model', type: 'options', default: 'claude-3-5-sonnet-20241022', options: [{ name: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' }, { name: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' }, { name: 'Claude 3 Opus', value: 'claude-3-opus-20240229' }, { name: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' }, { name: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' }] },
            { name: 'prompt', displayName: 'Prompt', type: 'string', default: '', required: true, typeOptions: { rows: 5, expression: true } },
            { name: 'systemMessage', displayName: 'System Message', type: 'string', default: '', typeOptions: { rows: 3, expression: true } },
            { name: 'temperature', displayName: 'Temperature', type: 'number', default: 0.7 },
            { name: 'maxTokens', displayName: 'Max Tokens', type: 'number', default: 1024 },
        ]
    },

    'n8n-nodes-base.slack': {
        category: 'communication',
        icon: 'Hash',
        label: 'Slack',
        description: 'Send messages to Slack',
        properties: [
            { name: 'resource', displayName: 'Resource', type: 'options', default: 'message', options: [{ name: 'Message', value: 'message' }, { name: 'Channel', value: 'channel' }, { name: 'User', value: 'user' }, { name: 'File', value: 'file' }] },
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'send', options: [{ name: 'Send', value: 'send' }, { name: 'Update', value: 'update' }, { name: 'Delete', value: 'delete' }], displayOptions: { show: { resource: ['message'] } } },
            { name: 'channel', displayName: 'Channel', type: 'string', default: '', required: true, displayOptions: { show: { resource: ['message'] } } },
            { name: 'text', displayName: 'Message Text', type: 'string', default: '', typeOptions: { rows: 3, expression: true }, displayOptions: { show: { resource: ['message'], operation: ['send'] } } },
        ]
    },

    'n8n-nodes-base.telegram': {
        category: 'communication',
        icon: 'Send',
        label: 'Telegram',
        description: 'Send messages via Telegram',
        properties: [
            { name: 'resource', displayName: 'Resource', type: 'options', default: 'message', options: [{ name: 'Message', value: 'message' }, { name: 'Chat', value: 'chat' }, { name: 'Callback Query', value: 'callback' }] },
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'sendMessage', options: [{ name: 'Send Text Message', value: 'sendMessage' }, { name: 'Send Photo', value: 'sendPhoto' }, { name: 'Send Document', value: 'sendDocument' }], displayOptions: { show: { resource: ['message'] } } },
            { name: 'chatId', displayName: 'Chat ID', type: 'string', default: '', required: true, typeOptions: { expression: true } },
            { name: 'text', displayName: 'Text', type: 'string', default: '', typeOptions: { rows: 3, expression: true }, displayOptions: { show: { operation: ['sendMessage'] } } },
            { name: 'parseMode', displayName: 'Parse Mode', type: 'options', default: 'Markdown', options: [{ name: 'Markdown', value: 'Markdown' }, { name: 'HTML', value: 'HTML' }, { name: 'None', value: 'none' }] },
        ]
    },

    'n8n-nodes-base.postgres': {
        category: 'storage',
        icon: 'Database',
        label: 'PostgreSQL',
        description: 'Query PostgreSQL databases',
        properties: [
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'executeQuery', options: [{ name: 'Execute Query', value: 'executeQuery' }, { name: 'Insert', value: 'insert' }, { name: 'Update', value: 'update' }, { name: 'Delete', value: 'delete' }] },
            { name: 'query', displayName: 'Query', type: 'string', default: 'SELECT * FROM table_name LIMIT 100', typeOptions: { rows: 5, expression: true }, displayOptions: { show: { operation: ['executeQuery'] } } },
            { name: 'schema', displayName: 'Schema', type: 'string', default: 'public' },
            { name: 'table', displayName: 'Table', type: 'string', default: '', displayOptions: { show: { operation: ['insert', 'update', 'delete'] } } },
        ]
    },

    'n8n-nodes-base.mySql': {
        category: 'storage',
        icon: 'Database',
        label: 'MySQL',
        description: 'Query MySQL databases',
        properties: [
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'executeQuery', options: [{ name: 'Execute Query', value: 'executeQuery' }, { name: 'Insert', value: 'insert' }, { name: 'Update', value: 'update' }, { name: 'Delete', value: 'delete' }] },
            { name: 'query', displayName: 'Query', type: 'string', default: 'SELECT * FROM table_name LIMIT 100', typeOptions: { rows: 5, expression: true }, displayOptions: { show: { operation: ['executeQuery'] } } },
            { name: 'table', displayName: 'Table', type: 'string', default: '', displayOptions: { show: { operation: ['insert', 'update', 'delete'] } } },
        ]
    },

    'n8n-nodes-base.mongoDb': {
        category: 'storage',
        icon: 'Database',
        label: 'MongoDB',
        description: 'Query MongoDB databases',
        properties: [
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'find', options: [{ name: 'Find', value: 'find' }, { name: 'Insert', value: 'insert' }, { name: 'Update', value: 'update' }, { name: 'Delete', value: 'delete' }, { name: 'Aggregate', value: 'aggregate' }] },
            { name: 'collection', displayName: 'Collection', type: 'string', default: '', required: true },
            { name: 'query', displayName: 'Query', type: 'json', default: '{}', typeOptions: { rows: 5 }, displayOptions: { show: { operation: ['find', 'update', 'delete'] } } },
            { name: 'limit', displayName: 'Limit', type: 'number', default: 100, displayOptions: { show: { operation: ['find'] } } },
        ]
    },

    'n8n-nodes-base.googleSheets': {
        category: 'productivity',
        icon: 'Table',
        label: 'Google Sheets',
        description: 'Read and write Google Sheets',
        properties: [
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'read', options: [{ name: 'Read Rows', value: 'read' }, { name: 'Append Row', value: 'append' }, { name: 'Update Row', value: 'update' }, { name: 'Delete Row', value: 'delete' }, { name: 'Clear', value: 'clear' }] },
            { name: 'spreadsheetId', displayName: 'Spreadsheet ID', type: 'string', default: '', required: true },
            { name: 'sheetName', displayName: 'Sheet Name', type: 'string', default: 'Sheet1' },
            { name: 'range', displayName: 'Range', type: 'string', default: 'A:Z' },
        ]
    },

    'n8n-nodes-base.dateTime': {
        category: 'core',
        icon: 'Calendar',
        label: 'Date & Time',
        description: 'Manipulate date and time values',
        properties: [
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'format', options: [{ name: 'Format Date', value: 'format' }, { name: 'Add/Subtract', value: 'calculate' }, { name: 'Get Current Date', value: 'now' }, { name: 'Parse Date', value: 'parse' }] },
            { name: 'date', displayName: 'Date', type: 'string', default: '', typeOptions: { expression: true } },
            { name: 'format', displayName: 'Format', type: 'string', default: 'YYYY-MM-DD HH:mm:ss', displayOptions: { show: { operation: ['format'] } } },
            { name: 'timezone', displayName: 'Timezone', type: 'string', default: 'UTC' },
        ]
    },

    'n8n-nodes-base.crypto': {
        category: 'core',
        icon: 'Lock',
        label: 'Crypto',
        description: 'Hash, encrypt, and sign data',
        properties: [
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'hash', options: [{ name: 'Hash', value: 'hash' }, { name: 'HMAC', value: 'hmac' }, { name: 'Encrypt', value: 'encrypt' }, { name: 'Decrypt', value: 'decrypt' }, { name: 'Sign', value: 'sign' }] },
            { name: 'algorithm', displayName: 'Algorithm', type: 'options', default: 'SHA256', options: [{ name: 'MD5', value: 'MD5' }, { name: 'SHA1', value: 'SHA1' }, { name: 'SHA256', value: 'SHA256' }, { name: 'SHA384', value: 'SHA384' }, { name: 'SHA512', value: 'SHA512' }], displayOptions: { show: { operation: ['hash', 'hmac'] } } },
            { name: 'value', displayName: 'Value', type: 'string', default: '', required: true, typeOptions: { expression: true } },
            { name: 'secret', displayName: 'Secret', type: 'string', default: '', typeOptions: { password: true }, displayOptions: { show: { operation: ['hmac', 'encrypt', 'decrypt'] } } },
            { name: 'encoding', displayName: 'Encoding', type: 'options', default: 'hex', options: [{ name: 'Hex', value: 'hex' }, { name: 'Base64', value: 'base64' }] },
        ]
    },

    'n8n-nodes-base.executeWorkflow': {
        category: 'core',
        icon: 'Play',
        label: 'Execute Workflow',
        description: 'Run another workflow',
        properties: [
            { name: 'source', displayName: 'Source', type: 'options', default: 'database', options: [{ name: 'From Database', value: 'database' }, { name: 'From URL', value: 'url' }, { name: 'From File', value: 'localFile' }] },
            { name: 'workflowId', displayName: 'Workflow ID', type: 'string', default: '', displayOptions: { show: { source: ['database'] } } },
            { name: 'waitForCompletion', displayName: 'Wait for Completion', type: 'boolean', default: true },
        ]
    },

    'n8n-nodes-base.splitInBatches': {
        category: 'flow',
        icon: 'Repeat',
        label: 'Split In Batches',
        description: 'Loop over items in batches',
        outputs: [{ name: 'loop', type: 'main' }, { name: 'done', type: 'main' }],
        properties: [
            { name: 'batchSize', displayName: 'Batch Size', type: 'number', default: 10 },
        ]
    },

    'n8n-nodes-base.emailSend': {
        category: 'communication',
        icon: 'Mail',
        label: 'Send Email',
        description: 'Send emails via SMTP',
        properties: [
            { name: 'fromEmail', displayName: 'From Email', type: 'string', default: '', required: true },
            { name: 'toEmail', displayName: 'To Email', type: 'string', default: '', required: true, typeOptions: { expression: true } },
            { name: 'subject', displayName: 'Subject', type: 'string', default: '', typeOptions: { expression: true } },
            { name: 'text', displayName: 'Text', type: 'string', default: '', typeOptions: { rows: 5, expression: true } },
            { name: 'html', displayName: 'HTML', type: 'string', default: '', typeOptions: { rows: 5, expression: true } },
        ]
    },

    'n8n-nodes-base.respondToWebhook': {
        category: 'flow',
        icon: 'CornerUpLeft',
        label: 'Respond to Webhook',
        description: 'Send response back to webhook caller',
        properties: [
            { name: 'respondWith', displayName: 'Respond With', type: 'options', default: 'text', options: [{ name: 'Text', value: 'text' }, { name: 'JSON', value: 'json' }, { name: 'Binary', value: 'binary' }, { name: 'Redirect', value: 'redirect' }] },
            { name: 'responseBody', displayName: 'Response Body', type: 'string', default: '', typeOptions: { rows: 3, expression: true }, displayOptions: { show: { respondWith: ['text'] } } },
            { name: 'responseCode', displayName: 'Response Code', type: 'number', default: 200 },
            { name: 'responseHeaders', displayName: 'Response Headers', type: 'json', default: '{}' },
        ]
    },

    'n8n-nodes-base.discord': {
        category: 'communication',
        icon: 'MessageSquare',
        label: 'Discord',
        description: 'Send messages to Discord',
        properties: [
            { name: 'resource', displayName: 'Resource', type: 'options', default: 'message', options: [{ name: 'Message', value: 'message' }, { name: 'Channel', value: 'channel' }] },
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'send', options: [{ name: 'Send', value: 'send' }, { name: 'Edit', value: 'edit' }, { name: 'Delete', value: 'delete' }], displayOptions: { show: { resource: ['message'] } } },
            { name: 'channelId', displayName: 'Channel ID', type: 'string', default: '', required: true },
            { name: 'content', displayName: 'Content', type: 'string', default: '', typeOptions: { rows: 3, expression: true } },
        ]
    },

    'n8n-nodes-base.notion': {
        category: 'productivity',
        icon: 'FileText',
        label: 'Notion',
        description: 'Manage Notion pages and databases',
        properties: [
            { name: 'resource', displayName: 'Resource', type: 'options', default: 'page', options: [{ name: 'Page', value: 'page' }, { name: 'Database', value: 'database' }, { name: 'Block', value: 'block' }] },
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'get', options: [{ name: 'Get', value: 'get' }, { name: 'Create', value: 'create' }, { name: 'Update', value: 'update' }, { name: 'Search', value: 'search' }] },
            { name: 'pageId', displayName: 'Page ID', type: 'string', default: '' },
            { name: 'databaseId', displayName: 'Database ID', type: 'string', default: '' },
        ]
    },

    'n8n-nodes-base.airtable': {
        category: 'productivity',
        icon: 'Grid',
        label: 'Airtable',
        description: 'Manage Airtable records',
        properties: [
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'list', options: [{ name: 'List', value: 'list' }, { name: 'Get', value: 'get' }, { name: 'Create', value: 'create' }, { name: 'Update', value: 'update' }, { name: 'Delete', value: 'delete' }] },
            { name: 'baseId', displayName: 'Base ID', type: 'string', default: '', required: true },
            { name: 'tableId', displayName: 'Table ID', type: 'string', default: '', required: true },
            { name: 'recordId', displayName: 'Record ID', type: 'string', default: '', displayOptions: { show: { operation: ['get', 'update', 'delete'] } } },
        ]
    },

    'n8n-nodes-base.github': {
        category: 'developer',
        icon: 'GitBranch',
        label: 'GitHub',
        description: 'Interact with GitHub repositories',
        properties: [
            { name: 'resource', displayName: 'Resource', type: 'options', default: 'repository', options: [{ name: 'Repository', value: 'repository' }, { name: 'Issue', value: 'issue' }, { name: 'Pull Request', value: 'pullRequest' }, { name: 'File', value: 'file' }] },
            { name: 'operation', displayName: 'Operation', type: 'options', default: 'get', options: [{ name: 'Get', value: 'get' }, { name: 'List', value: 'list' }, { name: 'Create', value: 'create' }] },
            { name: 'owner', displayName: 'Owner', type: 'string', default: '', required: true },
            { name: 'repository', displayName: 'Repository', type: 'string', default: '', required: true },
        ]
    },

    'n8n-nodes-base.manualTrigger': {
        category: 'triggers',
        icon: 'Play',
        label: 'Manual Trigger',
        description: 'Start workflow manually',
        properties: []
    },

    'n8n-nodes-base.formTrigger': {
        category: 'triggers',
        icon: 'ClipboardList',
        label: 'Form Trigger',
        description: 'Start workflow on form submission',
        properties: [
            { name: 'formTitle', displayName: 'Form Title', type: 'string', default: 'Contact Form' },
            { name: 'formDescription', displayName: 'Description', type: 'string', default: '' },
            { name: 'respondMode', displayName: 'Respond Mode', type: 'options', default: 'onReceived', options: [{ name: 'When Received', value: 'onReceived' }, { name: 'Last Node', value: 'lastNode' }] },
        ]
    },
};

// Genera el archivo de seed
function generateSeedFile(): void {
    console.log('Generando seed con properties...');

    const nodes: any[] = [];

    for (const [nodeType, config] of Object.entries(PRIORITY_NODES)) {
        nodes.push({
            type: nodeType,
            category: config.category,
            icon: config.icon,
            color: CATEGORY_COLORS[config.category] || 'bg-slate-500',
            label: { en: config.label, es: config.label },
            description: { en: config.description, es: config.description },
            inputs: [{ name: 'main', type: 'main' }],
            outputs: config.outputs || [{ name: 'main', type: 'main' }],
            properties: config.properties,
        });
    }

    const content = `import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NODES = ${JSON.stringify(nodes, null, 2)};

async function main() {
    console.log(\`Updating \${NODES.length} Node Types with properties...\`);

    for (const node of NODES) {
        await prisma.nodeType.upsert({
            where: { type: node.type },
            update: {
                properties: node.properties,
            },
            create: {
                type: node.type,
                category: node.category,
                icon: node.icon,
                color: node.color,
                label: node.label,
                description: node.description,
                inputs: node.inputs,
                outputs: node.outputs,
                properties: node.properties,
            },
        });
        console.log(\`Updated: \${node.type}\`);
    }

    console.log('Node properties updated successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
`;

    fs.writeFileSync(OUTPUT_PATH, content);
    console.log(`Archivo generado: ${OUTPUT_PATH}`);
    console.log(`Total nodos con properties: ${nodes.length}`);
}

generateSeedFile();
