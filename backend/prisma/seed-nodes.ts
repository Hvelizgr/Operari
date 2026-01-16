
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NODES = [
    // === AI & LLM ===
    {
        type: 'n8n-nodes-base.openAi',
        category: 'ai',
        icon: 'MessageSquare',
        color: 'bg-rose-500',
        label: { en: 'OpenAI', es: 'OpenAI' },
        description: { en: 'Interact with OpenAI models', es: 'Interactuar con modelos OpenAI' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'n8n-nodes-base.langChain',
        category: 'ai',
        icon: 'GitBranch',
        color: 'bg-rose-500',
        label: { en: 'LangChain Agent', es: 'Agente LangChain' },
        description: { en: 'Build LLM chains', es: 'Cadenas LLM' },
        inputs: [
            { name: 'main', type: 'main', label: 'Main' },
            { name: 'ai_tool', type: 'ai_tool', label: 'Tools' },
            { name: 'ai_memory', type: 'ai_memory', label: 'Memory' }
        ],
        outputs: [{ name: 'main', type: 'main' }],
        properties: [
            {
                name: 'promptSource',
                displayName: 'Source for Prompt (User Message)',
                type: 'options',
                options: [
                    { name: 'Connected Chat Trigger Node', value: 'trigger' },
                    { name: 'Define below (Manual)', value: 'manual' }
                ],
                default: 'trigger',
                description: 'Where should the prompt come from?'
            },
            {
                name: 'text',
                displayName: 'Prompt (User Message)',
                type: 'string',
                typeOptions: { rows: 4, expression: true },
                default: '{{ $json.chatInput }}',
                description: 'The message to send to the AI'
            },
            {
                name: 'jsonOutput',
                displayName: 'Require Specific Output Format',
                type: 'boolean',
                default: false,
                description: 'Force the AI to respond with valid JSON'
            },
            {
                name: 'enableFallback',
                displayName: 'Enable Fallback Model',
                type: 'boolean',
                default: false,
                description: 'Use a backup model if the primary fails'
            }
        ]
    },
    {
        type: 'n8n-nodes-base.anthropic',
        category: 'ai',
        icon: 'MessageSquare',
        color: 'bg-rose-500',
        label: { en: 'Anthropic', es: 'Anthropic' },
        description: { en: 'Claude models', es: 'Modelos Claude' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }]
    },

    // === TRIGGERS ===
    {
        type: 'n8n-nodes-base.webhook',
        category: 'triggers',
        icon: 'Webhook',
        color: 'bg-green-500',
        label: { en: 'Webhook', es: 'Webhook' },
        description: { en: 'Starts on HTTP request', es: 'Inicia con HTTP request' },
        inputs: [],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'n8n-nodes-base.scheduleTrigger',
        category: 'triggers',
        icon: 'Clock',
        color: 'bg-green-500',
        label: { en: 'Schedule', es: 'Cronograma' },
        description: { en: 'Run on schedule', es: 'Ejecutar programado' },
        inputs: [],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'n8n-nodes-base.manualTrigger',
        category: 'triggers',
        icon: 'Play',
        color: 'bg-green-500',
        label: { en: 'Manual', es: 'Manual' },
        description: { en: 'Start manually', es: 'Iniciar manualmente' },
        inputs: [],
        outputs: [{ name: 'main', type: 'main' }]
    },

    // === CORE ===
    {
        type: 'n8n-nodes-base.httpRequest',
        category: 'core',
        icon: 'Globe',
        color: 'bg-blue-500',
        label: { en: 'HTTP Request', es: 'Petición HTTP' },
        description: { en: 'Make HTTP requests', es: 'Hacer petición HTTP' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'n8n-nodes-base.code',
        category: 'core',
        icon: 'Code',
        color: 'bg-blue-500',
        label: { en: 'Code', es: 'Código' },
        description: { en: 'Run JavaScript', es: 'Ejecutar JavaScript' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'custom.shellCommand',
        category: 'core',
        icon: 'TerminalSquare',
        color: 'bg-gray-500',
        label: { en: 'Shell Command', es: 'Comando de Shell' },
        description: { en: 'Execute a shell command', es: 'Ejecutar un comando de shell' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }],
        properties: [
            {
                name: 'command',
                displayName: 'Command',
                type: 'string',
                typeOptions: { rows: 4, expression: true },
                default: '',
                description: 'The shell command to execute.'
            }
        ]
    },
    // === FLOW ===
    {
        type: 'n8n-nodes-base.if',
        category: 'flow',
        icon: 'GitBranch',
        color: 'bg-yellow-500',
        label: { en: 'IF', es: 'SI' },
        description: { en: 'Conditional logic', es: 'Lógica condicional' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'true', type: 'main', label: 'True' }, { name: 'false', type: 'main', label: 'False' }]
    },
    {
        type: 'n8n-nodes-base.merge',
        category: 'flow',
        icon: 'GitBranch',
        color: 'bg-yellow-500',
        label: { en: 'Merge', es: 'Unir' },
        description: { en: 'Merge branches', es: 'Unir ramas' },
        inputs: [{ name: 'input1', type: 'main' }, { name: 'input2', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'n8n-nodes-base.switch',
        category: 'flow',
        icon: 'List',
        color: 'bg-yellow-500',
        label: { en: 'Switch', es: 'Switch' },
        description: { en: 'Multiple routes', es: 'Rutas múltiples' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: '0', type: 'main' }, { name: '1', type: 'main' }, { name: '2', type: 'main' }, { name: '3', type: 'main' }]
    },

    {
        type: 'Decision',
        category: 'flow',
        icon: 'HelpCircle',
        color: 'bg-yellow-600',
        label: { en: 'Decision (Jexl)', es: 'Decisión (Jexl)' },
        description: { en: 'Evaluate complex logic with Jexl', es: 'Evaluar lógica compleja con Jexl' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'true', type: 'main', label: 'True' }, { name: 'false', type: 'main', label: 'False' }]
    },
    {
        type: 'Split',
        category: 'flow',
        icon: 'Layers',
        color: 'bg-indigo-500',
        label: { en: 'Split', es: 'Dividir' },
        description: { en: 'Split array into parallel tasks', es: 'Dividir array en tareas paralelas' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'Join',
        category: 'flow',
        icon: 'Combine',
        color: 'bg-indigo-600',
        label: { en: 'Join', es: 'Unir' },
        description: { en: 'Wait for all branches to complete', es: 'Esperar a que todas las ramas terminen' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'Repeat',
        category: 'flow',
        icon: 'Repeat',
        color: 'bg-violet-500',
        label: { en: 'Repeat', es: 'Repetir' },
        description: { en: 'Execute N times in parallel', es: 'Ejecutar N veces en paralelo' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }],
        properties: [
            {
                name: 'count',
                displayName: 'Repeat Count',
                type: 'number',
                default: 1,
                description: 'Number of times to repeat execution (1-1000)'
            },
            {
                name: 'parallel',
                displayName: 'Parallel Execution',
                type: 'boolean',
                default: true,
                description: 'Execute all iterations in parallel'
            }
        ]
    },
    {
        type: 'Multiplex',
        category: 'flow',
        icon: 'Network',
        color: 'bg-violet-600',
        label: { en: 'Multiplex', es: 'Multiplexar' },
        description: { en: 'Execute on multiple targets with stagger', es: 'Ejecutar en múltiples destinos con retraso' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }],
        properties: [
            {
                name: 'targets',
                displayName: 'Targets',
                type: 'string',
                typeOptions: { rows: 4 },
                default: '',
                description: 'Target identifiers (one per line)'
            },
            {
                name: 'stagger',
                displayName: 'Stagger Delay (ms)',
                type: 'number',
                default: 0,
                description: 'Delay in milliseconds between each target execution'
            },
            {
                name: 'continueThreshold',
                displayName: 'Continue Threshold (%)',
                type: 'number',
                default: 100,
                description: 'Percentage of successful executions required to continue (0-100)'
            }
        ]
    },
    {
        type: 'custom.suspend',
        category: 'flow',
        icon: 'Pause',
        color: 'bg-orange-500',
        label: { en: 'Suspend', es: 'Suspender' },
        description: { en: 'Pauses the workflow until it is manually resumed', es: 'Pausa el flujo de trabajo hasta que se reanude manualmente' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'Action',
        category: 'flow',
        icon: 'Zap',
        color: 'bg-green-500',
        label: { en: 'Action', es: 'Acción' },
        description: { en: 'Execute post-job actions (email, webhook, etc.)', es: 'Ejecutar acciones post-trabajo (email, webhook, etc.)' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }],
        properties: [
            {
                name: 'actionType',
                displayName: 'Action Type',
                type: 'options',
                options: [
                    { name: 'Send Email', value: 'email' },
                    { name: 'Call Webhook', value: 'webhook' },
                    { name: 'Disable Workflow', value: 'disable' },
                    { name: 'Delete Workflow', value: 'delete' },
                    { name: 'Add Tags', value: 'tag' },
                    { name: 'Run Another Event', value: 'run_event' },
                    { name: 'Send to Channel', value: 'channel' }
                ],
                default: 'webhook',
                description: 'Type of post-job action to execute'
            },
            {
                name: 'condition',
                displayName: 'Trigger Condition',
                type: 'options',
                options: [
                    { name: 'On Success', value: 'success' },
                    { name: 'On Error', value: 'error' },
                    { name: 'Always (Complete)', value: 'complete' },
                    { name: 'On Warning', value: 'warning' }
                ],
                default: 'complete',
                description: 'When to trigger this action'
            },
            {
                name: 'enabled',
                displayName: 'Enabled',
                type: 'boolean',
                default: true,
                description: 'Whether this action is active'
            },
            {
                name: 'emailTo',
                displayName: 'Email Recipient',
                type: 'string',
                typeOptions: { expression: true },
                default: '',
                description: 'Email address to send notification to (for email action)'
            },
            {
                name: 'emailSubject',
                displayName: 'Email Subject',
                type: 'string',
                typeOptions: { expression: true },
                default: 'Workflow Notification',
                description: 'Subject of the email (for email action)'
            },
            {
                name: 'emailBody',
                displayName: 'Email Body',
                type: 'string',
                typeOptions: { rows: 4, expression: true },
                default: '',
                description: 'Body of the email (for email action)'
            },
            {
                name: 'webhookUrl',
                displayName: 'Webhook URL',
                type: 'string',
                typeOptions: { expression: true },
                default: '',
                description: 'URL to call (for webhook action)'
            },
            {
                name: 'webhookMethod',
                displayName: 'HTTP Method',
                type: 'options',
                options: [
                    { name: 'POST', value: 'POST' },
                    { name: 'GET', value: 'GET' },
                    { name: 'PUT', value: 'PUT' }
                ],
                default: 'POST',
                description: 'HTTP method for webhook call'
            },
            {
                name: 'tags',
                displayName: 'Tags',
                type: 'string',
                default: '',
                description: 'Comma-separated tags to add (for tag action)'
            },
            {
                name: 'eventId',
                displayName: 'Event ID',
                type: 'string',
                default: '',
                description: 'ID of the event to run (for run_event action)'
            }
        ]
    },
    {
        type: 'Limit',
        category: 'flow',
        icon: 'Gauge',
        color: 'bg-cyan-500',
        label: { en: 'Limit', es: 'Límite' },
        description: { en: 'Control resource limits (time, memory, CPU, concurrent)', es: 'Controlar límites de recursos (tiempo, memoria, CPU, concurrencia)' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }],
        properties: [
            {
                name: 'limitType',
                displayName: 'Limit Type',
                type: 'options',
                options: [
                    { name: 'Time (seconds)', value: 'time' },
                    { name: 'Memory (MB)', value: 'memory' },
                    { name: 'CPU (%)', value: 'cpu' },
                    { name: 'Concurrent Executions', value: 'concurrent' },
                    { name: 'Queue Size', value: 'queue' },
                    { name: 'Daily Executions', value: 'daily' }
                ],
                default: 'concurrent',
                description: 'Type of resource limit to enforce'
            },
            {
                name: 'amount',
                displayName: 'Limit Amount',
                type: 'number',
                default: 1,
                description: 'The limit value (meaning depends on limit type)'
            },
            {
                name: 'duration',
                displayName: 'Sustain Duration (seconds)',
                type: 'number',
                default: 0,
                description: 'For CPU/Memory limits: how long the limit must be exceeded before action'
            },
            {
                name: 'enabled',
                displayName: 'Enabled',
                type: 'boolean',
                default: true,
                description: 'Whether this limit is active'
            },
            {
                name: 'onExceed',
                displayName: 'On Exceed',
                type: 'options',
                options: [
                    { name: 'Abort Execution', value: 'abort' },
                    { name: 'Warn Only', value: 'warn' },
                    { name: 'Skip Node', value: 'skip' }
                ],
                default: 'warn',
                description: 'Action to take when limit is exceeded'
            },
            {
                name: 'notifyEmail',
                displayName: 'Notify Email',
                type: 'string',
                default: '',
                description: 'Email address to notify when limit is exceeded'
            },
            {
                name: 'notifyWebhook',
                displayName: 'Notify Webhook',
                type: 'string',
                default: '',
                description: 'Webhook URL to call when limit is exceeded'
            }
        ]
    },

    // === SOCIAL ===
    {
        type: 'n8n-nodes-base.googleSheets',
        category: 'productivity',
        icon: 'FileText',
        color: 'bg-green-500',
        label: { en: 'Google Sheets', es: 'Google Sheets' },
        description: { en: 'Read/write spreadsheets', es: 'Leer/escribir hojas' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'n8n-nodes-base.slack',
        category: 'communication',
        icon: 'MessageSquare',
        color: 'bg-orange-500',
        label: { en: 'Slack', es: 'Slack' },
        description: { en: 'Send messages', es: 'Enviar mensajes' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'custom.email',
        category: 'communication',
        icon: 'Mail',
        color: 'bg-indigo-600',
        label: { en: 'Send Email', es: 'Enviar Correo' },
        description: { en: 'Send a customizable email', es: 'Enviar un correo electrónico personalizable' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }],
        properties: [
            {
                name: 'to',
                displayName: 'Recipient Email',
                type: 'string',
                typeOptions: { expression: true },
                default: '',
                description: 'The email address of the recipient(s). Supports expressions.'
            },
            {
                name: 'subject',
                displayName: 'Subject',
                type: 'string',
                typeOptions: { expression: true },
                default: '',
                description: 'The subject of the email. Supports expressions.'
            },
            {
                name: 'body',
                displayName: 'Body (Plain Text)',
                type: 'string',
                typeOptions: { rows: 4, expression: true },
                default: '',
                description: 'The plain text body of the email. Supports expressions.'
            },
            {
                name: 'html',
                displayName: 'Body (HTML)',
                type: 'string',
                typeOptions: { rows: 4, expression: true },
                default: '',
                description: 'The HTML body of the email. Overrides plain text if provided. Supports expressions.'
            }
        ]
    },
    // ... adding tons more would overload this single file write, keeping it essential for proof of concept
    // === STORAGE ===
    {
        type: 'custom.storeSet',
        category: 'storage',
        icon: 'Archive',
        color: 'bg-purple-500',
        label: { en: 'Set Value in Storage', es: 'Guardar Valor en Almacén' },
        description: { en: 'Save a key-value pair to a persistent bucket', es: 'Guardar un par clave-valor en un bucket persistente' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }],
        properties: [
            {
                name: 'bucketName',
                displayName: 'Bucket Name',
                type: 'string',
                default: 'default',
                description: 'The name of the storage bucket.'
            },
            {
                name: 'key',
                displayName: 'Key',
                type: 'string',
                default: '',
                description: 'The key to store the value under.'
            },
            {
                name: 'value',
                displayName: 'Value',
                type: 'string',
                typeOptions: { expression: true },
                default: '{{ $json.data }}',
                description: 'The value to store. Can be an expression.'
            }
        ]
    },
    {
        type: 'custom.storeGet',
        category: 'storage',
        icon: 'ArchiveRestore',
        color: 'bg-purple-500',
        label: { en: 'Get Value from Storage', es: 'Obtener Valor de Almacén' },
        description: { en: 'Retrieve a value from a persistent bucket', es: 'Recuperar un valor desde un bucket persistente' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }],
        properties: [
            {
                name: 'bucketName',
                displayName: 'Bucket Name',
                type: 'string',
                default: 'default',
                description: 'The name of the storage bucket.'
            },
            {
                name: 'key',
                displayName: 'Key',
                type: 'string',
                default: '',
                description: 'The key of the value to retrieve.'
            }
        ]
    },
    // ... adding tons more would overload this single file write, keeping it essential for proof of concept
    {
        type: 'custom.setMetadata',
        category: 'utility',
        icon: 'Tag',
        color: 'bg-gray-400',
        label: { en: 'Set Metadata', es: 'Establecer Metadatos' },
        description: { en: 'Sets metadata for the current execution', es: 'Establece metadatos para la ejecución actual' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }]
    },
    {
        type: 'custom.note',
        category: 'utility',
        icon: 'StickyNote',
        color: 'bg-yellow-400',
        label: { en: 'Note', es: 'Nota' },
        description: { en: 'A sticky note for documentation', es: 'Una nota adhesiva para documentación' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }],
        properties: [
            {
                name: 'text',
                displayName: 'Note Content',
                type: 'string',
                typeOptions: { rows: 10, expression: false },
                default: 'This is a note.',
                description: 'The content of the note. Displayed directly on the node.'
            }
        ]
    },
    // === INTEGRATION ===
    {
        type: 'custom.createTicket',
        category: 'integration',
        icon: 'Ticket',
        color: 'bg-teal-500',
        label: { en: 'Create Ticket', es: 'Crear Ticket' },
        description: { en: 'Creates a ticket in an external system via webhook', es: 'Crea un ticket en un sistema externo vía webhook' },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }],
        properties: [
            {
                name: 'webhookUrl',
                displayName: 'Webhook URL',
                type: 'string',
                default: '',
                description: 'The URL of the external ticketing system webhook.'
            },
            {
                name: 'subject',
                displayName: 'Ticket Subject',
                type: 'string',
                typeOptions: { expression: true },
                default: 'New Ticket from NanoFlow Execution {{ $json.executionId }}',
                description: 'The subject of the ticket. Supports expressions.'
            },
            {
                name: 'body',
                displayName: 'Ticket Body',
                type: 'string',
                typeOptions: { rows: 8, expression: true },
                default: 'Execution {{ $json.executionId }} of workflow {{ $json.workflowName }} requires attention.',
                description: 'The body/description of the ticket. Supports expressions.'
            }
        ]
    },
];

async function main() {
    console.log('Seeding Node Types...');
    for (const node of NODES) {
        await prisma.nodeType.upsert({
            where: { type: node.type },
            update: {
                category: node.category,
                icon: node.icon,
                color: node.color,
                label: node.label,
                description: node.description,
                inputs: node.inputs,
                outputs: node.outputs,
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
            },
        });
    }
    console.log('Node Types seeded!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
