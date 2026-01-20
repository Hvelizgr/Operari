
import { NextResponse } from 'next/server';

// Templates using real n8n node types for direct execution without intervention
const TEMPLATES = [
    {
        id: 'hello-world',
        category: 'data',
        name: {
            en: 'Hello World',
            es: 'Hola Mundo'
        },
        description: {
            en: 'Simple workflow that generates a greeting message. Perfect for testing!',
            es: 'Flujo simple que genera un mensaje de saludo. ¡Perfecto para probar!'
        },
        nodes: [
            {
                id: 'node-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'node-2',
                type: 'n8n-nodes-base.code',
                position: { x: 350, y: 200 },
                title: 'Generate Message',
                config: { jsCode: 'return { message: "Hello World!", timestamp: new Date().toISOString() };' }
            }
        ],
        connections: [
            { id: 'c1', source: 'node-1', target: 'node-2' }
        ]
    },
    {
        id: 'random-user-api',
        category: 'data',
        name: {
            en: 'Random User Fetcher',
            es: 'Obtener Usuario Aleatorio'
        },
        description: {
            en: 'Fetches random user data from an API and formats the result.',
            es: 'Obtiene datos de usuario aleatorio de una API y formatea el resultado.'
        },
        nodes: [
            {
                id: 'node-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'node-2',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 200 },
                title: 'Fetch User',
                config: { url: 'https://randomuser.me/api/', method: 'GET' }
            },
            {
                id: 'node-3',
                type: 'n8n-nodes-base.code',
                position: { x: 600, y: 200 },
                title: 'Format Result',
                config: { jsCode: 'const user = input.data?.results?.[0] || {};\nreturn { name: user.name?.first + " " + user.name?.last, email: user.email, country: user.location?.country };' }
            }
        ],
        connections: [
            { id: 'c1', source: 'node-1', target: 'node-2' },
            { id: 'c2', source: 'node-2', target: 'node-3' }
        ]
    },
    {
        id: 'number-processor',
        category: 'automation',
        name: {
            en: 'Number Processor',
            es: 'Procesador de Números'
        },
        description: {
            en: 'Generates random numbers, categorizes them, and produces statistics.',
            es: 'Genera números aleatorios, los categoriza y produce estadísticas.'
        },
        nodes: [
            {
                id: 'node-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'node-2',
                type: 'n8n-nodes-base.code',
                position: { x: 350, y: 200 },
                title: 'Generate Numbers',
                config: { jsCode: 'return Array.from({length: 5}, (_, i) => ({ id: i+1, value: Math.floor(Math.random() * 100) }));' }
            },
            {
                id: 'node-3',
                type: 'n8n-nodes-base.code',
                position: { x: 600, y: 200 },
                title: 'Categorize',
                config: { jsCode: 'const nums = Array.isArray(input) ? input : [];\nreturn nums.map(n => ({ ...n, category: n.value > 75 ? "HIGH" : n.value > 25 ? "MEDIUM" : "LOW" }));' }
            },
            {
                id: 'node-4',
                type: 'n8n-nodes-base.code',
                position: { x: 850, y: 200 },
                title: 'Statistics',
                config: { jsCode: 'const nums = Array.isArray(input) ? input : [];\nconst high = nums.filter(n => n.category === "HIGH").length;\nconst med = nums.filter(n => n.category === "MEDIUM").length;\nconst low = nums.filter(n => n.category === "LOW").length;\nreturn { high, medium: med, low, total: nums.length, timestamp: new Date().toISOString() };' }
            }
        ],
        connections: [
            { id: 'c1', source: 'node-1', target: 'node-2' },
            { id: 'c2', source: 'node-2', target: 'node-3' },
            { id: 'c3', source: 'node-3', target: 'node-4' }
        ]
    },
    {
        id: 'conditional-flow',
        category: 'automation',
        name: {
            en: 'Conditional Branching',
            es: 'Flujo Condicional'
        },
        description: {
            en: 'Demonstrates IF/ELSE branching based on random score values.',
            es: 'Demuestra bifurcación SI/SINO basada en valores de puntaje aleatorios.'
        },
        nodes: [
            {
                id: 'node-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'node-2',
                type: 'n8n-nodes-base.code',
                position: { x: 350, y: 200 },
                title: 'Generate Score',
                config: { jsCode: 'return { score: Math.floor(Math.random() * 100), threshold: 50 };' }
            },
            {
                id: 'node-3',
                type: 'n8n-nodes-base.if',
                position: { x: 600, y: 200 },
                title: 'Check Score',
                config: { conditions: { number: [{ value1: '={{$json.score}}', operation: 'larger', value2: 50 }] } }
            },
            {
                id: 'node-4',
                type: 'n8n-nodes-base.code',
                position: { x: 900, y: 100 },
                title: 'High Score',
                config: { jsCode: 'return { result: "HIGH", message: "Score above threshold!", score: input.score };' }
            },
            {
                id: 'node-5',
                type: 'n8n-nodes-base.code',
                position: { x: 900, y: 300 },
                title: 'Low Score',
                config: { jsCode: 'return { result: "LOW", message: "Score below threshold", score: input.score };' }
            }
        ],
        connections: [
            { id: 'c1', source: 'node-1', target: 'node-2' },
            { id: 'c2', source: 'node-2', target: 'node-3' },
            { id: 'c3', source: 'node-3', target: 'node-4', sourcePort: 0, condition: 'success' },
            { id: 'c4', source: 'node-3', target: 'node-5', sourcePort: 1, condition: 'warning' }
        ]
    },
    {
        id: 'json-api-test',
        category: 'webhooks',
        name: {
            en: 'JSONPlaceholder Test',
            es: 'Prueba JSONPlaceholder'
        },
        description: {
            en: 'Fetches posts from JSONPlaceholder API and analyzes them.',
            es: 'Obtiene posts de la API JSONPlaceholder y los analiza.'
        },
        nodes: [
            {
                id: 'node-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'node-2',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 200 },
                title: 'Fetch Posts',
                config: { url: 'https://jsonplaceholder.typicode.com/posts?_limit=5', method: 'GET' }
            },
            {
                id: 'node-3',
                type: 'n8n-nodes-base.code',
                position: { x: 600, y: 200 },
                title: 'Extract Data',
                config: { jsCode: 'return Array.isArray(input.data) ? input.data : [];' }
            },
            {
                id: 'node-4',
                type: 'n8n-nodes-base.code',
                position: { x: 850, y: 200 },
                title: 'Analyze',
                config: { jsCode: 'const posts = Array.isArray(input) ? input : [];\nreturn { count: posts.length, titles: posts.map(p => p.title?.substring(0, 30)), timestamp: new Date().toISOString() };' }
            }
        ],
        connections: [
            { id: 'c1', source: 'node-1', target: 'node-2' },
            { id: 'c2', source: 'node-2', target: 'node-3' },
            { id: 'c3', source: 'node-3', target: 'node-4' }
        ]
    },
    {
        id: 'weather-check',
        category: 'data',
        name: {
            en: 'Weather Report',
            es: 'Reporte del Clima'
        },
        description: {
            en: 'Fetches current weather data and generates a formatted report.',
            es: 'Obtiene datos del clima actual y genera un reporte formateado.'
        },
        nodes: [
            {
                id: 'node-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'node-2',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 200 },
                title: 'Get Weather',
                config: { url: 'https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current_weather=true', method: 'GET' }
            },
            {
                id: 'node-3',
                type: 'n8n-nodes-base.code',
                position: { x: 600, y: 200 },
                title: 'Format Report',
                config: { jsCode: 'const w = input.data?.current_weather || {};\nreturn { location: "New York", temperature: w.temperature + "°C", windspeed: w.windspeed + " km/h", time: w.time || new Date().toISOString() };' }
            }
        ],
        connections: [
            { id: 'c1', source: 'node-1', target: 'node-2' },
            { id: 'c2', source: 'node-2', target: 'node-3' }
        ]
    }
];

export async function GET() {
    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 500));
    return NextResponse.json(TEMPLATES);
}
