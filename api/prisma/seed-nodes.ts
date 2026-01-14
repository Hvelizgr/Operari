
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
    // ... adding tons more would overload this single file write, keeping it essential for proof of concept
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
