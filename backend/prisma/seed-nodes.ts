
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to define nodes quickly
const defineNode = (type: string, category: string, icon: string, labelEn: string, labelEs: string, descriptionEn: string, inputs: any[] = [{ name: 'main', type: 'main' }], outputs: any[] = [{ name: 'main', type: 'main' }], properties: any[] = []) => ({
    type,
    category,
    icon,
    color: getNodeColor(category),
    label: { en: labelEn, es: labelEs },
    description: { en: descriptionEn, es: descriptionEn }, // Fallback ES description
    inputs,
    outputs,
    properties
});

const getNodeColor = (category: string) => {
    switch (category) {
        case 'triggers': return 'bg-green-500';
        case 'core': return 'bg-blue-500';
        case 'flow': return 'bg-yellow-500'; // Logic
        case 'ai': return 'bg-rose-500';
        case 'productivity': return 'bg-teal-500';
        case 'communication': return 'bg-indigo-500';
        case 'data': return 'bg-orange-500';
        case 'storage': return 'bg-purple-500';
        default: return 'bg-slate-500';
    }
};

const NODES = [
    // === TRIGGERS ===
    defineNode('n8n-nodes-base.webhook', 'triggers', 'Webhook', 'Webhook', 'Webhook', 'Starts workflow on HTTP request', [], [{ name: 'main', type: 'main' }]),
    defineNode('n8n-nodes-base.scheduleTrigger', 'triggers', 'Clock', 'Schedule', 'Cronograma', 'Starts workflow on a schedule', [], [{ name: 'main', type: 'main' }]),
    defineNode('n8n-nodes-base.manualTrigger', 'triggers', 'Play', 'Manual', 'Manual', 'Starts workflow manually', [], [{ name: 'main', type: 'main' }]),
    defineNode('n8n-nodes-base.formTrigger', 'triggers', 'ClipboardList', 'Form Trigger', 'Disparador de Formulario', 'Starts workflow on form submission', [], [{ name: 'main', type: 'main' }]),
    defineNode('n8n-nodes-base.telegramTrigger', 'triggers', 'MessageCircle', 'Telegram Trigger', 'Disparador Telegram', 'On new Telegram message', [], [{ name: 'main', type: 'main' }]),
    defineNode('n8n-nodes-base.gmailTrigger', 'triggers', 'Mail', 'Gmail Trigger', 'Disparador Gmail', 'On new email', [], [{ name: 'main', type: 'main' }]),
    defineNode('n8n-nodes-base.whatsAppTrigger', 'triggers', 'MessageSquare', 'WhatsApp Trigger', 'Disparador WhatsApp', 'On new WhatsApp message', [], [{ name: 'main', type: 'main' }]),
    defineNode('n8n-nodes-base.googleSheetsTrigger', 'triggers', 'Table', 'Google Sheets Trigger', 'Disparador Sheets', 'On row change', [], [{ name: 'main', type: 'main' }]),
    defineNode('n8n-nodes-base.googleDriveTrigger', 'triggers', 'HardDrive', 'Google Drive Trigger', 'Disparador Drive', 'On file change', [], [{ name: 'main', type: 'main' }]),
    defineNode('n8n-nodes-base.slackTrigger', 'triggers', 'Hash', 'Slack Trigger', 'Disparador Slack', 'On new Slack message', [], [{ name: 'main', type: 'main' }]),
    defineNode('n8n-nodes-base.postgresTrigger', 'triggers', 'Database', 'Postgres Trigger', 'Disparador Postgres', 'On DB change', [], [{ name: 'main', type: 'main' }]),

    // === CORE & UTILS ===
    defineNode('n8n-nodes-base.httpRequest', 'core', 'Globe', 'HTTP Request', 'Petición HTTP', 'Make generic HTTP requests'),
    defineNode('n8n-nodes-base.code', 'core', 'Code', 'Code', 'Código', 'Run JavaScript code'),
    defineNode('n8n-nodes-base.editImage', 'core', 'Image', 'Edit Image', 'Editar Imagen', 'Process images'),
    defineNode('n8n-nodes-base.readWriteFile', 'core', 'File', 'Read/Write File', 'Leer/Escribir Archivo', 'File operations'),
    defineNode('n8n-nodes-base.extractFromFile', 'core', 'FileText', 'Extract from File', 'Extraer de Archivo', 'Extract data from files'),
    defineNode('n8n-nodes-base.convertToFile', 'core', 'FileInput', 'Convert to File', 'Convertir a Archivo', 'Convert data to binary file'),
    defineNode('n8n-nodes-base.markdown', 'core', 'FileType', 'Markdown', 'Markdown', 'Render/Parse Markdown'),
    defineNode('n8n-nodes-base.html', 'core', 'Code', 'HTML', 'HTML', 'Extract data from HTML'),
    defineNode('n8n-nodes-base.xml', 'core', 'Code', 'XML', 'XML', 'Parse XML'),
    defineNode('n8n-nodes-base.crypto', 'core', 'Lock', 'Crypto', 'Criptografía', 'Encryption/Decryption'),
    defineNode('n8n-nodes-base.dateTime', 'core', 'Calendar', 'Date & Time', 'Fecha y Hora', 'Date manipulation'),
    defineNode('n8n-nodes-base.executeCommand', 'core', 'Terminal', 'Execute Command', 'Ejecutar Comando', 'Run shell commands'),
    defineNode('n8n-nodes-base.executeWorkflow', 'core', 'GitMerge', 'Execute Workflow', 'Ejecutar Flujo', 'Run another workflow'),
    defineNode('n8n-nodes-base.noOp', 'core', 'MinusCircle', 'No Operation', 'No Operación', 'Do nothing (placeholder)'),

    // === FLOW CONTROL ===
    defineNode('n8n-nodes-base.if', 'flow', 'GitBranch', 'IF', 'SI', 'Conditional routing', [{ name: 'main', type: 'main' }], [{ name: 'true', type: 'main' }, { name: 'false', type: 'main' }]),
    defineNode('n8n-nodes-base.switch', 'flow', 'List', 'Switch', 'Switch', 'Route based on value', [{ name: 'main', type: 'main' }], [{ name: '0', type: 'main' }, { name: '1', type: 'main' }, { name: '2', type: 'main' }, { name: '3', type: 'main' }]),
    defineNode('n8n-nodes-base.merge', 'flow', 'GitMerge', 'Merge', 'Fusionar', 'Merge data streams', [{ name: 'input1', type: 'main' }, { name: 'input2', type: 'main' }], [{ name: 'main', type: 'main' }]),
    defineNode('n8n-nodes-base.splitInBatches', 'flow', 'Repeat', 'Split in Batches', 'Dividir en Lotes', 'Loop over items'),
    defineNode('n8n-nodes-base.splitOut', 'flow', 'Minimize2', 'Split Out', 'Separar', 'Split array to items'),
    defineNode('n8n-nodes-base.filter', 'flow', 'Filter', 'Filter', 'Filtrar', 'Filter items'),
    defineNode('n8n-nodes-base.wait', 'flow', 'Clock', 'Wait', 'Esperar', 'Pause execution'),
    defineNode('n8n-nodes-base.limit', 'flow', 'Gauge', 'Limit', 'Límite', 'Limit execution rate'),
    defineNode('n8n-nodes-base.set', 'flow', 'Edit', 'Set', 'Definir', 'Set variables'),
    defineNode('n8n-nodes-base.aggregate', 'flow', 'Layers', 'Aggregate', 'Agregar', 'Group items'),
    defineNode('n8n-nodes-base.respondToWebhook', 'flow', 'CornerUpLeft', 'Respond to Webhook', 'Responder a Webhook', 'Return data to webhook caller'),

    // === INTEGRATIONS (COMMON) ===
    defineNode('n8n-nodes-base.googleSheets', 'productivity', 'Table', 'Google Sheets', 'Google Sheets', 'Spreadsheet operations'),
    defineNode('n8n-nodes-base.googleDocs', 'productivity', 'FileText', 'Google Docs', 'Google Docs', 'Document operations'),
    defineNode('n8n-nodes-base.googleDrive', 'productivity', 'HardDrive', 'Google Drive', 'Google Drive', 'File storage'),
    defineNode('n8n-nodes-base.googleCalendar', 'productivity', 'Calendar', 'Google Calendar', 'Google Calendar', 'Calendar operations'),
    defineNode('n8n-nodes-base.gmail', 'communication', 'Mail', 'Gmail', 'Gmail', 'Email operations'),
    defineNode('n8n-nodes-base.telegram', 'communication', 'MessageCircle', 'Telegram', 'Telegram', 'Messaging'),
    defineNode('n8n-nodes-base.slack', 'communication', 'Hash', 'Slack', 'Slack', 'Team communication'),
    defineNode('n8n-nodes-base.discord', 'communication', 'MessageSquare', 'Discord', 'Discord', 'Chat operations'),
    defineNode('n8n-nodes-base.whatsApp', 'communication', 'MessageSquare', 'WhatsApp', 'WhatsApp', 'Messaging'),
    defineNode('n8n-nodes-base.emailSend', 'communication', 'Send', 'Send Email', 'Enviar Email', 'SMTP Email sending'),
    defineNode('n8n-nodes-base.emailReadImap', 'communication', 'Inbox', 'Read Email', 'Leer Email', 'IMAP Email reading'),

    // === DATA & DB ===
    defineNode('n8n-nodes-base.postgres', 'storage', 'Database', 'Postgres', 'Postgres', 'PostgreSQL Database'),
    defineNode('n8n-nodes-base.mySql', 'storage', 'Database', 'MySQL', 'MySQL', 'MySQL Database'),
    defineNode('n8n-nodes-base.mongoDb', 'storage', 'Database', 'MongoDB', 'MongoDB', 'NoSQL Database'),
    defineNode('n8n-nodes-base.redis', 'storage', 'Database', 'Redis', 'Redis', 'Key-Value Store'),
    defineNode('n8n-nodes-base.supabase', 'storage', 'Database', 'Supabase', 'Supabase', 'Supabase DB'),
    defineNode('n8n-nodes-base.airtable', 'storage', 'Grid', 'Airtable', 'Airtable', 'Airtable Base'),
    defineNode('n8n-nodes-base.notion', 'productivity', 'Book', 'Notion', 'Notion', 'Notion Pages/DB'),
    defineNode('n8n-nodes-base.microsoftExcel', 'productivity', 'Table', 'Excel', 'Excel', 'Excel Online'),
    defineNode('n8n-nodes-base.microsoftOutlook', 'communication', 'Mail', 'Outlook', 'Outlook', 'Outlook Email'),
    defineNode('n8n-nodes-base.github', 'core', 'Github', 'GitHub', 'GitHub', 'Repo operations'),
    defineNode('n8n-nodes-base.salesforce', 'core', 'Cloud', 'Salesforce', 'Salesforce', 'CRM'),
    defineNode('n8n-nodes-base.hubspot', 'core', 'Cloud', 'HubSpot', 'HubSpot', 'CRM'),
    defineNode('n8n-nodes-base.clickUp', 'productivity', 'CheckSquare', 'ClickUp', 'ClickUp', 'Task management'),
    defineNode('n8n-nodes-base.trello', 'productivity', 'Trello', 'Trello', 'Trello', 'Kanban'),
    defineNode('n8n-nodes-base.jira', 'productivity', 'Target', 'Jira', 'Jira', 'Issue tracking'),

    // === AI (Already had some) ===
    defineNode('n8n-nodes-base.openAi', 'ai', 'MessageSquare', 'OpenAI', 'OpenAI', 'GPT Models'),
    defineNode('n8n-nodes-base.langChain', 'ai', 'GitBranch', 'LangChain', 'LangChain', 'LLM Chains'),
    defineNode('n8n-nodes-base.anthropic', 'ai', 'MessageSquare', 'Anthropic', 'Anthropic', 'Claude Models'),
    defineNode('n8n-nodes-base.perplexity', 'ai', 'Search', 'Perplexity', 'Perplexity', 'AI Search'),
    defineNode('WebScraper', 'core', 'Globe', 'Web Scraper', 'Extractor Web', 'Scrape content from any website (Fast/Advanced)', [{ name: 'main', type: 'main' }], [{ name: 'main', type: 'main' }], [
        {
            displayName: 'URL',
            name: 'url',
            type: 'string',
            default: '',
            placeholder: 'https://example.com',
            description: 'The URL of the page to scrape',
            required: true,
        },
        {
            displayName: 'Mode',
            name: 'mode',
            type: 'options',
            options: [
                { name: 'Fast (Cheerio)', value: 'fast' },
                { name: 'Advanced (Jina AI / Markdown)', value: 'advanced' },
            ],
            default: 'fast',
            description: 'Fast is best for static HTML. Advanced is best for LLM integration and markdown.',
        },
        {
            displayName: 'Selector',
            name: 'selector',
            type: 'string',
            default: 'body',
            placeholder: '.content-class',
            description: 'CSS Selector to target specific content (Fast mode only)',
        },
        {
            displayName: 'Extract Links',
            name: 'extractLinks',
            type: 'boolean',
            default: false,
        },
        {
            displayName: 'Extract Images',
            name: 'extractImages',
            type: 'boolean',
            default: false,
        }
    ]),
];

async function main() {
    console.log(`Seeding ${NODES.length} Node Types...`);
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
    console.log('Node Types seeded successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
