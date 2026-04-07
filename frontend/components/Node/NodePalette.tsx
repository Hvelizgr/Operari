'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ChevronRight, Search, X,
    Globe, Mail, Database, Clock, GitBranch, Code, MessageSquare,
    FileText, Calendar, Webhook, Folder, Send, Key, Zap, Settings,
    Cloud, Server, Hash, Link, Play, Pause, RefreshCw, Filter,
    AlertCircle, CheckCircle, XCircle, List, Grid, Shuffle,
    Users, DollarSign, ShoppingBag, HardDrive, Smartphone, Radio,
    Twitter, Facebook, Instagram, Linkedin, CreditCard, Box,
    Megaphone, Bell, Shield, Lock, Briefcase, Square, StickyNote,
    Terminal, UserCheck, Wrench
} from 'lucide-react';
import { useState, useMemo } from 'react';

export interface NodeType {
    type: string;
    icon: React.ReactNode;
    label: { en: string; es: string };
    color: string;
    category: string;
    description?: { en: string; es: string };
    inputs?: string[];  // e.g. ['main', 'ai_tool', 'ai_memory']
    outputs?: string[]; // e.g. ['main', 'main']
    properties?: any[]; // Dynamic form schema
}

// NanoRun + n8n-style categories
const CATEGORIES = [
    { id: 'devops', label: { en: 'DevOps', es: 'DevOps' }, icon: Terminal, color: 'text-emerald-400' },
    { id: 'triggers', label: { en: 'Triggers', es: 'Disparadores' }, icon: Play, color: 'text-green-400' },
    { id: 'core', label: { en: 'Core', es: 'Core' }, icon: Zap, color: 'text-blue-400' },
    { id: 'organization', label: { en: 'Organization', es: 'Organización' }, icon: Folder, color: 'text-slate-400' },
    { id: 'ai', label: { en: 'AI & LLM', es: 'IA y LLM' }, icon: MessageSquare, color: 'text-rose-400' },
    { id: 'flow', label: { en: 'Flow', es: 'Flujo' }, icon: GitBranch, color: 'text-yellow-400' },
    { id: 'data', label: { en: 'Data', es: 'Datos' }, icon: Shuffle, color: 'text-purple-400' },
    { id: 'social', label: { en: 'Social Media', es: 'Redes Sociales' }, icon: Users, color: 'text-sky-400' },
    { id: 'communication', label: { en: 'Communication', es: 'Comunicación' }, icon: Send, color: 'text-orange-400' },
    { id: 'marketing', label: { en: 'Marketing & CRM', es: 'Marketing y CRM' }, icon: Megaphone, color: 'text-pink-400' },
    { id: 'productivity', label: { en: 'Productivity', es: 'Productividad' }, icon: Calendar, color: 'text-cyan-400' },
    { id: 'storage', label: { en: 'Storage & Files', es: 'Archivos' }, icon: HardDrive, color: 'text-teal-400' },
    { id: 'payment', label: { en: 'Finance & Payment', es: 'Pagos' }, icon: DollarSign, color: 'text-emerald-400' },
    { id: 'developer', label: { en: 'Developer Tools', es: 'Desarrollo' }, icon: Code, color: 'text-slate-400' },
];

// NanoRun nodes + legacy nodes
const NODE_TYPES: NodeType[] = [
    // === DEVOPS (NanoRun) ===
    {
        type: 'shell',
        icon: <Terminal size={18} />,
        label: { en: 'Shell Command', es: 'Comando Shell' },
        color: 'bg-emerald-600',
        category: 'devops',
        description: { en: 'Run a shell command (bash/sh)', es: 'Ejecutar un comando shell' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            { name: 'command', displayName: 'Command', type: 'string', default: 'echo "Hello from NanoRun"' },
            { name: 'cwd', displayName: 'Working Directory', type: 'string', default: '' },
            { name: 'timeout', displayName: 'Timeout (ms)', type: 'number', default: 60000 },
        ]
    },
    {
        type: 'approval',
        icon: <UserCheck size={18} />,
        label: { en: 'Approval Gate', es: 'Aprobación Manual' },
        color: 'bg-amber-600',
        category: 'devops',
        description: { en: 'Pause until a human approves', es: 'Pausar hasta que un humano apruebe' },
        inputs: ['main'],
        outputs: ['approved', 'rejected'],
        properties: [
            { name: 'message', displayName: 'Message to approvers', type: 'string', default: 'Approve to continue' },
            { name: 'approvers', displayName: 'Approver emails (comma-separated)', type: 'string', default: '' },
        ]
    },
    {
        type: 'notify',
        icon: <Bell size={18} />,
        label: { en: 'Notify', es: 'Notificar' },
        color: 'bg-pink-600',
        category: 'devops',
        description: { en: 'Send to Slack, Discord, or webhook', es: 'Enviar a Slack, Discord o webhook' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            { name: 'channel', displayName: 'Channel', type: 'options', options: [
                { name: 'Slack', value: 'slack' },
                { name: 'Discord', value: 'discord' },
                { name: 'Generic Webhook', value: 'webhook' },
            ], default: 'slack' },
            { name: 'webhookUrl', displayName: 'Webhook URL', type: 'string', default: '' },
            { name: 'message', displayName: 'Message', type: 'string', default: 'Runbook step completed' },
            { name: 'title', displayName: 'Title (optional)', type: 'string', default: '' },
        ]
    },
    {
        type: 'wait',
        icon: <Clock size={18} />,
        label: { en: 'Wait', es: 'Esperar' },
        color: 'bg-gray-600',
        category: 'devops',
        description: { en: 'Pause for a fixed duration', es: 'Pausar una duración fija' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            { name: 'durationMs', displayName: 'Duration (ms)', type: 'number', default: 5000 },
        ]
    },
    // === ORGANIZATION ===
    {
        type: 'custom.frame',
        icon: <Square size={18} />,
        label: { en: 'Frame', es: 'Marco' },
        color: 'bg-slate-600',
        category: 'organization',
        description: { en: 'Group nodes together', es: 'Agrupar nodos' },
        properties: [
            { name: 'title', displayName: 'Title', type: 'string', default: 'Frame' },
            { name: 'color', displayName: 'Color', type: 'color', default: '#3791f5' },
        ]
    },
    {
        type: 'custom.note',
        icon: <StickyNote size={18} />,
        label: { en: 'Note', es: 'Nota' },
        color: 'bg-slate-600',
        category: 'organization',
        description: { en: 'Add a text note', es: 'Agregar nota de texto' },
        properties: [
            { name: 'text', displayName: 'Text', type: 'string', typeOptions: { rows: 5 }, default: '' },
        ]
    },

    // === AI & LLM ===
    {
        type: 'n8n-nodes-base.openAi',
        icon: <MessageSquare size={18} />,
        label: { en: 'OpenAI', es: 'OpenAI' },
        color: 'bg-rose-500',
        category: 'ai',
        description: { en: 'Interact with OpenAI models', es: 'Modelos OpenAI' },
        properties: [
            { name: 'resource', displayName: 'Resource', type: 'options', options: [{ name: 'Chat', value: 'chat' }, { name: 'Image', value: 'image' }, { name: 'Audio', value: 'audio' }], default: 'chat' },
            { name: 'model', displayName: 'Model', type: 'options', options: [{ name: 'GPT-4', value: 'gpt-4' }, { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }], default: 'gpt-3.5-turbo' },
            { name: 'prompt', displayName: 'Prompt', type: 'string', typeOptions: { rows: 5, expression: true } },
            { name: 'systemMessage', displayName: 'System Message', type: 'string', typeOptions: { rows: 3, expression: true } }
        ]
    },
    { type: 'n8n-nodes-base.langChain', icon: <GitBranch size={18} />, label: { en: 'LangChain Agent', es: 'Agente LangChain' }, color: 'bg-rose-500', category: 'ai', description: { en: 'Build LLM chains', es: 'Cadenas LLM' }, inputs: ['main', 'ai_tool', 'ai_memory'] },
    { type: 'n8n-nodes-base.huggingFace', icon: <MessageSquare size={18} />, label: { en: 'HuggingFace', es: 'HuggingFace' }, color: 'bg-rose-500', category: 'ai', description: { en: 'HuggingFace models', es: 'Modelos HuggingFace' } },
    { type: 'n8n-nodes-base.anthropic', icon: <MessageSquare size={18} />, label: { en: 'Anthropic', es: 'Anthropic' }, color: 'bg-rose-500', category: 'ai', description: { en: 'Claude models', es: 'Modelos Claude' } },
    { type: 'n8n-nodes-base.stabilityAi', icon: <Box size={18} />, label: { en: 'Stability AI', es: 'Stability AI' }, color: 'bg-rose-500', category: 'ai', description: { en: 'Image generation', es: 'Generación imagenes' } },

    // === TRIGGERS ===
    {
        type: 'n8n-nodes-base.webhook',
        icon: <Webhook size={18} />,
        label: { en: 'Webhook', es: 'Webhook' },
        color: 'bg-green-500',
        category: 'triggers',
        description: { en: 'Starts on HTTP request', es: 'Inicia con HTTP request' },
        properties: [
            { name: 'httpMethod', displayName: 'HTTP Method', type: 'options', options: [{ name: 'GET', value: 'GET' }, { name: 'POST', value: 'POST' }], default: 'GET' },
            { name: 'path', displayName: 'Path', type: 'string', default: 'webhook-demo' },
            { name: 'responseMode', displayName: 'Response Mode', type: 'options', options: [{ name: 'On Received', value: 'onReceived' }, { name: 'Last Node', value: 'lastNode' }], default: 'onReceived' }
        ]
    },
    {
        type: 'n8n-nodes-base.scheduleTrigger',
        icon: <Clock size={18} />,
        label: { en: 'Schedule', es: 'Cronograma' },
        color: 'bg-green-500',
        category: 'triggers',
        description: { en: 'Run on schedule', es: 'Ejecutar programado' },
        properties: [
            { name: 'rule', displayName: 'Trigger Interval', type: 'options', options: [{ name: 'Seconds', value: 'seconds' }, { name: 'Minutes', value: 'minutes' }, { name: 'Hours', value: 'hours' }, { name: 'Days', value: 'days' }], default: 'minutes' },
            { name: 'value', displayName: 'Value', type: 'number', default: 1 }
        ]
    },
    { type: 'n8n-nodes-base.manualTrigger', icon: <Play size={18} />, label: { en: 'Manual', es: 'Manual' }, color: 'bg-green-500', category: 'triggers', description: { en: 'Start manually', es: 'Iniciar manualmente' } },
    { type: 'n8n-nodes-base.cron', icon: <Clock size={18} />, label: { en: 'Cron', es: 'Cron' }, color: 'bg-green-500', category: 'triggers', description: { en: 'Unix cron schedule', es: 'Cronograma Unix' } },

    // === CORE ===
    {
        type: 'n8n-nodes-base.httpRequest',
        icon: <Globe size={18} />,
        label: { en: 'HTTP Request', es: 'Petición HTTP' },
        color: 'bg-blue-500',
        category: 'core',
        description: { en: 'Make HTTP requests', es: 'Hacer petición HTTP' },
        properties: [
            { name: 'method', displayName: 'Method', type: 'options', options: [{ name: 'GET', value: 'GET' }, { name: 'POST', value: 'POST' }, { name: 'PUT', value: 'PUT' }, { name: 'DELETE', value: 'DELETE' }], default: 'GET' },
            { name: 'url', displayName: 'URL', type: 'string', default: 'https://', typeOptions: { expression: true } },
            { name: 'authentication', displayName: 'Authentication', type: 'options', options: [{ name: 'None', value: 'none' }, { name: 'Header Auth', value: 'headerAuth' }], default: 'none' },
            { name: 'sendBody', displayName: 'Send Body', type: 'boolean', default: false }
        ]
    },
    {
        type: 'n8n-nodes-base.code',
        icon: <Code size={18} />,
        label: { en: 'Code', es: 'Código' },
        color: 'bg-blue-500',
        category: 'core',
        description: { en: 'Run JavaScript', es: 'Ejecutar JavaScript' },
        properties: [
            { name: 'language', displayName: 'Language', type: 'options', options: [{ name: 'JavaScript', value: 'js' }], default: 'js' },
            { name: 'code', displayName: 'Code', type: 'string', typeOptions: { rows: 10, expression: false }, default: '// Custom code here\nreturn items;' }
        ]
    },
    { type: 'n8n-nodes-base.function', icon: <Hash size={18} />, label: { en: 'Function', es: 'Función' }, color: 'bg-blue-500', category: 'core', description: { en: 'Transform data', es: 'Transformar datos' } },
    { type: 'n8n-nodes-base.set', icon: <Settings size={18} />, label: { en: 'Set', es: 'Set' }, color: 'bg-blue-500', category: 'core', description: { en: 'Set values', es: 'Fijar valores' } },
    { type: 'n8n-nodes-base.executeWorkflow', icon: <Play size={18} />, label: { en: 'Execute Workflow', es: 'Ejecutar Workflow' }, color: 'bg-blue-500', category: 'core', description: { en: 'Run another workflow', es: 'Ejecutar otro flujo' } },

    // === FLOW ===
    {
        type: 'n8n-nodes-base.if',
        icon: <GitBranch size={18} />,
        label: { en: 'IF', es: 'SI' },
        color: 'bg-yellow-500',
        category: 'flow',
        description: { en: 'Conditional logic', es: 'Lógica condicional' },
        outputs: ['true', 'false'],
        properties: [
            { name: 'conditions', displayName: 'Condition Type', type: 'options', options: [{ name: 'Boolean', value: 'boolean' }, { name: 'String', value: 'string' }, { name: 'Number', value: 'number' }], default: 'boolean' },
            { name: 'value1', displayName: 'Value 1', type: 'string', typeOptions: { expression: true } },
            { name: 'value2', displayName: 'Value 2', type: 'string', typeOptions: { expression: true } }
        ]
    },
    { type: 'n8n-nodes-base.switch', icon: <List size={18} />, label: { en: 'Switch', es: 'Switch' }, color: 'bg-yellow-500', category: 'flow', description: { en: 'Multiple routes', es: 'Rutas múltiples' }, outputs: ['0', '1', '2', '3'] },
    { type: 'n8n-nodes-base.merge', icon: <GitBranch size={18} className="rotate-180" />, label: { en: 'Merge', es: 'Unir' }, color: 'bg-yellow-500', category: 'flow', description: { en: 'Merge branches', es: 'Unir ramas' }, inputs: ['input 1', 'input 2'] },
    { type: 'n8n-nodes-base.wait', icon: <Pause size={18} />, label: { en: 'Wait', es: 'Esperar' }, color: 'bg-yellow-500', category: 'flow', description: { en: 'Pause workflow', es: 'Pausar flujo' } },
    { type: 'n8n-nodes-base.loop', icon: <RefreshCw size={18} />, label: { en: 'Loop', es: 'Bucle' }, color: 'bg-yellow-500', category: 'flow', description: { en: 'Loop over items', es: 'Iterar elementos' } },
    { type: 'n8n-nodes-base.errorTrigger', icon: <AlertCircle size={18} />, label: { en: 'Error Trigger', es: 'Disparador Error' }, color: 'bg-red-500', category: 'flow', description: { en: 'On error', es: 'En error' } },

    // === ADVANCED CONTROLLER (xyOps Style) ===
    {
        type: 'n8n-nodes-base.controller',
        icon: <Shuffle size={18} />,
        label: { en: 'Controller', es: 'Controlador' },
        color: 'bg-purple-600',
        category: 'flow',
        description: { en: 'Multiplex, Split, Join, Loop', es: 'Multiplexar, Dividir, Unir, Bucle' },
        properties: [
            {
                name: 'controller',
                displayName: 'Controller Type',
                type: 'options',
                options: [
                    { name: 'Multiplex', value: 'multiplex' },
                    { name: 'Wait', value: 'wait' },
                    { name: 'Repeat (Loop)', value: 'repeat' },
                    { name: 'Split', value: 'split' },
                    { name: 'Join', value: 'join' },
                    { name: 'Decision (If)', value: 'decision' }
                ],
                default: 'multiplex'
            },
            { name: 'stagger', displayName: 'Stagger (ms)', type: 'number', default: 0, description: 'Delay between parallel executions' },
            { name: 'wait', displayName: 'Wait Time (sec)', type: 'number', default: 0, description: 'Time to pause execution' },
            { name: 'repeat', displayName: 'Iterations', type: 'number', default: 1, description: 'Number of times to repeat' },
            { name: 'split', displayName: 'Split Expression', type: 'string', typeOptions: { rows: 3, expression: true }, description: 'Expression to calculate split branches' },
            { name: 'decision', displayName: 'Condition (If)', type: 'string', typeOptions: { rows: 3, expression: true }, description: 'Expression returning true/false' },
            { name: 'continue', displayName: 'Continue %', type: 'number', default: 100, description: 'Percentage of traffic to continue' }
        ]
    },

    // === DATA ===
    { type: 'n8n-nodes-base.activeCampaign', icon: <Users size={18} />, label: { en: 'ActiveCampaign', es: 'ActiveCampaign' }, color: 'bg-purple-500', category: 'data', description: { en: 'Email marketing', es: 'Marketing email' } },
    { type: 'n8n-nodes-base.splitInBatches', icon: <Grid size={18} />, label: { en: 'SplitInBatches', es: 'Lotes' }, color: 'bg-purple-500', category: 'data', description: { en: 'Process loops', es: 'Procesar en bucles' } },
    { type: 'n8n-nodes-base.itemLists', icon: <List size={18} />, label: { en: 'Item Lists', es: 'Listas' }, color: 'bg-purple-500', category: 'data', description: { en: 'List operations', es: 'Operaciones listas' } },
    { type: 'n8n-nodes-base.jsonParse', icon: <Code size={18} />, label: { en: 'JSON Parse', es: 'JSON Parse' }, color: 'bg-purple-500', category: 'data', description: { en: 'Parse JSON string', es: 'Leer string JSON' } },
    { type: 'n8n-nodes-base.filter', icon: <Filter size={18} />, label: { en: 'Filter', es: 'Filtrar' }, color: 'bg-purple-500', category: 'data', description: { en: 'Filter items', es: 'Filtrar elementos' } },
    { type: 'n8n-nodes-base.renameKeys', icon: <Key size={18} />, label: { en: 'Rename Keys', es: 'Renombrar' }, color: 'bg-purple-500', category: 'data', description: { en: 'Rename keys', es: 'Renombrar claves' } },

    // === SOCIAL MEDIA ===
    { type: 'n8n-nodes-base.twitter', icon: <Twitter size={18} />, label: { en: 'Twitter / X', es: 'Twitter / X' }, color: 'bg-sky-500', category: 'social', description: { en: 'Post tweets', es: 'Publicar tweets' } },
    { type: 'n8n-nodes-base.linkedin', icon: <Linkedin size={18} />, label: { en: 'LinkedIn', es: 'LinkedIn' }, color: 'bg-sky-500', category: 'social', description: { en: 'Post to LinkedIn', es: 'Publicar en LinkedIn' } },
    { type: 'n8n-nodes-base.facebook', icon: <Facebook size={18} />, label: { en: 'Facebook', es: 'Facebook' }, color: 'bg-sky-500', category: 'social', description: { en: 'Manage pages', es: 'Gestionar páginas' } },
    { type: 'n8n-nodes-base.instagram', icon: <Instagram size={18} />, label: { en: 'Instagram', es: 'Instagram' }, color: 'bg-sky-500', category: 'social', description: { en: 'Post photos', es: 'Publicar fotos' } },
    { type: 'n8n-nodes-base.discord', icon: <MessageSquare size={18} />, label: { en: 'Discord', es: 'Discord' }, color: 'bg-indigo-500', category: 'social', description: { en: 'Send messages', es: 'Enviar mensajes' } },
    { type: 'n8n-nodes-base.reddit', icon: <MessageSquare size={18} />, label: { en: 'Reddit', es: 'Reddit' }, color: 'bg-orange-600', category: 'social', description: { en: 'Post to Reddit', es: 'Publicar en Reddit' } },

    // === MARKETING & CRM ===
    { type: 'n8n-nodes-base.hubspot', icon: <Users size={18} />, label: { en: 'HubSpot', es: 'HubSpot' }, color: 'bg-orange-500', category: 'marketing', description: { en: 'CRM automation', es: 'Automatización CRM' } },
    { type: 'n8n-nodes-base.salesforce', icon: <Cloud size={18} />, label: { en: 'Salesforce', es: 'Salesforce' }, color: 'bg-blue-600', category: 'marketing', description: { en: 'Enterprise CRM', es: 'CRM Empresarial' } },
    { type: 'n8n-nodes-base.mailchimp', icon: <Mail size={18} />, label: { en: 'Mailchimp', es: 'Mailchimp' }, color: 'bg-yellow-500', category: 'marketing', description: { en: 'Email campaigns', es: 'Campañas email' } },
    { type: 'n8n-nodes-base.pipedrive', icon: <Users size={18} />, label: { en: 'Pipedrive', es: 'Pipedrive' }, color: 'bg-green-600', category: 'marketing', description: { en: 'Sales CRM', es: 'CRM Ventas' } },

    // === STORAGE ===
    { type: 'n8n-nodes-base.googleDrive', icon: <HardDrive size={18} />, label: { en: 'Google Drive', es: 'Google Drive' }, color: 'bg-blue-500', category: 'storage', description: { en: 'File storage', es: 'Almacenamiento' } },
    { type: 'n8n-nodes-base.dropbox', icon: <Box size={18} />, label: { en: 'Dropbox', es: 'Dropbox' }, color: 'bg-blue-400', category: 'storage', description: { en: 'File sync', es: 'Sincronización' } },
    { type: 'n8n-nodes-base.awsS3', icon: <Cloud size={18} />, label: { en: 'AWS S3', es: 'AWS S3' }, color: 'bg-orange-500', category: 'storage', description: { en: 'Object storage', es: 'Almacenamiento objetos' } },
    { type: 'n8n-nodes-base.oneDrive', icon: <Cloud size={18} />, label: { en: 'OneDrive', es: 'OneDrive' }, color: 'bg-blue-600', category: 'storage', description: { en: 'Microsoft storage', es: 'Almacenamiento MS' } },

    // === PAYMENT ===
    { type: 'n8n-nodes-base.stripe', icon: <CreditCard size={18} />, label: { en: 'Stripe', es: 'Stripe' }, color: 'bg-indigo-500', category: 'payment', description: { en: 'Payments', es: 'Pagos' } },
    { type: 'n8n-nodes-base.payPal', icon: <DollarSign size={18} />, label: { en: 'PayPal', es: 'PayPal' }, color: 'bg-blue-700', category: 'payment', description: { en: 'Payments', es: 'Pagos' } },
    { type: 'n8n-nodes-base.shopify', icon: <ShoppingBag size={18} />, label: { en: 'Shopify', es: 'Shopify' }, color: 'bg-green-500', category: 'payment', description: { en: 'E-commerce', es: 'E-commerce' } },

    // === COMMUNICATION ===
    { type: 'n8n-nodes-base.emailSend', icon: <Mail size={18} />, label: { en: 'Send Email', es: 'Enviar Email' }, color: 'bg-orange-500', category: 'communication', description: { en: 'Send email', es: 'Enviar correo' } },
    { type: 'n8n-nodes-base.slack', icon: <MessageSquare size={18} />, label: { en: 'Slack', es: 'Slack' }, color: 'bg-orange-500', category: 'communication', description: { en: 'Chat ops', es: 'Chat ops' } },
    { type: 'n8n-nodes-base.telegram', icon: <Send size={18} />, label: { en: 'Telegram', es: 'Telegram' }, color: 'bg-orange-500', category: 'communication', description: { en: 'Messaging', es: 'Mensajería' } },
    { type: 'n8n-nodes-base.microsoftTeams', icon: <MessageSquare size={18} />, label: { en: 'MS Teams', es: 'MS Teams' }, color: 'bg-indigo-600', category: 'communication', description: { en: 'Team chat', es: 'Chat empresarial' } },
    { type: 'n8n-nodes-base.whatsApp', icon: <MessageSquare size={18} />, label: { en: 'WhatsApp', es: 'WhatsApp' }, color: 'bg-green-500', category: 'communication', description: { en: 'Messaging', es: 'Mensajería' } },

    // === PRODUCTIVITY ===
    { type: 'n8n-nodes-base.googleSheets', icon: <FileText size={18} />, label: { en: 'Google Sheets', es: 'Google Sheets' }, color: 'bg-green-500', category: 'productivity', description: { en: 'Spreadsheets', es: 'Hojas cálculo' } },
    { type: 'n8n-nodes-base.googleCalendar', icon: <Calendar size={18} />, label: { en: 'Google Calendar', es: 'Google Calendar' }, color: 'bg-blue-500', category: 'productivity', description: { en: 'Calendar', es: 'Calendario' } },
    { type: 'n8n-nodes-base.notion', icon: <FileText size={18} />, label: { en: 'Notion', es: 'Notion' }, color: 'bg-gray-500', category: 'productivity', description: { en: 'Workspace', es: 'Espacio trabajo' } },
    { type: 'n8n-nodes-base.airtable', icon: <Database size={18} />, label: { en: 'Airtable', es: 'Airtable' }, color: 'bg-yellow-500', category: 'productivity', description: { en: 'Database', es: 'Base datos' } },
    { type: 'n8n-nodes-base.jira', icon: <CheckCircle size={18} />, label: { en: 'Jira', es: 'Jira' }, color: 'bg-blue-600', category: 'productivity', description: { en: 'Agile tools', es: 'Gestión ágil' } },
    { type: 'n8n-nodes-base.trello', icon: <List size={18} />, label: { en: 'Trello', es: 'Trello' }, color: 'bg-blue-400', category: 'productivity', description: { en: 'Kanban', es: 'Tableros' } },

    // === DEVELOPER ===
    { type: 'n8n-nodes-base.postgres', icon: <Database size={18} />, label: { en: 'Postgres', es: 'Postgres' }, color: 'bg-blue-400', category: 'developer', description: { en: 'SQL DB', es: 'SQL DB' } },
    { type: 'n8n-nodes-base.mysql', icon: <Database size={18} />, label: { en: 'MySQL', es: 'MySQL' }, color: 'bg-orange-400', category: 'developer', description: { en: 'SQL DB', es: 'SQL DB' } },
    { type: 'n8n-nodes-base.redis', icon: <Server size={18} />, label: { en: 'Redis', es: 'Redis' }, color: 'bg-red-500', category: 'developer', description: { en: 'Cache', es: 'Caché' } },
    { type: 'n8n-nodes-base.github', icon: <GitBranch size={18} />, label: { en: 'GitHub', es: 'GitHub' }, color: 'bg-gray-700', category: 'developer', description: { en: 'Git', es: 'Git' } },
    { type: 'n8n-nodes-base.docker', icon: <Box size={18} />, label: { en: 'Docker', es: 'Docker' }, color: 'bg-blue-500', category: 'developer', description: { en: 'Containers', es: 'Contenedores' } },
];

interface NodePaletteProps {
    lang: 'en' | 'es';
    onNodeDragStart: (nodeType: NodeType) => void;
}

export default function NodePalette({ lang: langProp, onNodeDragStart }: NodePaletteProps) {
    const lang = (langProp === 'en' || langProp === 'es') ? langProp : 'en';
    const [isOpen, setIsOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['triggers', 'core']);
    const [searchTerm, setSearchTerm] = useState('');

    const content = {
        en: {
            title: 'Nodes',
            subtitle: 'Drag to canvas or click +',
            toggle: isOpen ? 'Close' : 'Add node',
            search: 'Search nodes...',
        },
        es: {
            title: 'Nodos',
            subtitle: 'Arrastra al canvas o clic en +',
            toggle: isOpen ? 'Cerrar' : 'Agregar nodo',
            search: 'Buscar nodos...',
        },
    };

    const text = content[lang] || content['en'];

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const filteredNodes = useMemo(() => {
        if (!searchTerm) return NODE_TYPES;
        const term = searchTerm.toLowerCase();
        return NODE_TYPES.filter(node =>
            node.label[lang].toLowerCase().includes(term) ||
            node.type.toLowerCase().includes(term) ||
            node.description?.[lang].toLowerCase().includes(term)
        );
    }, [searchTerm, lang]);

    const nodesByCategory = useMemo(() => {
        const grouped: Record<string, NodeType[]> = {};
        CATEGORIES.forEach(cat => {
            grouped[cat.id] = filteredNodes.filter(node => node.category === cat.id);
        });
        return grouped;
    }, [filteredNodes]);

    const hasResults = filteredNodes.length > 0;

    return (
        <motion.div
            className="absolute left-4 top-20 z-40 flex flex-col gap-2"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            onWheel={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-orange-500/30 self-start"
            >
                <Zap size={16} />
                {text.toggle}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="bg-[#1a1a2e] border border-[#2d2d44] rounded-xl shadow-2xl w-80 overflow-hidden"
                        initial={{ scale: 0.95, opacity: 0, y: -10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: -10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-[#2d2d44] bg-[#16162a]">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-white">{text.title}</h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{text.subtitle}</p>
                        </div>

                        {/* Search */}
                        <div className="p-3 border-b border-[#2d2d44] bg-[#16162a]">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={text.search}
                                    className="w-full bg-[#0d0d1a] border border-[#2d2d44] rounded-lg pl-9 pr-8 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-all"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Categories */}
                        <div className="max-h-[60vh] overflow-y-auto">
                            {!hasResults ? (
                                <div className="p-6 text-center text-gray-500 text-sm">
                                    {lang === 'en' ? 'No nodes found' : 'No se encontraron nodos'}
                                </div>
                            ) : searchTerm ? (
                                <div className="p-2">
                                    {filteredNodes.map((nodeType) => (
                                        <NodeItem
                                            key={nodeType.type}
                                            nodeType={nodeType}
                                            lang={lang}
                                            onDragStart={onNodeDragStart}
                                        />
                                    ))}
                                </div>
                            ) : (
                                CATEGORIES.map((category) => {
                                    const nodes = nodesByCategory[category.id];
                                    if (nodes.length === 0) return null;
                                    const isExpanded = expandedCategories.includes(category.id);
                                    const CategoryIcon = category.icon;

                                    return (
                                        <div key={category.id} className="border-b border-[#2d2d44] last:border-0">
                                            <button
                                                onClick={() => toggleCategory(category.id)}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#22223a] transition-colors group"
                                            >
                                                <div className={`${category.color} transition-colors`}>
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </div>
                                                <CategoryIcon size={16} className={category.color} />
                                                <span className="text-sm font-medium text-gray-200 flex-1 text-left">
                                                    {category.label[lang]}
                                                </span>
                                                <span className="text-xs text-gray-500 bg-[#2d2d44] px-2 py-0.5 rounded-full">
                                                    {nodes.length}
                                                </span>
                                            </button>

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="overflow-hidden bg-[#0d0d1a]/50"
                                                    >
                                                        <div className="p-2 pl-4">
                                                            {nodes.map((nodeType) => (
                                                                <NodeItem
                                                                    key={nodeType.type}
                                                                    nodeType={nodeType}
                                                                    lang={lang}
                                                                    onDragStart={onNodeDragStart}
                                                                />
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function NodeItem({
    nodeType,
    lang,
    onDragStart
}: {
    nodeType: NodeType;
    lang: 'en' | 'es';
    onDragStart: (nodeType: NodeType) => void;
}) {
    return (
        <motion.div
            draggable
            onDragStart={() => onDragStart(nodeType)}
            className="flex items-center gap-3 px-3 py-2.5 bg-[#1a1a2e] hover:bg-[#22223a] rounded-lg cursor-move transition-all group mb-1.5 last:mb-0 border border-transparent hover:border-[#3d3d5c]"
            whileHover={{ scale: 1.01, x: 2 }}
            whileTap={{ scale: 0.98 }}
        >
            <div className={`w-9 h-9 ${nodeType.color} rounded-lg flex items-center justify-center text-white shadow-md`}>
                {nodeType.icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 font-medium truncate group-hover:text-white transition-colors">
                    {nodeType.label[lang]}
                </div>
                {nodeType.description && (
                    <div className="text-xs text-gray-500 truncate">
                        {nodeType.description[lang]}
                    </div>
                )}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
            </div>
        </motion.div>
    );
}

export { NODE_TYPES, CATEGORIES };
