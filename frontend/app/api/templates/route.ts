import { NextResponse } from 'next/server';

const TEMPLATES = [
    {
        id: 'lead-scoring',
        category: 'automation',
        name: {
            en: 'Lead Scoring Pipeline',
            es: 'Pipeline de Scoring de Leads'
        },
        description: {
            en: 'Automatically score incoming leads based on company size, industry, and engagement. Routes high-value leads to sales team.',
            es: 'Puntúa automáticamente leads entrantes basándose en tamaño de empresa, industria y engagement. Envía leads de alto valor al equipo de ventas.'
        },
        nodes: [
            {
                id: 'webhook-1',
                type: 'n8n-nodes-base.webhook',
                position: { x: 100, y: 200 },
                title: 'New Lead Webhook',
                config: { path: 'lead-intake', httpMethod: 'POST' }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 350, y: 200 },
                title: 'Calculate Score',
                config: { jsCode: `const lead = $input.first().json;
let score = 0;
if (lead.company_size > 100) score += 30;
else if (lead.company_size > 20) score += 15;
if (['tech', 'finance', 'healthcare'].includes(lead.industry)) score += 25;
if (lead.email?.includes('@gmail') || lead.email?.includes('@yahoo')) score -= 10;
else score += 20;
return { ...lead, score, tier: score >= 50 ? 'HOT' : score >= 25 ? 'WARM' : 'COLD' };` }
            },
            {
                id: 'switch-1',
                type: 'n8n-nodes-base.switch',
                position: { x: 600, y: 200 },
                title: 'Route by Tier',
                config: { rules: { rules: [{ value1: '={{$json.tier}}', operation: 'equal', value2: 'HOT' }, { value1: '={{$json.tier}}', operation: 'equal', value2: 'WARM' }] } }
            },
            {
                id: 'slack-1',
                type: 'n8n-nodes-base.slack',
                position: { x: 900, y: 100 },
                title: 'Alert Sales (HOT)',
                config: { channel: '#sales-alerts', message: '🔥 HOT Lead: {{$json.name}} (Score: {{$json.score}})' }
            },
            {
                id: 'code-2',
                type: 'n8n-nodes-base.code',
                position: { x: 900, y: 200 },
                title: 'Queue for Nurture',
                config: { jsCode: `return { action: 'add_to_nurture_campaign', lead: $input.first().json };` }
            },
            {
                id: 'code-3',
                type: 'n8n-nodes-base.code',
                position: { x: 900, y: 300 },
                title: 'Archive Cold Lead',
                config: { jsCode: `return { action: 'archive', reason: 'low_score', lead: $input.first().json };` }
            }
        ],
        connections: [
            { id: 'c1', source: 'webhook-1', target: 'code-1' },
            { id: 'c2', source: 'code-1', target: 'switch-1' },
            { id: 'c3', source: 'switch-1', target: 'slack-1', sourcePort: 0 },
            { id: 'c4', source: 'switch-1', target: 'code-2', sourcePort: 1 },
            { id: 'c5', source: 'switch-1', target: 'code-3', sourcePort: 2 }
        ]
    },
    {
        id: 'etl-pipeline',
        category: 'data',
        name: {
            en: 'ETL Data Pipeline',
            es: 'Pipeline ETL de Datos'
        },
        description: {
            en: 'Extract data from multiple APIs, transform and clean it, then load into a database. Includes error handling and validation.',
            es: 'Extrae datos de múltiples APIs, los transforma y limpia, luego los carga en base de datos. Incluye manejo de errores y validación.'
        },
        nodes: [
            {
                id: 'trigger-1',
                type: 'n8n-nodes-base.scheduleTrigger',
                position: { x: 100, y: 200 },
                title: 'Daily Schedule',
                config: { rule: { interval: [{ field: 'hours', hoursInterval: 24 }] } }
            },
            {
                id: 'http-1',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 100 },
                title: 'Fetch Orders API',
                config: { url: 'https://api.example.com/orders', method: 'GET', authentication: 'genericCredentialType' }
            },
            {
                id: 'http-2',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 300 },
                title: 'Fetch Customers API',
                config: { url: 'https://api.example.com/customers', method: 'GET' }
            },
            {
                id: 'merge-1',
                type: 'n8n-nodes-base.merge',
                position: { x: 600, y: 200 },
                title: 'Merge Data',
                config: { mode: 'combine', mergeByFields: { values: [{ field1: 'customer_id', field2: 'id' }] } }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 850, y: 200 },
                title: 'Transform & Clean',
                config: { jsCode: `const items = $input.all();
return items.map(item => {
  const json = item.json;
  return {
    order_id: json.order_id,
    customer_name: (json.first_name + ' ' + json.last_name).trim(),
    email: json.email?.toLowerCase(),
    total: parseFloat(json.total) || 0,
    status: json.status?.toUpperCase(),
    created_at: new Date(json.created_at).toISOString(),
    is_valid: json.email && json.total > 0
  };
}).filter(r => r.is_valid);` }
            },
            {
                id: 'if-1',
                type: 'n8n-nodes-base.if',
                position: { x: 1100, y: 200 },
                title: 'Has Records?',
                config: { conditions: { number: [{ value1: '={{$json.length}}', operation: 'larger', value2: 0 }] } }
            },
            {
                id: 'postgres-1',
                type: 'n8n-nodes-base.postgres',
                position: { x: 1350, y: 100 },
                title: 'Insert to DB',
                config: { operation: 'insert', table: 'processed_orders' }
            },
            {
                id: 'code-2',
                type: 'n8n-nodes-base.code',
                position: { x: 1350, y: 300 },
                title: 'Log Empty Result',
                config: { jsCode: `return { status: 'no_data', message: 'No valid records to process', timestamp: new Date().toISOString() };` }
            }
        ],
        connections: [
            { id: 'c1', source: 'trigger-1', target: 'http-1' },
            { id: 'c2', source: 'trigger-1', target: 'http-2' },
            { id: 'c3', source: 'http-1', target: 'merge-1' },
            { id: 'c4', source: 'http-2', target: 'merge-1' },
            { id: 'c5', source: 'merge-1', target: 'code-1' },
            { id: 'c6', source: 'code-1', target: 'if-1' },
            { id: 'c7', source: 'if-1', target: 'postgres-1', sourcePort: 0 },
            { id: 'c8', source: 'if-1', target: 'code-2', sourcePort: 1 }
        ]
    },
    {
        id: 'ai-content-generator',
        category: 'ai',
        name: {
            en: 'AI Content Generator',
            es: 'Generador de Contenido con IA'
        },
        description: {
            en: 'Generate blog posts, social media content, and email drafts using AI. Includes keyword research and SEO optimization.',
            es: 'Genera posts de blog, contenido de redes sociales y borradores de email usando IA. Incluye investigación de keywords y optimización SEO.'
        },
        nodes: [
            {
                id: 'webhook-1',
                type: 'n8n-nodes-base.webhook',
                position: { x: 100, y: 200 },
                title: 'Content Request',
                config: { path: 'generate-content', httpMethod: 'POST' }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 350, y: 200 },
                title: 'Prepare Prompt',
                config: { jsCode: `const req = $input.first().json;
const prompts = {
  blog: \`Write a detailed blog post about "\${req.topic}". Include: introduction, 3-5 main sections with headers, conclusion, and a call to action. Target audience: \${req.audience || 'general'}. Tone: \${req.tone || 'professional'}.\`,
  social: \`Create 5 engaging social media posts about "\${req.topic}" for \${req.platform || 'Twitter'}. Include relevant hashtags and emojis.\`,
  email: \`Write a marketing email about "\${req.topic}". Subject line, preview text, body with CTA button. Goal: \${req.goal || 'engagement'}.\`
};
return { type: req.type, topic: req.topic, prompt: prompts[req.type] || prompts.blog };` }
            },
            {
                id: 'openai-1',
                type: 'n8n-nodes-base.openAi',
                position: { x: 600, y: 200 },
                title: 'Generate with GPT',
                config: { operation: 'message', model: 'gpt-4', prompt: '={{$json.prompt}}', maxTokens: 2000 }
            },
            {
                id: 'code-2',
                type: 'n8n-nodes-base.code',
                position: { x: 850, y: 200 },
                title: 'Format Output',
                config: { jsCode: `const input = $input.first().json;
const content = input.message?.content || input.choices?.[0]?.message?.content || '';
return {
  type: input.type,
  topic: input.topic,
  content: content,
  word_count: content.split(/\\s+/).length,
  generated_at: new Date().toISOString(),
  model: 'gpt-4'
};` }
            },
            {
                id: 'switch-1',
                type: 'n8n-nodes-base.switch',
                position: { x: 1100, y: 200 },
                title: 'Route by Type',
                config: { rules: { rules: [{ value1: '={{$json.type}}', operation: 'equal', value2: 'blog' }, { value1: '={{$json.type}}', operation: 'equal', value2: 'social' }] } }
            },
            {
                id: 'notion-1',
                type: 'n8n-nodes-base.notion',
                position: { x: 1350, y: 100 },
                title: 'Save to Notion',
                config: { operation: 'create', databaseId: 'blog-drafts' }
            },
            {
                id: 'airtable-1',
                type: 'n8n-nodes-base.airtable',
                position: { x: 1350, y: 200 },
                title: 'Save to Airtable',
                config: { operation: 'append', table: 'Social Content' }
            },
            {
                id: 'gmail-1',
                type: 'n8n-nodes-base.gmail',
                position: { x: 1350, y: 300 },
                title: 'Save Draft',
                config: { operation: 'createDraft' }
            }
        ],
        connections: [
            { id: 'c1', source: 'webhook-1', target: 'code-1' },
            { id: 'c2', source: 'code-1', target: 'openai-1' },
            { id: 'c3', source: 'openai-1', target: 'code-2' },
            { id: 'c4', source: 'code-2', target: 'switch-1' },
            { id: 'c5', source: 'switch-1', target: 'notion-1', sourcePort: 0 },
            { id: 'c6', source: 'switch-1', target: 'airtable-1', sourcePort: 1 },
            { id: 'c7', source: 'switch-1', target: 'gmail-1', sourcePort: 2 }
        ]
    },
    {
        id: 'customer-onboarding',
        category: 'automation',
        name: {
            en: 'Customer Onboarding Flow',
            es: 'Flujo de Onboarding de Clientes'
        },
        description: {
            en: 'Automated customer onboarding: welcome email, CRM update, Slack notification, and scheduled follow-up tasks.',
            es: 'Onboarding automatizado de clientes: email de bienvenida, actualización de CRM, notificación Slack y tareas de seguimiento.'
        },
        nodes: [
            {
                id: 'webhook-1',
                type: 'n8n-nodes-base.webhook',
                position: { x: 100, y: 250 },
                title: 'New Customer',
                config: { path: 'new-customer', httpMethod: 'POST' }
            },
            {
                id: 'set-1',
                type: 'n8n-nodes-base.set',
                position: { x: 350, y: 250 },
                title: 'Enrich Data',
                config: { values: { string: [{ name: 'onboarding_status', value: 'started' }, { name: 'created_date', value: '={{new Date().toISOString()}}' }] } }
            },
            {
                id: 'gmail-1',
                type: 'n8n-nodes-base.gmail',
                position: { x: 600, y: 100 },
                title: 'Welcome Email',
                config: { operation: 'send', to: '={{$json.email}}', subject: 'Welcome to Our Platform!' }
            },
            {
                id: 'hubspot-1',
                type: 'n8n-nodes-base.hubspot',
                position: { x: 600, y: 250 },
                title: 'Create Contact',
                config: { operation: 'create', resource: 'contact' }
            },
            {
                id: 'slack-1',
                type: 'n8n-nodes-base.slack',
                position: { x: 600, y: 400 },
                title: 'Notify Team',
                config: { channel: '#new-customers', message: '🎉 New customer: {{$json.company}} - {{$json.email}}' }
            },
            {
                id: 'merge-1',
                type: 'n8n-nodes-base.merge',
                position: { x: 900, y: 250 },
                title: 'Wait for All',
                config: { mode: 'waitForAll' }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 1150, y: 250 },
                title: 'Schedule Follow-ups',
                config: { jsCode: `const customer = $input.first().json;
const followUps = [
  { type: 'check_in', days: 3, assignee: 'cs_team' },
  { type: 'feedback_request', days: 7, assignee: 'cs_team' },
  { type: 'upsell_review', days: 30, assignee: 'sales_team' }
];
return followUps.map(f => ({
  customer_id: customer.id,
  customer_email: customer.email,
  task_type: f.type,
  due_date: new Date(Date.now() + f.days * 86400000).toISOString(),
  assignee: f.assignee
}));` }
            },
            {
                id: 'postgres-1',
                type: 'n8n-nodes-base.postgres',
                position: { x: 1400, y: 250 },
                title: 'Save Tasks',
                config: { operation: 'insert', table: 'follow_up_tasks' }
            }
        ],
        connections: [
            { id: 'c1', source: 'webhook-1', target: 'set-1' },
            { id: 'c2', source: 'set-1', target: 'gmail-1' },
            { id: 'c3', source: 'set-1', target: 'hubspot-1' },
            { id: 'c4', source: 'set-1', target: 'slack-1' },
            { id: 'c5', source: 'gmail-1', target: 'merge-1' },
            { id: 'c6', source: 'hubspot-1', target: 'merge-1' },
            { id: 'c7', source: 'slack-1', target: 'merge-1' },
            { id: 'c8', source: 'merge-1', target: 'code-1' },
            { id: 'c9', source: 'code-1', target: 'postgres-1' }
        ]
    },
    {
        id: 'error-monitoring',
        category: 'webhooks',
        name: {
            en: 'Error Monitoring & Alerting',
            es: 'Monitoreo y Alertas de Errores'
        },
        description: {
            en: 'Receive errors from your application, categorize by severity, deduplicate, and send alerts to appropriate channels.',
            es: 'Recibe errores de tu aplicación, categoriza por severidad, deduplica y envía alertas a los canales apropiados.'
        },
        nodes: [
            {
                id: 'webhook-1',
                type: 'n8n-nodes-base.webhook',
                position: { x: 100, y: 200 },
                title: 'Error Webhook',
                config: { path: 'errors', httpMethod: 'POST' }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 350, y: 200 },
                title: 'Parse & Categorize',
                config: { jsCode: `const error = $input.first().json;
const severityMap = { 'TypeError': 'high', 'ReferenceError': 'high', 'NetworkError': 'medium', 'ValidationError': 'low' };
const errorType = error.type || error.name || 'Unknown';
return {
  id: error.id || Date.now().toString(),
  type: errorType,
  message: error.message?.substring(0, 500),
  stack: error.stack?.substring(0, 1000),
  severity: severityMap[errorType] || 'medium',
  service: error.service || 'unknown',
  environment: error.env || 'production',
  timestamp: error.timestamp || new Date().toISOString(),
  fingerprint: require('crypto').createHash('md5').update(errorType + error.message).digest('hex').substring(0, 16)
};` }
            },
            {
                id: 'redis-1',
                type: 'n8n-nodes-base.redis',
                position: { x: 600, y: 200 },
                title: 'Check Duplicate',
                config: { operation: 'get', key: '=error:{{$json.fingerprint}}' }
            },
            {
                id: 'if-1',
                type: 'n8n-nodes-base.if',
                position: { x: 850, y: 200 },
                title: 'Is New Error?',
                config: { conditions: { boolean: [{ value1: '={{$json.exists}}', operation: 'equal', value2: false }] } }
            },
            {
                id: 'switch-1',
                type: 'n8n-nodes-base.switch',
                position: { x: 1100, y: 150 },
                title: 'Route by Severity',
                config: { rules: { rules: [{ value1: '={{$json.severity}}', operation: 'equal', value2: 'high' }] } }
            },
            {
                id: 'pagerduty-1',
                type: 'n8n-nodes-base.pagerDuty',
                position: { x: 1350, y: 50 },
                title: 'PagerDuty Alert',
                config: { operation: 'create', severity: 'critical' }
            },
            {
                id: 'slack-1',
                type: 'n8n-nodes-base.slack',
                position: { x: 1350, y: 150 },
                title: 'Slack Warning',
                config: { channel: '#errors', message: '⚠️ [{{$json.severity}}] {{$json.type}}: {{$json.message}}' }
            },
            {
                id: 'postgres-1',
                type: 'n8n-nodes-base.postgres',
                position: { x: 1100, y: 350 },
                title: 'Log Error',
                config: { operation: 'insert', table: 'error_logs' }
            },
            {
                id: 'code-2',
                type: 'n8n-nodes-base.code',
                position: { x: 850, y: 350 },
                title: 'Update Counter',
                config: { jsCode: `return { action: 'increment_counter', fingerprint: $input.first().json.fingerprint };` }
            }
        ],
        connections: [
            { id: 'c1', source: 'webhook-1', target: 'code-1' },
            { id: 'c2', source: 'code-1', target: 'redis-1' },
            { id: 'c3', source: 'redis-1', target: 'if-1' },
            { id: 'c4', source: 'if-1', target: 'switch-1', sourcePort: 0 },
            { id: 'c5', source: 'if-1', target: 'code-2', sourcePort: 1 },
            { id: 'c6', source: 'switch-1', target: 'pagerduty-1', sourcePort: 0 },
            { id: 'c7', source: 'switch-1', target: 'slack-1', sourcePort: 1 },
            { id: 'c8', source: 'pagerduty-1', target: 'postgres-1' },
            { id: 'c9', source: 'slack-1', target: 'postgres-1' }
        ]
    },
    {
        id: 'invoice-automation',
        category: 'automation',
        name: {
            en: 'Invoice Processing Automation',
            es: 'Automatización de Procesamiento de Facturas'
        },
        description: {
            en: 'Automate invoice creation, send to customers, track payments, and send reminders for overdue invoices.',
            es: 'Automatiza la creación de facturas, envío a clientes, seguimiento de pagos y recordatorios para facturas vencidas.'
        },
        nodes: [
            {
                id: 'trigger-1',
                type: 'n8n-nodes-base.scheduleTrigger',
                position: { x: 100, y: 200 },
                title: 'Daily Check',
                config: { rule: { interval: [{ field: 'hours', hoursInterval: 24 }] } }
            },
            {
                id: 'postgres-1',
                type: 'n8n-nodes-base.postgres',
                position: { x: 350, y: 200 },
                title: 'Get Pending Invoices',
                config: { operation: 'select', query: "SELECT * FROM invoices WHERE status IN ('pending', 'overdue') AND due_date <= NOW() + INTERVAL '7 days'" }
            },
            {
                id: 'splitInBatches-1',
                type: 'n8n-nodes-base.splitInBatches',
                position: { x: 600, y: 200 },
                title: 'Process Each',
                config: { batchSize: 1 }
            },
            {
                id: 'if-1',
                type: 'n8n-nodes-base.if',
                position: { x: 850, y: 200 },
                title: 'Is Overdue?',
                config: { conditions: { string: [{ value1: '={{$json.status}}', operation: 'equal', value2: 'overdue' }] } }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 1100, y: 100 },
                title: 'Generate Reminder',
                config: { jsCode: `const invoice = $input.first().json;
const daysPastDue = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000);
return {
  ...invoice,
  reminder_type: daysPastDue > 30 ? 'final_notice' : daysPastDue > 14 ? 'second_reminder' : 'first_reminder',
  days_overdue: daysPastDue,
  late_fee: daysPastDue > 30 ? invoice.amount * 0.05 : 0
};` }
            },
            {
                id: 'gmail-1',
                type: 'n8n-nodes-base.gmail',
                position: { x: 1350, y: 100 },
                title: 'Send Reminder',
                config: { operation: 'send', to: '={{$json.customer_email}}', subject: 'Invoice Reminder: {{$json.invoice_number}}' }
            },
            {
                id: 'gmail-2',
                type: 'n8n-nodes-base.gmail',
                position: { x: 1100, y: 300 },
                title: 'Send Invoice',
                config: { operation: 'send', to: '={{$json.customer_email}}', subject: 'Invoice {{$json.invoice_number}} - Due {{$json.due_date}}' }
            },
            {
                id: 'postgres-2',
                type: 'n8n-nodes-base.postgres',
                position: { x: 1350, y: 300 },
                title: 'Update Status',
                config: { operation: 'update', table: 'invoices', updateKey: 'id' }
            }
        ],
        connections: [
            { id: 'c1', source: 'trigger-1', target: 'postgres-1' },
            { id: 'c2', source: 'postgres-1', target: 'splitInBatches-1' },
            { id: 'c3', source: 'splitInBatches-1', target: 'if-1' },
            { id: 'c4', source: 'if-1', target: 'code-1', sourcePort: 0 },
            { id: 'c5', source: 'if-1', target: 'gmail-2', sourcePort: 1 },
            { id: 'c6', source: 'code-1', target: 'gmail-1' },
            { id: 'c7', source: 'gmail-1', target: 'postgres-2' },
            { id: 'c8', source: 'gmail-2', target: 'postgres-2' },
            { id: 'c9', source: 'postgres-2', target: 'splitInBatches-1' }
        ]
    },
    {
        id: 'social-media-scheduler',
        category: 'automation',
        name: {
            en: 'Social Media Scheduler',
            es: 'Programador de Redes Sociales'
        },
        description: {
            en: 'Schedule and publish content across multiple social platforms. Includes image resizing and hashtag optimization.',
            es: 'Programa y publica contenido en múltiples plataformas sociales. Incluye redimensionado de imágenes y optimización de hashtags.'
        },
        nodes: [
            {
                id: 'airtable-1',
                type: 'n8n-nodes-base.airtable',
                position: { x: 100, y: 200 },
                title: 'Get Scheduled Posts',
                config: { operation: 'list', table: 'Content Calendar', filterByFormula: "{Status}='Scheduled'" }
            },
            {
                id: 'filter-1',
                type: 'n8n-nodes-base.filter',
                position: { x: 350, y: 200 },
                title: 'Due Now',
                config: { conditions: { dateTime: [{ value1: '={{$json.scheduled_time}}', operation: 'before', value2: '={{new Date().toISOString()}}' }] } }
            },
            {
                id: 'splitInBatches-1',
                type: 'n8n-nodes-base.splitInBatches',
                position: { x: 600, y: 200 },
                title: 'Process Each',
                config: { batchSize: 1 }
            },
            {
                id: 'switch-1',
                type: 'n8n-nodes-base.switch',
                position: { x: 850, y: 200 },
                title: 'Route by Platform',
                config: { rules: { rules: [{ value1: '={{$json.platform}}', operation: 'equal', value2: 'twitter' }, { value1: '={{$json.platform}}', operation: 'equal', value2: 'linkedin' }] } }
            },
            {
                id: 'twitter-1',
                type: 'n8n-nodes-base.twitter',
                position: { x: 1100, y: 100 },
                title: 'Post to Twitter',
                config: { operation: 'create', text: '={{$json.content}}' }
            },
            {
                id: 'linkedIn-1',
                type: 'n8n-nodes-base.linkedIn',
                position: { x: 1100, y: 200 },
                title: 'Post to LinkedIn',
                config: { operation: 'post', text: '={{$json.content}}' }
            },
            {
                id: 'facebook-1',
                type: 'n8n-nodes-base.facebookGraphApi',
                position: { x: 1100, y: 300 },
                title: 'Post to Facebook',
                config: { operation: 'post' }
            },
            {
                id: 'merge-1',
                type: 'n8n-nodes-base.merge',
                position: { x: 1350, y: 200 },
                title: 'Collect Results',
                config: { mode: 'append' }
            },
            {
                id: 'airtable-2',
                type: 'n8n-nodes-base.airtable',
                position: { x: 1600, y: 200 },
                title: 'Update Status',
                config: { operation: 'update', table: 'Content Calendar' }
            }
        ],
        connections: [
            { id: 'c1', source: 'airtable-1', target: 'filter-1' },
            { id: 'c2', source: 'filter-1', target: 'splitInBatches-1' },
            { id: 'c3', source: 'splitInBatches-1', target: 'switch-1' },
            { id: 'c4', source: 'switch-1', target: 'twitter-1', sourcePort: 0 },
            { id: 'c5', source: 'switch-1', target: 'linkedIn-1', sourcePort: 1 },
            { id: 'c6', source: 'switch-1', target: 'facebook-1', sourcePort: 2 },
            { id: 'c7', source: 'twitter-1', target: 'merge-1' },
            { id: 'c8', source: 'linkedIn-1', target: 'merge-1' },
            { id: 'c9', source: 'facebook-1', target: 'merge-1' },
            { id: 'c10', source: 'merge-1', target: 'airtable-2' },
            { id: 'c11', source: 'airtable-2', target: 'splitInBatches-1' }
        ]
    },
    {
        id: 'data-sync-bidirectional',
        category: 'data',
        name: {
            en: 'Bi-directional Data Sync',
            es: 'Sincronización Bidireccional de Datos'
        },
        description: {
            en: 'Keep data synchronized between two systems. Handles conflicts, tracks changes, and logs all sync operations.',
            es: 'Mantiene datos sincronizados entre dos sistemas. Maneja conflictos, rastrea cambios y registra todas las operaciones.'
        },
        nodes: [
            {
                id: 'trigger-1',
                type: 'n8n-nodes-base.scheduleTrigger',
                position: { x: 100, y: 200 },
                title: 'Sync Interval',
                config: { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } }
            },
            {
                id: 'postgres-1',
                type: 'n8n-nodes-base.postgres',
                position: { x: 350, y: 100 },
                title: 'Get Local Changes',
                config: { operation: 'select', query: 'SELECT * FROM contacts WHERE updated_at > {{$json.last_sync}}' }
            },
            {
                id: 'salesforce-1',
                type: 'n8n-nodes-base.salesforce',
                position: { x: 350, y: 300 },
                title: 'Get Remote Changes',
                config: { operation: 'getAll', resource: 'contact', query: "LastModifiedDate > {{$json.last_sync}}" }
            },
            {
                id: 'merge-1',
                type: 'n8n-nodes-base.merge',
                position: { x: 600, y: 200 },
                title: 'Combine Changes',
                config: { mode: 'combine', mergeByFields: { values: [{ field1: 'email', field2: 'Email' }] } }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 850, y: 200 },
                title: 'Resolve Conflicts',
                config: { jsCode: `const items = $input.all();
return items.map(item => {
  const json = item.json;
  const localUpdated = new Date(json.updated_at || 0);
  const remoteUpdated = new Date(json.LastModifiedDate || 0);
  const winner = localUpdated > remoteUpdated ? 'local' : 'remote';
  return {
    email: json.email || json.Email,
    name: winner === 'local' ? json.name : json.Name,
    phone: winner === 'local' ? json.phone : json.Phone,
    source: winner,
    needs_local_update: winner === 'remote',
    needs_remote_update: winner === 'local'
  };
});` }
            },
            {
                id: 'if-1',
                type: 'n8n-nodes-base.if',
                position: { x: 1100, y: 200 },
                title: 'Has Changes?',
                config: { conditions: { boolean: [{ value1: '={{$json.needs_local_update || $json.needs_remote_update}}', operation: 'equal', value2: true }] } }
            },
            {
                id: 'postgres-2',
                type: 'n8n-nodes-base.postgres',
                position: { x: 1350, y: 100 },
                title: 'Update Local',
                config: { operation: 'update', table: 'contacts', updateKey: 'email' }
            },
            {
                id: 'salesforce-2',
                type: 'n8n-nodes-base.salesforce',
                position: { x: 1350, y: 300 },
                title: 'Update Remote',
                config: { operation: 'update', resource: 'contact' }
            },
            {
                id: 'postgres-3',
                type: 'n8n-nodes-base.postgres',
                position: { x: 1600, y: 200 },
                title: 'Log Sync',
                config: { operation: 'insert', table: 'sync_logs' }
            }
        ],
        connections: [
            { id: 'c1', source: 'trigger-1', target: 'postgres-1' },
            { id: 'c2', source: 'trigger-1', target: 'salesforce-1' },
            { id: 'c3', source: 'postgres-1', target: 'merge-1' },
            { id: 'c4', source: 'salesforce-1', target: 'merge-1' },
            { id: 'c5', source: 'merge-1', target: 'code-1' },
            { id: 'c6', source: 'code-1', target: 'if-1' },
            { id: 'c7', source: 'if-1', target: 'postgres-2', sourcePort: 0 },
            { id: 'c8', source: 'if-1', target: 'salesforce-2', sourcePort: 0 },
            { id: 'c9', source: 'postgres-2', target: 'postgres-3' },
            { id: 'c10', source: 'salesforce-2', target: 'postgres-3' }
        ]
    }
];

export async function GET() {
    return NextResponse.json(TEMPLATES);
}
