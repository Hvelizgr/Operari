export const WORKFLOW_TEMPLATES = [
    // 1. User Data Pipeline (5 nodes) - Linear flow
    {
        id: 'user-data-pipeline',
        name: { en: 'User Data Pipeline', es: 'Pipeline de Datos de Usuario' },
        description: {
            en: 'Fetch random users, filter adults, transform and format output!',
            es: 'Obtiene usuarios aleatorios, filtra adultos, transforma y formatea!'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 300, y: 200 }, title: 'Fetch Users', type: 'n8n-nodes-base.httpRequest', config: { url: 'https://randomuser.me/api/?results=5', method: 'GET' } },
            { id: 'node-3', position: { x: 500, y: 200 }, title: 'Extract', type: 'n8n-nodes-base.code', config: { jsCode: 'return input.data?.results || [];' } },
            { id: 'node-4', position: { x: 700, y: 200 }, title: 'Filter Adults', type: 'n8n-nodes-base.code', config: { jsCode: 'const users = Array.isArray(input) ? input : [];\nreturn users.filter(u => u.dob && u.dob.age >= 18);' } },
            { id: 'node-5', position: { x: 900, y: 200 }, title: 'Format', type: 'n8n-nodes-base.code', config: { jsCode: 'const users = Array.isArray(input) ? input : [];\nreturn users.map(u => ({ name: u.name?.first + " " + u.name?.last, age: u.dob?.age }));' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
            { id: 'conn-4', source: 'node-4', target: 'node-5' },
        ],
    },
    // 2. Weather Info (4 nodes) - Linear flow
    {
        id: 'weather-info',
        name: { en: 'Weather Information', es: 'Información del Clima' },
        description: {
            en: 'Fetches real weather data and formats a nice report!',
            es: 'Obtiene datos del clima real y genera un reporte!'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 300, y: 200 }, title: 'Get Weather', type: 'n8n-nodes-base.httpRequest', config: { url: 'https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current_weather=true', method: 'GET' } },
            { id: 'node-3', position: { x: 550, y: 200 }, title: 'Extract Temp', type: 'n8n-nodes-base.code', config: { jsCode: 'const weather = input.data?.current_weather || {};\nreturn { temp: weather.temperature, windspeed: weather.windspeed, time: weather.time };' } },
            { id: 'node-4', position: { x: 800, y: 200 }, title: 'Format Report', type: 'n8n-nodes-base.code', config: { jsCode: 'return { report: "NYC Weather", temperature: input.temp + "°C", wind: input.windspeed + " km/h", timestamp: input.time };' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
        ],
    },
    // 3. Bitcoin Price (4 nodes) - Linear flow  
    {
        id: 'bitcoin-price',
        name: { en: 'Bitcoin Price Tracker', es: 'Rastreador de Precio Bitcoin' },
        description: {
            en: 'Fetches current Bitcoin price and formats it nicely!',
            es: 'Obtiene el precio actual de Bitcoin y lo formatea!'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 300, y: 200 }, title: 'Get BTC Price (Sim)', type: 'n8n-nodes-base.code', config: { jsCode: 'const rate = 96000 + Math.random() * 1000;\nreturn { data: { bpi: { USD: { rate_float: rate }, EUR: { rate_float: rate * 0.92 } } } };' } },
            { id: 'node-3', position: { x: 550, y: 200 }, title: 'Extract Price', type: 'n8n-nodes-base.code', config: { jsCode: 'const bpi = input.data?.bpi || {};\nreturn { usd: bpi.USD?.rate_float, eur: bpi.EUR?.rate_float };' } },
            { id: 'node-4', position: { x: 800, y: 200 }, title: 'Format Report', type: 'n8n-nodes-base.code', config: { jsCode: 'return { coin: "Bitcoin", priceUSD: "$" + (input.usd || 0).toLocaleString(), priceEUR: "€" + (input.eur || 0).toLocaleString(), timestamp: new Date().toISOString() };' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
        ],
    },
    // 4. IP Geolocation (5 nodes) - Linear flow
    {
        id: 'ip-geolocation',
        name: { en: 'IP Geolocation Lookup', es: 'Geolocalización por IP' },
        description: {
            en: 'Get your public IP and location information!',
            es: 'Obtiene tu IP pública e información de ubicación!'
        },
        category: 'webhooks',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 300, y: 200 }, title: 'Get IP Info (Sim)', type: 'n8n-nodes-base.code', config: { jsCode: 'return { data: { ip: "104.28.20.15", city: "San Francisco", region: "California", country: "United States", timezone: { id: "America/Los_Angeles" } } };' } },
            { id: 'node-3', position: { x: 500, y: 200 }, title: 'Extract', type: 'n8n-nodes-base.code', config: { jsCode: 'const d = input.data || {};\nreturn { ip: d.ip, city: d.city, region: d.region, country: d.country, timezone: d.timezone?.id || "UTC" };' } },
            { id: 'node-4', position: { x: 700, y: 200 }, title: 'Add Time', type: 'n8n-nodes-base.code', config: { jsCode: 'return { ...input, localTime: new Date().toLocaleString() };' } },
            { id: 'node-5', position: { x: 900, y: 200 }, title: 'Format', type: 'n8n-nodes-base.code', config: { jsCode: 'return { title: "Your Location", ip: input.ip, location: input.city + ", " + input.country, time: input.localTime };' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
            { id: 'conn-4', source: 'node-4', target: 'node-5' },
        ],
    },
    // 5. Todo List Manager (6 nodes) - Linear flow
    {
        id: 'todo-manager',
        name: { en: 'Todo List Manager', es: 'Gestor de Tareas' },
        description: {
            en: 'Fetch todos from API, filter and count pending tasks!',
            es: 'Obtiene tareas de API, filtra y cuenta las pendientes!'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 280, y: 200 }, title: 'Fetch Todos', type: 'n8n-nodes-base.httpRequest', config: { url: 'https://jsonplaceholder.typicode.com/todos?_limit=20', method: 'GET' } },
            { id: 'node-3', position: { x: 460, y: 200 }, title: 'Get Array', type: 'n8n-nodes-base.code', config: { jsCode: 'return Array.isArray(input.data) ? input.data : [];' } },
            { id: 'node-4', position: { x: 640, y: 200 }, title: 'Filter Pending', type: 'n8n-nodes-base.code', config: { jsCode: 'const todos = Array.isArray(input) ? input : [];\nreturn todos.filter(t => !t.completed);' } },
            { id: 'node-5', position: { x: 820, y: 200 }, title: 'Format List', type: 'n8n-nodes-base.code', config: { jsCode: 'const todos = Array.isArray(input) ? input : [];\nreturn todos.slice(0,5).map(t => ({ id: t.id, task: t.title?.substring(0,30) }));' } },
            { id: 'node-6', position: { x: 1000, y: 200 }, title: 'Summary', type: 'n8n-nodes-base.code', config: { jsCode: 'const tasks = Array.isArray(input) ? input : [];\nreturn { pending: tasks.length, preview: tasks, message: "You have " + tasks.length + " pending tasks" };' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
            { id: 'conn-4', source: 'node-4', target: 'node-5' },
            { id: 'conn-5', source: 'node-5', target: 'node-6' },
        ],
    },
    // 6. Random Number Generator (5 nodes) - Linear
    {
        id: 'number-processor',
        name: { en: 'Random Number Generator', es: 'Generador de Números' },
        description: {
            en: 'Generates random numbers and categorizes them - no external APIs!',
            es: 'Genera números aleatorios y los categoriza - sin APIs externas!'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 300, y: 200 }, title: 'Generate', type: 'n8n-nodes-base.code', config: { jsCode: 'return Array.from({length: 5}, (_, i) => ({ id: i+1, value: Math.floor(Math.random() * 100) }));' } },
            { id: 'node-3', position: { x: 500, y: 200 }, title: 'Categorize', type: 'n8n-nodes-base.code', config: { jsCode: 'const nums = Array.isArray(input) ? input : [];\nreturn nums.map(n => ({ ...n, category: n.value > 75 ? "HIGH" : n.value > 25 ? "MEDIUM" : "LOW" }));' } },
            { id: 'node-4', position: { x: 700, y: 200 }, title: 'Stats', type: 'n8n-nodes-base.code', config: { jsCode: 'const nums = Array.isArray(input) ? input : [];\nconst high = nums.filter(n => n.category === "HIGH").length;\nconst med = nums.filter(n => n.category === "MEDIUM").length;\nconst low = nums.filter(n => n.category === "LOW").length;\nreturn { high, medium: med, low, total: nums.length };' } },
            { id: 'node-5', position: { x: 900, y: 200 }, title: 'Report', type: 'n8n-nodes-base.code', config: { jsCode: 'return { report: "Number Analysis", ...input, timestamp: new Date().toISOString() };' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
            { id: 'conn-4', source: 'node-4', target: 'node-5' },
        ],
    },
    // 7. Cat Facts (5 nodes) - Linear flow
    {
        id: 'cat-facts',
        name: { en: 'Cat Facts Collector', es: 'Colector de Datos de Gatos' },
        description: {
            en: 'Fetches random cat facts and formats them nicely!',
            es: 'Obtiene datos aleatorios de gatos y los formatea!'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 300, y: 200 }, title: 'Get Facts', type: 'n8n-nodes-base.httpRequest', config: { url: 'https://catfact.ninja/facts?limit=5', method: 'GET' } },
            { id: 'node-3', position: { x: 500, y: 200 }, title: 'Extract', type: 'n8n-nodes-base.code', config: { jsCode: 'return input.data?.data || [];' } },
            { id: 'node-4', position: { x: 700, y: 200 }, title: 'Format', type: 'n8n-nodes-base.code', config: { jsCode: 'const facts = Array.isArray(input) ? input : [];\nreturn facts.map((f, i) => ({ id: i+1, fact: f.fact?.substring(0,80) + "..." }));' } },
            { id: 'node-5', position: { x: 900, y: 200 }, title: 'Summary', type: 'n8n-nodes-base.code', config: { jsCode: 'const facts = Array.isArray(input) ? input : [];\nreturn { title: "Cat Facts", count: facts.length, facts: facts };' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
            { id: 'conn-4', source: 'node-4', target: 'node-5' },
        ],
    },
    // 8. Posts Analyzer (6 nodes) - Linear flow
    {
        id: 'posts-analyzer',
        name: { en: 'Posts Analyzer', es: 'Analizador de Posts' },
        description: {
            en: 'Fetches posts, analyzes them and generates statistics!',
            es: 'Obtiene posts, los analiza y genera estadísticas!'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 80, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 240, y: 200 }, title: 'Fetch Posts', type: 'n8n-nodes-base.httpRequest', config: { url: 'https://jsonplaceholder.typicode.com/posts?_limit=10', method: 'GET' } },
            { id: 'node-3', position: { x: 400, y: 200 }, title: 'Get Array', type: 'n8n-nodes-base.code', config: { jsCode: 'return Array.isArray(input.data) ? input.data : [];' } },
            { id: 'node-4', position: { x: 560, y: 200 }, title: 'Analyze', type: 'n8n-nodes-base.code', config: { jsCode: 'const posts = Array.isArray(input) ? input : [];\nconst avgLen = posts.reduce((s,p) => s + (p.body?.length || 0), 0) / (posts.length || 1);\nreturn { posts, avgBodyLength: Math.round(avgLen) };' } },
            { id: 'node-5', position: { x: 720, y: 200 }, title: 'Top Posts', type: 'n8n-nodes-base.code', config: { jsCode: 'const posts = input.posts || [];\nreturn { top3: posts.slice(0,3).map(p => p.title), avgLen: input.avgBodyLength };' } },
            { id: 'node-6', position: { x: 880, y: 200 }, title: 'Report', type: 'n8n-nodes-base.code', config: { jsCode: 'return { title: "Posts Analysis", topPosts: input.top3, averageLength: input.avgLen + " chars", timestamp: new Date().toISOString() };' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
            { id: 'conn-4', source: 'node-4', target: 'node-5' },
            { id: 'conn-5', source: 'node-5', target: 'node-6' },
        ],
    },
    // 9. Order Calculator (7 nodes) - Linear flow
    {
        id: 'order-calculator',
        name: { en: 'Order Price Calculator', es: 'Calculador de Precios' },
        description: {
            en: 'Simulates order flow: calculate subtotal, tax, discount, and total!',
            es: 'Simula flujo de orden: calcula subtotal, impuesto, descuento y total!'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 50, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 200, y: 200 }, title: 'Create Order', type: 'n8n-nodes-base.code', config: { jsCode: 'return { orderId: "ORD-" + Math.random().toString(36).substr(2,6).toUpperCase(), items: [{name: "Widget", price: 29.99, qty: 2}, {name: "Gadget", price: 49.99, qty: 1}], customer: "John Doe" };' } },
            { id: 'node-3', position: { x: 380, y: 200 }, title: 'Calc Subtotal', type: 'n8n-nodes-base.code', config: { jsCode: 'const items = input.items || [];\nconst subtotal = items.reduce((s,i) => s + (i.price * i.qty), 0);\nreturn { ...input, subtotal: subtotal.toFixed(2) };' } },
            { id: 'node-4', position: { x: 560, y: 200 }, title: 'Apply Discount', type: 'n8n-nodes-base.code', config: { jsCode: 'const sub = parseFloat(input.subtotal) || 0;\nconst discountRate = sub > 100 ? 0.1 : 0;\nconst discount = (sub * discountRate).toFixed(2);\nreturn { ...input, discount, afterDiscount: (sub - discount).toFixed(2) };' } },
            { id: 'node-5', position: { x: 740, y: 200 }, title: 'Add Tax', type: 'n8n-nodes-base.code', config: { jsCode: 'const amount = parseFloat(input.afterDiscount) || 0;\nconst tax = (amount * 0.08).toFixed(2);\nreturn { ...input, tax, afterTax: (amount + parseFloat(tax)).toFixed(2) };' } },
            { id: 'node-6', position: { x: 920, y: 200 }, title: 'Add Shipping', type: 'n8n-nodes-base.code', config: { jsCode: 'const amount = parseFloat(input.afterTax) || 0;\nconst shipping = amount > 75 ? 0 : 9.99;\nreturn { ...input, shipping, total: (amount + shipping).toFixed(2) };' } },
            { id: 'node-7', position: { x: 1100, y: 200 }, title: 'Invoice', type: 'n8n-nodes-base.code', config: { jsCode: 'return { invoice: input.orderId, customer: input.customer, subtotal: "$" + input.subtotal, discount: "-$" + input.discount, tax: "+$" + input.tax, shipping: input.shipping === 0 ? "FREE" : "+$" + input.shipping, total: "$" + input.total };' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
            { id: 'conn-4', source: 'node-4', target: 'node-5' },
            { id: 'conn-5', source: 'node-5', target: 'node-6' },
            { id: 'conn-6', source: 'node-6', target: 'node-7' },
        ],
    },
    // 10. Smart Lead Qualification (Curved branches)
    {
        id: 'smart-lead-routing',
        name: { en: 'Smart Lead Qualification', es: 'Calificación de Leads' },
        description: {
            en: 'Capture lead, score them, and route based on company size!',
            es: 'Captura prospectos, los califica y los dirige según el tamaño de la empresa!'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: -300, y: 100 }, title: 'Manual Trigger', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: -100, y: 100 }, title: 'Mock Lead', type: 'n8n-nodes-base.code', config: { jsCode: 'return { name: "Alice Smith", email: "alice@mega-corp.com", employees: 500, source: "Web" };' } },
            { id: 'node-3', position: { x: 200, y: 100 }, title: 'Enterprise?', type: 'n8n-nodes-base.if', config: { conditions: { number: [{ value1: '={{$json.employees}}', operation: 'larger', value2: 200 }] } } },
            { id: 'node-4', position: { x: 550, y: -50 }, title: 'High Priority', type: 'n8n-nodes-base.code', config: { jsCode: 'return { ...input, priority: "HIGH", team: "Sales-US" };' } },
            { id: 'node-5', position: { x: 550, y: 250 }, title: 'Self-Serve', type: 'n8n-nodes-base.code', config: { jsCode: 'return { ...input, priority: "LOW", team: "Support-Global" };' } },
            { id: 'node-6', position: { x: 850, y: 100 }, title: 'CRM Sync', type: 'n8n-nodes-base.code', config: { jsCode: 'return { status: "Created", id: "CRM-" + Date.now(), ...input };' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4', sourcePort: 0, condition: 'success' }, // True branch
            { id: 'conn-4', source: 'node-3', target: 'node-5', sourcePort: 1, condition: 'warning' }, // False branch
            { id: 'conn-5', source: 'node-4', target: 'node-6' },
            { id: 'conn-6', source: 'node-5', target: 'node-6' },
        ],
    },
    // 11. AI Agent Research (Complex pattern)
    {
        id: 'ai-agent-research',
        name: { en: 'AI Agent Researcher', es: 'Investigador Agente AI' },
        description: {
            en: 'Multi-step AI flow with search, extraction and summary!',
            es: 'Flujo AI de varios pasos con búsqueda, extracción y resumen!'
        },
        category: 'ai',
        nodes: [
            { id: 'node-1', position: { x: -300, y: 100 }, title: 'Topic Input', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: -50, y: 100 }, title: 'Search Topic', type: 'n8n-nodes-base.httpRequest', config: { url: 'https://jsonplaceholder.typicode.com/posts?_limit=3', method: 'GET' } },
            { id: 'node-3', position: { x: 250, y: 100 }, title: 'Model: GPT-4', type: 'n8n-nodes-base.code', config: { jsCode: 'return { prompt: "Analyze this data: " + input.map(p => p.title).join(", "), model: "gpt-4o" };' } },
            { id: 'node-4', position: { x: 550, y: 100 }, title: 'Extract Insights', type: 'n8n-nodes-base.code', config: { jsCode: 'return { insights: ["AI Trend: " + input.prompt, "Market is growing", "Privacy focus" ], tokens: 540 };' } },
            { id: 'node-5', position: { x: 850, y: 100 }, title: 'Format PDF', type: 'n8n-nodes-base.code', config: { jsCode: 'return { filename: "report.pdf", content: "..." };' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
            { id: 'conn-4', source: 'node-4', target: 'node-5' },
        ],
    },
    // 12. Crypto Arbitrage Monitor (Zero-Touch)
    {
        id: 'crypto-arbitrage',
        name: { en: 'Crypto Arbitrage Monitor', es: 'Monitor de Arbitraje Crypto' },
        description: {
            en: 'Monitors multiple exchanges for price differences and executes trades.',
            es: 'Monitorea diferencias de precio entre exchanges y ejecuta operaciones.'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 300 }, title: 'Start Monitor', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 350, y: 200 }, title: 'Fetch Binance (Sim)', type: 'n8n-nodes-base.code', config: { jsCode: 'return { data: { amount: (95000 + Math.random() * 200).toString(), currency: "USD" } };' } },
            { id: 'node-3', position: { x: 350, y: 400 }, title: 'Fetch Kraken (Sim)', type: 'n8n-nodes-base.code', config: { jsCode: 'return { data: { amount: (95100 + Math.random() * 200).toString(), currency: "USD" } };' } },
            { id: 'node-4', position: { x: 650, y: 300 }, title: 'Calc Spread', type: 'n8n-nodes-base.code', config: { jsCode: 'const binance = parseFloat(input.data?.amount) || 95000;\nconst kraken = parseFloat(input.data?.amount) || 95200;\nconst spread = binance - kraken;\nconst profit = Math.abs(spread);\nreturn { binance, kraken, spread, profit, action: profit > 10 ? "TRADE" : "HOLD" };' } },
            { id: 'node-5', position: { x: 900, y: 300 }, title: 'Is Profitable?', type: 'n8n-nodes-base.if', config: { field: 'action', operator: 'equals', value: 'TRADE' } },
            { id: 'node-6', position: { x: 1200, y: 200 }, title: '⚡ EXECUTE BUY', type: 'n8n-nodes-base.code', config: { jsCode: 'return { status: "ORDER_FILLED", pair: "BTC/USD", profit: input.profit, msg: "Trade executed successfully!" };' } },
            { id: 'node-7', position: { x: 1200, y: 400 }, title: 'Log & Wait', type: 'n8n-nodes-base.code', config: { jsCode: 'return { status: "SKIPPED", spread: input.spread, msg: "Spread too low, waiting..." };' } },
        ],
        connections: [
            { id: 'c1', source: 'node-1', target: 'node-2' },
            { id: 'c2', source: 'node-1', target: 'node-3' },
            { id: 'c3', source: 'node-2', target: 'node-4' },
            { id: 'c4', source: 'node-3', target: 'node-4' },
            { id: 'c5', source: 'node-4', target: 'node-5' },
            { id: 'c6', source: 'node-5', target: 'node-6', sourcePort: 0, condition: 'true' }, // Output 0 = True
            { id: 'c7', source: 'node-5', target: 'node-7', sourcePort: 1, condition: 'false' }, // Output 1 = False
        ],
    },
    // 13. AI Customer Support Triage (Simulation)
    {
        id: 'ai-support-triage',
        name: { en: 'AI Support Ticket Triage', es: 'Clasificación de Soporte AI' },
        description: {
            en: 'Analyzes incoming tickets, detects sentiment, and routes VIPs automatically.',
            es: 'Analiza tickets entrantes, detecta sentimientos y enruta VIPs automáticamente.'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 300 }, title: 'New Ticket', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 300, y: 300 }, title: 'Mock Ticket', type: 'n8n-nodes-base.code', config: { jsCode: 'const tickets = [\n  { user: "vip_john", text: "My server is DOWN! Fix immediately!", type: "outage" },\n  { user: "guest_2", text: "How do I reset my password?", type: "question" }\n];\nreturn tickets[Math.floor(Math.random() * tickets.length)];' } },
            { id: 'node-3', position: { x: 550, y: 300 }, title: 'Analyze Sentiment', type: 'n8n-nodes-base.code', config: { jsCode: 'const sentiment = input.text.includes("DOWN") || input.text.includes("!") ? "NEGATIVE" : "NEUTRAL";\nreturn { ...input, sentiment, score: sentiment === "NEGATIVE" ? 0.1 : 0.8 };' } },
            { id: 'node-4', position: { x: 800, y: 300 }, title: 'Is Urgent?', type: 'n8n-nodes-base.if', config: { field: 'sentiment', operator: 'equals', value: 'NEGATIVE' } },
            { id: 'node-5', position: { x: 1050, y: 200 }, title: 'Is VIP?', type: 'n8n-nodes-base.if', config: { condition: 'input.user.startsWith("vip")' } },
            { id: 'node-6', position: { x: 1300, y: 150 }, title: '🚨 PagerDuty', type: 'n8n-nodes-base.code', config: { jsCode: 'return { alert: "SENT", priority: "CRITICAL", user: input.user };' } },
            { id: 'node-7', position: { x: 1300, y: 300 }, title: 'Standard Queue', type: 'n8n-nodes-base.code', config: { jsCode: 'return { ticket: "CREATED", priority: "NORMAL", queue: "Support" };' } },
            { id: 'node-8', position: { x: 1050, y: 450 }, title: 'Auto-Reply', type: 'n8n-nodes-base.code', config: { jsCode: 'return { email: "SENT", template: "faq_reset_password", status: "RESOLVED" };' } },
        ],
        connections: [
            { id: 'c1', source: 'node-1', target: 'node-2' },
            { id: 'c2', source: 'node-2', target: 'node-3' },
            { id: 'c3', source: 'node-3', target: 'node-4' },
            { id: 'c4', source: 'node-4', target: 'node-5', sourcePort: 0 }, // True -> VIP check
            { id: 'c5', source: 'node-4', target: 'node-8', sourcePort: 1 }, // False -> Auto Reply
            { id: 'c6', source: 'node-5', target: 'node-6', sourcePort: 0 }, // VIP True -> PagerDuty
            { id: 'c7', source: 'node-5', target: 'node-7', sourcePort: 1 }, // VIP False -> Standard
        ],
    },
    // 14. Server Health Auto-Healing
    {
        id: 'server-auto-healing',
        name: { en: 'Server Auto-Healing', es: 'Auto-Reparación de Servidores' },
        description: {
            en: 'Monitors server metrics and automatically restarts services if critical.',
            es: 'Monitorea métricas y reinicia servicios automáticamente si es crítico.'
        },
        category: 'webhooks', // simulates infrastructure webhook
        nodes: [
            { id: 'node-1', position: { x: 100, y: 300 }, title: 'Cron Check', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 300, y: 300 }, title: 'Check CPU', type: 'n8n-nodes-base.code', config: { jsCode: 'return { usage: Math.floor(Math.random() * 40) + 70, unit: "%" }; // Simulates 70-110% load' } },
            { id: 'node-3', position: { x: 300, y: 150 }, title: 'Check Memory', type: 'n8n-nodes-base.code', config: { jsCode: 'return { free: Math.floor(Math.random() * 500), total: 4096 };' } },
            { id: 'node-4', position: { x: 600, y: 300 }, title: 'Health Logic', type: 'n8n-nodes-base.code', config: { jsCode: 'const cpu = input.usage || 0;\nconst mem = input.free || 1000;\nconst status = (cpu > 90 || mem < 200) ? "CRITICAL" : "HEALTHY";\nreturn { cpu, mem, status };' } },
            { id: 'node-5', position: { x: 850, y: 300 }, title: 'Routing', type: 'n8n-nodes-base.if', config: { field: 'status', operator: 'equals', value: 'CRITICAL' } },
            { id: 'node-6', position: { x: 1100, y: 200 }, title: 'Restart Service', type: 'n8n-nodes-base.code', config: { jsCode: 'return { action: "RESTART_NGINX", result: "SUCCESS", timestamp: new Date() };' } },
            { id: 'node-7', position: { x: 1350, y: 200 }, title: 'Notify Admin', type: 'n8n-nodes-base.httpRequest', config: { url: 'https://reqres.in/api/users', method: 'POST', body: { msg: 'Server Restarted', admin: 'admin@host.com' } } },
            { id: 'node-8', position: { x: 1100, y: 400 }, title: 'Log Metrics', type: 'n8n-nodes-base.code', config: { jsCode: 'return { log: "wrote_to_db", status: "OK" };' } },
        ],
        connections: [
            { id: 'c1', source: 'node-1', target: 'node-2' },
            { id: 'c2', source: 'node-1', target: 'node-3' },
            { id: 'c3', source: 'node-2', target: 'node-4' },
            { id: 'c4', source: 'node-3', target: 'node-4' },
            { id: 'c5', source: 'node-4', target: 'node-5' },
            { id: 'c6', source: 'node-5', target: 'node-6', sourcePort: 0 }, // Critical -> Restart
            { id: 'c7', source: 'node-6', target: 'node-7' }, // Restart -> Notify
            { id: 'c8', source: 'node-5', target: 'node-8', sourcePort: 1 }, // Healthy -> Log
        ],
    },
];

