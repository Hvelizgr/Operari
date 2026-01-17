'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Mail, Database, Webhook, Code, FileText } from 'lucide-react';
import { useState } from 'react';
import type { WorkflowNode, Connection } from '@nanoflow/shared';

interface WorkflowTemplate {
    id: string;
    name: { en: string; es: string };
    description: { en: string; es: string };
    category: 'email' | 'data' | 'webhooks' | 'automation';
    nodes: WorkflowNode[];
    connections: Connection[];
}

const TEMPLATES: WorkflowTemplate[] = [
    // 1. RSS Feed to Slack - Beginner (2 nodes)
    {
        id: 'rss-to-slack',
        name: { en: 'RSS Feed to Slack', es: 'Feed RSS a Slack' },
        description: {
            en: 'Get notified in Slack when new articles are published in any RSS feed',
            es: 'Recibe notificaciones en Slack cuando se publican nuevos articulos en un feed RSS'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'RSS Feed', type: 'Trigger', config: { feedUrl: 'https://example.com/rss', pollInterval: '15m' } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Send to Slack', type: 'Action', config: { channel: '#news', message: '{{title}}: {{link}}' } },
        ],
        connections: [{ id: 'conn-1', source: 'node-1', target: 'node-2' }],
    },
    // 2. Google Sheets to Email - Beginner (2 nodes)
    {
        id: 'sheets-to-email',
        name: { en: 'Google Sheets New Row Alert', es: 'Alerta de Nueva Fila en Sheets' },
        description: {
            en: 'Send email notification when a new row is added to Google Sheets (form submissions, leads)',
            es: 'Envia notificacion por email cuando se agrega una nueva fila en Google Sheets'
        },
        category: 'email',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'New Sheet Row', type: 'Trigger', config: { spreadsheetId: 'your-sheet-id', sheetName: 'Form Responses' } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Send Email', type: 'Email', config: { to: 'team@example.com', subject: 'New Form Submission', body: 'Name: {{name}}\nEmail: {{email}}' } },
        ],
        connections: [{ id: 'conn-1', source: 'node-1', target: 'node-2' }],
    },
    // 3. Daily Weather Alert - Beginner+ (3 nodes)
    {
        id: 'weather-alert',
        name: { en: 'Daily Weather Forecast', es: 'Pronostico Diario del Clima' },
        description: {
            en: 'Get your daily weather forecast via email or Slack every morning',
            es: 'Recibe tu pronostico del clima diario por email o Slack cada manana'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'Daily Schedule', type: 'Schedule', config: { cron: '0 7 * * *', timezone: 'America/New_York' } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Get Weather', type: 'HTTP', config: { url: 'https://api.openweathermap.org/data/2.5/weather?q=London', method: 'GET' } },
            { id: 'node-3', position: { x: 700, y: 150 }, title: 'Send Alert', type: 'Email', config: { to: 'user@example.com', subject: 'Weather Today', body: 'Temperature: {{temp}}C\nCondition: {{description}}' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
    // 4. GitHub Issue to Discord - Beginner (2 nodes)
    {
        id: 'github-to-discord',
        name: { en: 'GitHub Issues to Discord', es: 'Issues de GitHub a Discord' },
        description: {
            en: 'Post a Discord message when someone creates a new issue in your GitHub repo',
            es: 'Publica un mensaje en Discord cuando alguien crea un nuevo issue en tu repo de GitHub'
        },
        category: 'webhooks',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'GitHub Webhook', type: 'Webhook', config: { path: '/github-issues', events: ['issues.opened'] } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Discord Message', type: 'Action', config: { webhookUrl: 'https://discord.com/api/webhooks/...', message: 'New Issue: {{title}} by {{user}}' } },
        ],
        connections: [{ id: 'conn-1', source: 'node-1', target: 'node-2' }],
    },
    // 5. Social Media Scheduler - Beginner+ (3 nodes)
    {
        id: 'social-scheduler',
        name: { en: 'Social Media Post Scheduler', es: 'Programador de Redes Sociales' },
        description: {
            en: 'Schedule and auto-publish posts from a spreadsheet to Twitter/X',
            es: 'Programa y publica automaticamente posts desde una hoja de calculo a Twitter/X'
        },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'Schedule', type: 'Schedule', config: { cron: '0 9,12,18 * * *', timezone: 'UTC' } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Get Next Post', type: 'Database', config: { operation: 'select', query: 'SELECT * FROM posts WHERE published = false LIMIT 1' } },
            { id: 'node-3', position: { x: 700, y: 150 }, title: 'Post to Twitter', type: 'Action', config: { platform: 'twitter', content: '{{content}}' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
    // 6. Contact Form to CRM - Beginner+ (3 nodes)
    {
        id: 'form-to-crm',
        name: { en: 'Contact Form to CRM', es: 'Formulario de Contacto a CRM' },
        description: {
            en: 'Save form submissions to a spreadsheet/CRM and send auto-reply email',
            es: 'Guarda envios de formulario en una hoja de calculo/CRM y envia email de respuesta automatica'
        },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'Form Webhook', type: 'Webhook', config: { path: '/contact-form', method: 'POST' } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Save to Sheets', type: 'Database', config: { operation: 'insert', table: 'contacts', fields: ['name', 'email', 'message'] } },
            { id: 'node-3', position: { x: 700, y: 150 }, title: 'Send Confirmation', type: 'Email', config: { to: '{{email}}', subject: 'Thanks for contacting us!', body: 'Hi {{name}}, we received your message and will respond soon.' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
];

interface TemplateGalleryProps {
    onSelectTemplate: (nodes: WorkflowNode[], connections: Connection[]) => void;
    lang: 'en' | 'es';
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export default function TemplateGallery({ onSelectTemplate, lang, isOpen: controlledIsOpen, onOpenChange }: TemplateGalleryProps) {
    const [internalIsOpen, setInternalIsOpen] = useState(false);

    // Support both controlled and uncontrolled modes
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const setIsOpen = (open: boolean) => {
        if (onOpenChange) {
            onOpenChange(open);
        } else {
            setInternalIsOpen(open);
        }
    };
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const content = {
        en: {
            title: 'Workflow Templates',
            subtitle: 'Start with a pre-built template',
            all: 'All',
            email: 'Email',
            data: 'Data',
            webhooks: 'Webhooks',
            automation: 'Automation',
            useTemplate: 'Use Template',
            close: 'Close',
            openGallery: 'Templates',
        },
        es: {
            title: 'Plantillas de Flujo',
            subtitle: 'Comienza con una plantilla predefinida',
            all: 'Todas',
            email: 'Email',
            data: 'Datos',
            webhooks: 'Webhooks',
            automation: 'Automatización',
            useTemplate: 'Usar Plantilla',
            close: 'Cerrar',
            openGallery: 'Plantillas',
        },
    };

    const text = content[lang] || content['en'];

    const categories = [
        { id: 'all', label: text.all, icon: FileText },
        { id: 'email', label: text.email, icon: Mail },
        { id: 'data', label: text.data, icon: Database },
        { id: 'webhooks', label: text.webhooks, icon: Webhook },
        { id: 'automation', label: text.automation, icon: Zap },
    ];

    const filteredTemplates = selectedCategory === 'all'
        ? TEMPLATES
        : TEMPLATES.filter(t => t.category === selectedCategory);

    const handleSelectTemplate = (template: WorkflowTemplate) => {
        onSelectTemplate(template.nodes, template.connections);
        setIsOpen(false);
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'email': return <Mail size={16} />;
            case 'data': return <Database size={16} />;
            case 'webhooks': return <Webhook size={16} />;
            case 'automation': return <Zap size={16} />;
            default: return <Code size={16} />;
        }
    };

    // Hide the internal button when controlled externally
    const showInternalButton = controlledIsOpen === undefined;

    return (
        <>
            {showInternalButton && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="absolute top-20 left-4 flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-lg border border-slate-700 z-40"
                >
                    <FileText size={16} />
                    {text.openGallery}
                </button>
            )}

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

                        <motion.div
                            className="relative bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-6 max-w-5xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-100">{text.title}</h2>
                                    <p className="text-sm text-slate-400 mt-1">{text.subtitle}</p>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mb-6">
                                {categories.map((category) => (
                                    <button
                                        key={category.id}
                                        onClick={() => setSelectedCategory(category.id)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === category.id
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            }`}
                                    >
                                        <category.icon size={16} />
                                        {category.label}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-1">
                                {filteredTemplates.map((template) => (
                                    <motion.div
                                        key={template.id}
                                        className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer group"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleSelectTemplate(template)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                {getCategoryIcon(template.category)}
                                                <h3 className="text-sm font-semibold text-slate-100">
                                                    {template.name[lang]}
                                                </h3>
                                            </div>
                                            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                                                {template.nodes.length} nodes
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-4">
                                            {template.description[lang]}
                                        </p>
                                        <button
                                            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelectTemplate(template);
                                            }}
                                        >
                                            {text.useTemplate}
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
