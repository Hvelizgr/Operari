export const WORKFLOW_TEMPLATES = [
    // 1. API Data Fetcher - Simple linear flow
    {
        id: 'api-data-fetcher',
        name: { en: 'API Data Fetcher', es: 'Obtener Datos de API' },
        description: {
            en: 'Fetch data from any API endpoint and process the response',
            es: 'Obtiene datos de cualquier endpoint API y procesa la respuesta'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 350, y: 200 }, title: 'HTTP Request', type: 'n8n-nodes-base.httpRequest', config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts/1' } },
            { id: 'node-3', position: { x: 600, y: 200 }, title: 'Set Fields', type: 'n8n-nodes-base.set', config: {} },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
    // 2. Conditional Router - Branching flow
    {
        id: 'conditional-router',
        name: { en: 'Conditional Router', es: 'Enrutador Condicional' },
        description: {
            en: 'Route data to different paths based on conditions',
            es: 'Dirige datos a diferentes rutas según condiciones'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 350, y: 200 }, title: 'Set Data', type: 'n8n-nodes-base.set', config: {} },
            { id: 'node-3', position: { x: 600, y: 200 }, title: 'IF Condition', type: 'n8n-nodes-base.if', config: {} },
            { id: 'node-4', position: { x: 900, y: 100 }, title: 'True Path', type: 'n8n-nodes-base.set', config: {} },
            { id: 'node-5', position: { x: 900, y: 300 }, title: 'False Path', type: 'n8n-nodes-base.set', config: {} },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4', sourcePort: 0 },
            { id: 'conn-4', source: 'node-3', target: 'node-5', sourcePort: 1 },
        ],
    },
    // 3. Data Transformer - Process and transform data
    {
        id: 'data-transformer',
        name: { en: 'Data Transformer', es: 'Transformador de Datos' },
        description: {
            en: 'Transform and manipulate data with code',
            es: 'Transforma y manipula datos con código'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 350, y: 200 }, title: 'Sample Data', type: 'n8n-nodes-base.set', config: {} },
            { id: 'node-3', position: { x: 600, y: 200 }, title: 'Transform', type: 'n8n-nodes-base.code', config: { language: 'javaScript' } },
            { id: 'node-4', position: { x: 850, y: 200 }, title: 'Output', type: 'n8n-nodes-base.set', config: {} },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
        ],
    },
    // 4. Webhook Handler - Receive external webhooks
    {
        id: 'webhook-handler',
        name: { en: 'Webhook Handler', es: 'Manejador de Webhooks' },
        description: {
            en: 'Receive and process incoming webhooks',
            es: 'Recibe y procesa webhooks entrantes'
        },
        category: 'webhooks',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Webhook', type: 'n8n-nodes-base.webhook', config: { httpMethod: 'POST', path: 'my-webhook' } },
            { id: 'node-2', position: { x: 350, y: 200 }, title: 'Process', type: 'n8n-nodes-base.code', config: { language: 'javaScript' } },
            { id: 'node-3', position: { x: 600, y: 200 }, title: 'Respond', type: 'n8n-nodes-base.respondToWebhook', config: {} },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
    // 5. Scheduled Task - Cron-based automation
    {
        id: 'scheduled-task',
        name: { en: 'Scheduled Task', es: 'Tarea Programada' },
        description: {
            en: 'Run automated tasks on a schedule',
            es: 'Ejecuta tareas automatizadas según horario'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Schedule', type: 'n8n-nodes-base.scheduleTrigger', config: { rule: { interval: [{ field: 'hours', hoursInterval: 1 }] } } },
            { id: 'node-2', position: { x: 350, y: 200 }, title: 'Fetch Data', type: 'n8n-nodes-base.httpRequest', config: { method: 'GET' } },
            { id: 'node-3', position: { x: 600, y: 200 }, title: 'Process', type: 'n8n-nodes-base.code', config: { language: 'javaScript' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
    // 6. Data Merger - Combine multiple data sources
    {
        id: 'data-merger',
        name: { en: 'Data Merger', es: 'Combinador de Datos' },
        description: {
            en: 'Merge data from multiple sources into one',
            es: 'Combina datos de múltiples fuentes en uno'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 350, y: 100 }, title: 'Source A', type: 'n8n-nodes-base.httpRequest', config: { method: 'GET' } },
            { id: 'node-3', position: { x: 350, y: 300 }, title: 'Source B', type: 'n8n-nodes-base.httpRequest', config: { method: 'GET' } },
            { id: 'node-4', position: { x: 600, y: 200 }, title: 'Merge', type: 'n8n-nodes-base.merge', config: { mode: 'combine' } },
            { id: 'node-5', position: { x: 850, y: 200 }, title: 'Output', type: 'n8n-nodes-base.set', config: {} },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-1', target: 'node-3' },
            { id: 'conn-3', source: 'node-2', target: 'node-4' },
            { id: 'conn-4', source: 'node-3', target: 'node-4' },
            { id: 'conn-5', source: 'node-4', target: 'node-5' },
        ],
    },
    // 7. Error Handler - Try/Catch pattern
    {
        id: 'error-handler',
        name: { en: 'Error Handler', es: 'Manejador de Errores' },
        description: {
            en: 'Handle errors gracefully with fallback logic',
            es: 'Maneja errores con lógica de respaldo'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 350, y: 200 }, title: 'Try Request', type: 'n8n-nodes-base.httpRequest', config: { method: 'GET', options: { allowUnauthorizedCerts: true } } },
            { id: 'node-3', position: { x: 600, y: 100 }, title: 'Success', type: 'n8n-nodes-base.set', config: {} },
            { id: 'node-4', position: { x: 600, y: 300 }, title: 'On Error', type: 'n8n-nodes-base.set', config: {} },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-2', target: 'node-4', sourcePort: 1 },
        ],
    },
    // 8. Loop Iterator - Process items one by one
    {
        id: 'loop-iterator',
        name: { en: 'Loop Iterator', es: 'Iterador de Loop' },
        description: {
            en: 'Process multiple items in a loop',
            es: 'Procesa múltiples items en un loop'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 350, y: 200 }, title: 'Get Items', type: 'n8n-nodes-base.httpRequest', config: { method: 'GET' } },
            { id: 'node-3', position: { x: 600, y: 200 }, title: 'Split Batches', type: 'n8n-nodes-base.splitInBatches', config: { batchSize: 1 } },
            { id: 'node-4', position: { x: 850, y: 200 }, title: 'Process Each', type: 'n8n-nodes-base.code', config: { language: 'javaScript' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
            { id: 'conn-4', source: 'node-4', target: 'node-3' },
        ],
    },
];
