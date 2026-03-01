export const WORKFLOW_TEMPLATES = [
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
                id: 'http-hot',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 900, y: 100 },
                title: 'Notify HOT Lead',
                config: { url: 'https://httpbin.org/post', method: 'POST', body: '={{JSON.stringify({ tier: "HOT", lead: $json })}}' }
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
            { id: 'c3', source: 'switch-1', target: 'http-hot', sourcePort: 0 },
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
            en: 'Extract data from multiple APIs, transform and clean it, then process. Includes error handling and validation.',
            es: 'Extrae datos de múltiples APIs, los transforma y limpia, luego los procesa. Incluye manejo de errores y validación.'
        },
        nodes: [
            {
                id: 'trigger-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'http-1',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 100 },
                title: 'Fetch Users',
                config: { url: 'https://jsonplaceholder.typicode.com/users', method: 'GET' }
            },
            {
                id: 'http-2',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 300 },
                title: 'Fetch Posts',
                config: { url: 'https://jsonplaceholder.typicode.com/posts?_limit=10', method: 'GET' }
            },
            {
                id: 'merge-1',
                type: 'n8n-nodes-base.merge',
                position: { x: 600, y: 200 },
                title: 'Merge Data',
                config: { mode: 'combine' }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 850, y: 200 },
                title: 'Transform & Enrich',
                config: { jsCode: `const items = $input.all();
const users = items[0]?.json || [];
const posts = items[1]?.json || [];
return posts.map(post => {
  const user = users.find(u => u.id === post.userId) || {};
  return {
    post_id: post.id,
    title: post.title.substring(0, 50),
    author: user.name || 'Unknown',
    email: user.email?.toLowerCase(),
    company: user.company?.name,
    processed_at: new Date().toISOString()
  };
});` }
            },
            {
                id: 'if-1',
                type: 'n8n-nodes-base.if',
                position: { x: 1100, y: 200 },
                title: 'Has Records?',
                config: { conditions: { number: [{ value1: '={{$json.length}}', operation: 'larger', value2: 0 }] } }
            },
            {
                id: 'http-save',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 1350, y: 100 },
                title: 'Save Results',
                config: { url: 'https://httpbin.org/post', method: 'POST', body: '={{JSON.stringify($json)}}' }
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
            { id: 'c7', source: 'if-1', target: 'http-save', sourcePort: 0 },
            { id: 'c8', source: 'if-1', target: 'code-2', sourcePort: 1 }
        ]
    },
    {
        id: 'crypto-price-tracker',
        category: 'data',
        name: {
            en: 'Crypto Price Tracker',
            es: 'Rastreador de Precios Crypto'
        },
        description: {
            en: 'Fetch cryptocurrency prices from CoinGecko API, analyze trends, and generate alerts for significant changes.',
            es: 'Obtiene precios de criptomonedas de CoinGecko API, analiza tendencias y genera alertas para cambios significativos.'
        },
        nodes: [
            {
                id: 'trigger-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'http-1',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 200 },
                title: 'Fetch Crypto Prices',
                config: { 
                    url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true', 
                    method: 'GET' 
                }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 600, y: 200 },
                title: 'Process Prices',
                config: { jsCode: `const data = $input.first().json;
const coins = ['bitcoin', 'ethereum', 'solana'];
return coins.map(coin => ({
  coin: coin.charAt(0).toUpperCase() + coin.slice(1),
  price_usd: data[coin]?.usd || 0,
  change_24h: (data[coin]?.usd_24h_change || 0).toFixed(2),
  trend: (data[coin]?.usd_24h_change || 0) > 0 ? 'UP' : 'DOWN',
  alert: Math.abs(data[coin]?.usd_24h_change || 0) > 5 ? 'SIGNIFICANT' : 'NORMAL',
  timestamp: new Date().toISOString()
}));` }
            },
            {
                id: 'switch-1',
                type: 'n8n-nodes-base.switch',
                position: { x: 850, y: 200 },
                title: 'Check Alert',
                config: { rules: { rules: [{ value1: '={{$json.alert}}', operation: 'equal', value2: 'SIGNIFICANT' }] } }
            },
            {
                id: 'http-alert',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 1100, y: 100 },
                title: 'Send Alert',
                config: { url: 'https://httpbin.org/post', method: 'POST', body: '={{JSON.stringify({ alert: "Price Alert!", data: $json })}}' }
            },
            {
                id: 'code-2',
                type: 'n8n-nodes-base.code',
                position: { x: 1100, y: 300 },
                title: 'Log Normal',
                config: { jsCode: `return { status: 'normal', message: 'No significant price changes', data: $input.first().json };` }
            }
        ],
        connections: [
            { id: 'c1', source: 'trigger-1', target: 'http-1' },
            { id: 'c2', source: 'http-1', target: 'code-1' },
            { id: 'c3', source: 'code-1', target: 'switch-1' },
            { id: 'c4', source: 'switch-1', target: 'http-alert', sourcePort: 0 },
            { id: 'c5', source: 'switch-1', target: 'code-2', sourcePort: 1 }
        ]
    },
    {
        id: 'weather-alert-system',
        category: 'automation',
        name: {
            en: 'Weather Alert System',
            es: 'Sistema de Alertas de Clima'
        },
        description: {
            en: 'Fetch weather data from Open-Meteo API and send alerts for extreme conditions.',
            es: 'Obtiene datos del clima de Open-Meteo API y envía alertas para condiciones extremas.'
        },
        nodes: [
            {
                id: 'trigger-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'http-1',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 200 },
                title: 'Fetch Weather',
                config: { 
                    url: 'https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,wind_speed_10m,relative_humidity_2m&timezone=America/New_York', 
                    method: 'GET' 
                }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 600, y: 200 },
                title: 'Analyze Weather',
                config: { jsCode: `const data = $input.first().json;
const current = data.current || {};
const temp = current.temperature_2m || 0;
const wind = current.wind_speed_10m || 0;
const humidity = current.relative_humidity_2m || 0;

let alerts = [];
if (temp > 35) alerts.push('EXTREME_HEAT');
if (temp < 0) alerts.push('FREEZING');
if (wind > 50) alerts.push('HIGH_WIND');
if (humidity > 90) alerts.push('HIGH_HUMIDITY');

return {
  location: 'New York, NY',
  temperature_c: temp,
  temperature_f: (temp * 9/5 + 32).toFixed(1),
  wind_speed_kmh: wind,
  humidity_percent: humidity,
  alerts: alerts,
  has_alerts: alerts.length > 0,
  timestamp: new Date().toISOString()
};` }
            },
            {
                id: 'if-1',
                type: 'n8n-nodes-base.if',
                position: { x: 850, y: 200 },
                title: 'Has Alerts?',
                config: { conditions: { boolean: [{ value1: '={{$json.has_alerts}}', value2: true }] } }
            },
            {
                id: 'http-notify',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 1100, y: 100 },
                title: 'Send Alert',
                config: { url: 'https://httpbin.org/post', method: 'POST', body: '={{JSON.stringify({ type: "weather_alert", data: $json })}}' }
            },
            {
                id: 'code-2',
                type: 'n8n-nodes-base.code',
                position: { x: 1100, y: 300 },
                title: 'Normal Weather',
                config: { jsCode: `return { status: 'normal', message: 'Weather conditions are normal', data: $input.first().json };` }
            }
        ],
        connections: [
            { id: 'c1', source: 'trigger-1', target: 'http-1' },
            { id: 'c2', source: 'http-1', target: 'code-1' },
            { id: 'c3', source: 'code-1', target: 'if-1' },
            { id: 'c4', source: 'if-1', target: 'http-notify', sourcePort: 0 },
            { id: 'c5', source: 'if-1', target: 'code-2', sourcePort: 1 }
        ]
    },
    {
        id: 'github-repo-analyzer',
        category: 'data',
        name: {
            en: 'GitHub Repo Analyzer',
            es: 'Analizador de Repos GitHub'
        },
        description: {
            en: 'Fetch public GitHub repository information, analyze stats, and generate reports.',
            es: 'Obtiene información de repositorios públicos de GitHub, analiza estadísticas y genera reportes.'
        },
        nodes: [
            {
                id: 'trigger-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'http-1',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 200 },
                title: 'Fetch Repo Info',
                config: { 
                    url: 'https://api.github.com/repos/facebook/react', 
                    method: 'GET',
                    headers: { 'Accept': 'application/vnd.github.v3+json' }
                }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 600, y: 200 },
                title: 'Analyze Repo',
                config: { jsCode: `const repo = $input.first().json;
return {
  name: repo.full_name,
  description: repo.description?.substring(0, 100),
  stars: repo.stargazers_count,
  forks: repo.forks_count,
  watchers: repo.watchers_count,
  open_issues: repo.open_issues_count,
  language: repo.language,
  popularity_score: Math.round((repo.stargazers_count / 1000) + (repo.forks_count / 500)),
  popularity_tier: repo.stargazers_count > 100000 ? 'LEGENDARY' : repo.stargazers_count > 50000 ? 'VERY_POPULAR' : 'POPULAR',
  last_updated: repo.updated_at,
  created_at: repo.created_at,
  analyzed_at: new Date().toISOString()
};` }
            },
            {
                id: 'http-2',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 850, y: 200 },
                title: 'Fetch Contributors',
                config: { 
                    url: 'https://api.github.com/repos/facebook/react/contributors?per_page=5', 
                    method: 'GET',
                    headers: { 'Accept': 'application/vnd.github.v3+json' }
                }
            },
            {
                id: 'code-2',
                type: 'n8n-nodes-base.code',
                position: { x: 1100, y: 200 },
                title: 'Generate Report',
                config: { jsCode: `const items = $input.all();
const repoInfo = items[0]?.json || {};
const contributors = items[1]?.json || [];

const topContributors = (Array.isArray(contributors) ? contributors : []).slice(0, 5).map(c => ({
  username: c.login,
  contributions: c.contributions
}));

return {
  report_type: 'GitHub Repository Analysis',
  repo: repoInfo,
  top_contributors: topContributors,
  summary: \`\${repoInfo.name} is a \${repoInfo.popularity_tier} repository with \${repoInfo.stars?.toLocaleString()} stars\`,
  generated_at: new Date().toISOString()
};` }
            }
        ],
        connections: [
            { id: 'c1', source: 'trigger-1', target: 'http-1' },
            { id: 'c2', source: 'http-1', target: 'code-1' },
            { id: 'c3', source: 'code-1', target: 'http-2' },
            { id: 'c4', source: 'http-2', target: 'code-2' }
        ]
    },
    {
        id: 'random-user-generator',
        category: 'data',
        name: {
            en: 'Random User Data Generator',
            es: 'Generador de Datos de Usuario'
        },
        description: {
            en: 'Generate random user data using RandomUser.me API, transform and validate it.',
            es: 'Genera datos de usuario aleatorios usando RandomUser.me API, los transforma y valida.'
        },
        nodes: [
            {
                id: 'trigger-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'http-1',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 200 },
                title: 'Get Random Users',
                config: { 
                    url: 'https://randomuser.me/api/?results=5&nat=us,gb,fr', 
                    method: 'GET' 
                }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 600, y: 200 },
                title: 'Transform Users',
                config: { jsCode: `const data = $input.first().json;
const users = data.results || [];
return users.map((user, index) => ({
  id: index + 1,
  full_name: \`\${user.name.first} \${user.name.last}\`,
  email: user.email,
  username: user.login.username,
  country: user.location.country,
  city: user.location.city,
  age: user.dob.age,
  phone: user.phone,
  avatar: user.picture.thumbnail,
  registered_date: user.registered.date,
  is_adult: user.dob.age >= 18
}));` }
            },
            {
                id: 'if-1',
                type: 'n8n-nodes-base.if',
                position: { x: 850, y: 200 },
                title: 'Is Adult?',
                config: { conditions: { boolean: [{ value1: '={{$json.is_adult}}', value2: true }] } }
            },
            {
                id: 'code-adults',
                type: 'n8n-nodes-base.code',
                position: { x: 1100, y: 100 },
                title: 'Process Adults',
                config: { jsCode: `return { category: 'adult_user', user: $input.first().json };` }
            },
            {
                id: 'code-minors',
                type: 'n8n-nodes-base.code',
                position: { x: 1100, y: 300 },
                title: 'Process Minors',
                config: { jsCode: `return { category: 'minor_user', user: $input.first().json, requires_parental_consent: true };` }
            }
        ],
        connections: [
            { id: 'c1', source: 'trigger-1', target: 'http-1' },
            { id: 'c2', source: 'http-1', target: 'code-1' },
            { id: 'c3', source: 'code-1', target: 'if-1' },
            { id: 'c4', source: 'if-1', target: 'code-adults', sourcePort: 0 },
            { id: 'c5', source: 'if-1', target: 'code-minors', sourcePort: 1 }
        ]
    },
    {
        id: 'ip-geolocation',
        category: 'webhooks',
        name: {
            en: 'IP Geolocation Service',
            es: 'Servicio de Geolocalización IP'
        },
        description: {
            en: 'Receive IP addresses via webhook and return geolocation data.',
            es: 'Recibe direcciones IP via webhook y devuelve datos de geolocalización.'
        },
        nodes: [
            {
                id: 'webhook-1',
                type: 'n8n-nodes-base.webhook',
                position: { x: 100, y: 200 },
                title: 'IP Webhook',
                config: { path: 'geolocate', httpMethod: 'POST' }
            },
            {
                id: 'http-1',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 200 },
                title: 'Get Location',
                config: { 
                    url: 'http://ip-api.com/json/{{$json.ip || "8.8.8.8"}}', 
                    method: 'GET' 
                }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 600, y: 200 },
                title: 'Format Response',
                config: { jsCode: `const data = $input.first().json;
return {
  ip: data.query,
  country: data.country,
  country_code: data.countryCode,
  region: data.regionName,
  city: data.city,
  zip: data.zip,
  latitude: data.lat,
  longitude: data.lon,
  timezone: data.timezone,
  isp: data.isp,
  organization: data.org,
  is_success: data.status === 'success',
  processed_at: new Date().toISOString()
};` }
            }
        ],
        connections: [
            { id: 'c1', source: 'webhook-1', target: 'http-1' },
            { id: 'c2', source: 'http-1', target: 'code-1' }
        ]
    },
    {
        id: 'quote-of-the-day',
        category: 'automation',
        name: {
            en: 'Quote of the Day',
            es: 'Frase del Día'
        },
        description: {
            en: 'Fetch inspirational quotes and format them for sharing.',
            es: 'Obtiene frases inspiracionales y las formatea para compartir.'
        },
        nodes: [
            {
                id: 'trigger-1',
                type: 'n8n-nodes-base.manualTrigger',
                position: { x: 100, y: 200 },
                title: 'Start',
                config: {}
            },
            {
                id: 'http-1',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 350, y: 200 },
                title: 'Get Quote',
                config: { 
                    url: 'https://api.quotable.io/random', 
                    method: 'GET' 
                }
            },
            {
                id: 'code-1',
                type: 'n8n-nodes-base.code',
                position: { x: 600, y: 200 },
                title: 'Format Quote',
                config: { jsCode: `const quote = $input.first().json;
return {
  quote_id: quote._id,
  content: quote.content,
  author: quote.author,
  tags: quote.tags || [],
  length: quote.length,
  formatted: \`"\${quote.content}" - \${quote.author}\`,
  twitter_format: \`"\${quote.content.substring(0, 200)}\${quote.content.length > 200 ? '...' : ''}" - \${quote.author} #quote #inspiration\`,
  fetched_at: new Date().toISOString()
};` }
            },
            {
                id: 'http-2',
                type: 'n8n-nodes-base.httpRequest',
                position: { x: 850, y: 200 },
                title: 'Post to Service',
                config: { url: 'https://httpbin.org/post', method: 'POST', body: '={{JSON.stringify($json)}}' }
            }
        ],
        connections: [
            { id: 'c1', source: 'trigger-1', target: 'http-1' },
            { id: 'c2', source: 'http-1', target: 'code-1' },
            { id: 'c3', source: 'code-1', target: 'http-2' }
        ]
    },
    {
        id: 'api-data-fetcher',
        name: { en: 'API Data Fetcher', es: 'Obtener Datos de API' },
        description: {
            en: 'Fetch data from JSONPlaceholder API and process the response',
            es: 'Obtiene datos de JSONPlaceholder API y procesa la respuesta'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { id: 'node-2', position: { x: 350, y: 200 }, title: 'Fetch Post', type: 'n8n-nodes-base.httpRequest', config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts/1' } },
            { 
                id: 'node-3', 
                position: { x: 600, y: 200 }, 
                title: 'Transform Data', 
                type: 'n8n-nodes-base.code', 
                config: { jsCode: `const post = $input.first().json;
return {
  id: post.id,
  title: post.title.toUpperCase(),
  preview: post.body.substring(0, 100) + '...',
  word_count: post.body.split(' ').length,
  fetched_at: new Date().toISOString()
};` } 
            },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
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
            { 
                id: 'node-2', 
                position: { x: 350, y: 200 }, 
                title: 'Generate Number', 
                type: 'n8n-nodes-base.code', 
                config: { jsCode: `return { value: Math.floor(Math.random() * 100), timestamp: new Date().toISOString() };` } 
            },
            { id: 'node-3', position: { x: 600, y: 200 }, title: 'Is > 50?', type: 'n8n-nodes-base.if', config: { conditions: { number: [{ value1: '={{$json.value}}', operation: 'larger', value2: 50 }] } } },
            { 
                id: 'node-4', 
                position: { x: 900, y: 100 }, 
                title: 'High Value', 
                type: 'n8n-nodes-base.code', 
                config: { jsCode: `return { ...($input.first().json), category: 'HIGH', message: 'Value is above 50' };` } 
            },
            { 
                id: 'node-5', 
                position: { x: 900, y: 300 }, 
                title: 'Low Value', 
                type: 'n8n-nodes-base.code', 
                config: { jsCode: `return { ...($input.first().json), category: 'LOW', message: 'Value is 50 or below' };` } 
            },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4', sourcePort: 0 },
            { id: 'conn-4', source: 'node-3', target: 'node-5', sourcePort: 1 },
        ],
    },
    {
        id: 'webhook-handler',
        name: { en: 'Webhook Handler', es: 'Manejador de Webhooks' },
        description: {
            en: 'Receive and process incoming webhooks with validation',
            es: 'Recibe y procesa webhooks entrantes con validación'
        },
        category: 'webhooks',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Webhook', type: 'n8n-nodes-base.webhook', config: { httpMethod: 'POST', path: 'incoming-data' } },
            { 
                id: 'node-2', 
                position: { x: 350, y: 200 }, 
                title: 'Validate & Process', 
                type: 'n8n-nodes-base.code', 
                config: { jsCode: `const data = $input.first().json;
return {
  received: true,
  payload: data,
  fields_count: Object.keys(data).length,
  has_required: !!(data.id || data.name || data.email),
  processed_at: new Date().toISOString()
};` } 
            },
            { 
                id: 'node-3', 
                position: { x: 600, y: 200 }, 
                title: 'Log Result', 
                type: 'n8n-nodes-base.httpRequest', 
                config: { url: 'https://httpbin.org/post', method: 'POST', body: '={{JSON.stringify($json)}}' } 
            },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
    {
        id: 'scheduled-task',
        name: { en: 'Scheduled Data Collector', es: 'Recolector de Datos Programado' },
        description: {
            en: 'Periodically fetch data from public APIs',
            es: 'Obtiene datos periódicamente de APIs públicas'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 200 }, title: 'Manual Start', type: 'n8n-nodes-base.manualTrigger', config: {} },
            { 
                id: 'node-2', 
                position: { x: 350, y: 200 }, 
                title: 'Fetch Activity', 
                type: 'n8n-nodes-base.httpRequest', 
                config: { method: 'GET', url: 'https://www.boredapi.com/api/activity' } 
            },
            { 
                id: 'node-3', 
                position: { x: 600, y: 200 }, 
                title: 'Process Activity', 
                type: 'n8n-nodes-base.code', 
                config: { jsCode: `const activity = $input.first().json;
return {
  suggestion: activity.activity,
  type: activity.type,
  participants: activity.participants,
  difficulty: activity.accessibility < 0.3 ? 'Easy' : activity.accessibility < 0.7 ? 'Medium' : 'Hard',
  price_category: activity.price === 0 ? 'Free' : activity.price < 0.5 ? 'Cheap' : 'Expensive',
  collected_at: new Date().toISOString()
};` } 
            },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
];
