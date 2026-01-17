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
    {
        id: 'email-notification',
        name: { en: 'Email Notification', es: 'Notificación por Email' },
        description: { en: 'Send email when webhook is triggered', es: 'Enviar email cuando se activa webhook' },
        category: 'email',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'Webhook Trigger', type: 'Webhook', config: { path: '/webhook' } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Send Email', type: 'Email', config: { to: 'recipient@example.com', subject: 'Notification', body: 'Hello!' } },
        ],
        connections: [{ id: 'conn-1', source: 'node-1', target: 'node-2' }],
    },
    {
        id: 'data-processing',
        name: { en: 'Data Processing', es: 'Procesamiento de Datos' },
        description: { en: 'Transform and store data in database', es: 'Transformar y almacenar datos en base de datos' },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'Webhook', type: 'Webhook', config: { path: '/data' } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Transform Data', type: 'Transform', config: { expression: '$.data' } },
            { id: 'node-3', position: { x: 700, y: 150 }, title: 'Save to DB', type: 'Database', config: { operation: 'insert', table: 'records' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
    {
        id: 'conditional-workflow',
        name: { en: 'Conditional Workflow', es: 'Flujo Condicional' },
        description: { en: 'Branch workflow based on conditions', es: 'Ramificar flujo según condiciones' },
        category: 'automation',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'Start', type: 'Webhook', config: { path: '/start' } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Check Condition', type: 'Condition', config: { field: 'status', operator: 'equals', value: 'active' } },
            { id: 'node-3', position: { x: 700, y: 80 }, title: 'Action A', type: 'Action', config: { action: 'process' } },
            { id: 'node-4', position: { x: 700, y: 220 }, title: 'Action B', type: 'Email', config: { to: 'admin@example.com', subject: 'Alert', body: 'Condition failed' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-2', target: 'node-4' },
        ],
    },
    {
        id: 'api-integration',
        name: { en: 'API Integration', es: 'Integración API' },
        description: { en: 'Fetch, transform and forward data', es: 'Obtener, transformar y reenviar datos' },
        category: 'webhooks',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'HTTP Request', type: 'Webhook', config: { path: '/api' } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Transform', type: 'Transform', config: { expression: '$.result' } },
            { id: 'node-3', position: { x: 700, y: 150 }, title: 'Forward', type: 'Action', config: { action: 'forward' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
    {
        id: 'database-sync',
        name: { en: 'Database Sync', es: 'Sincronización de DB' },
        description: { en: 'Sync data between databases', es: 'Sincronizar datos entre bases de datos' },
        category: 'data',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'Read DB', type: 'Database', config: { operation: 'select', table: 'source' } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Transform', type: 'Transform', config: { expression: '$.records' } },
            { id: 'node-3', position: { x: 700, y: 150 }, title: 'Write DB', type: 'Database', config: { operation: 'upsert', table: 'target' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
        ],
    },
    {
        id: 'email-digest',
        name: { en: 'Email Digest', es: 'Resumen por Email' },
        description: { en: 'Collect data and send summary email', es: 'Recopilar datos y enviar email resumen' },
        category: 'email',
        nodes: [
            { id: 'node-1', position: { x: 100, y: 150 }, title: 'Trigger', type: 'Webhook', config: { path: '/digest' } },
            { id: 'node-2', position: { x: 400, y: 150 }, title: 'Fetch Data', type: 'Database', config: { operation: 'select', table: 'items' } },
            { id: 'node-3', position: { x: 700, y: 150 }, title: 'Format Email', type: 'Transform', config: { expression: '$.items | format_digest' } },
            { id: 'node-4', position: { x: 1000, y: 150 }, title: 'Send Digest', type: 'Email', config: { to: 'team@example.com', subject: 'Daily Digest', body: '{{formatted}}' } },
        ],
        connections: [
            { id: 'conn-1', source: 'node-1', target: 'node-2' },
            { id: 'conn-2', source: 'node-2', target: 'node-3' },
            { id: 'conn-3', source: 'node-3', target: 'node-4' },
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
