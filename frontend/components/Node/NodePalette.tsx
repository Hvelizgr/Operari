'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, ChevronRight, Search, X,
    Globe, Clock,
    Webhook, Folder, Zap,
    Play,
    Bell, Square, StickyNote,
    Terminal, UserCheck
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

// NanoRun runbook step categories — only categories that have at least
// one step type with a real backend executor. Categories without
// backing executors (flow control, integrations, ai) were dropped on
// the editor cleanup pass — they were vapor and produced "Unknown
// node type" the moment an operator tried to run them. To re-add a
// category, first land its executor in backend/src/runbook/executors/.
const CATEGORIES = [
    { id: 'devops', label: { en: 'Runbook core', es: 'Runbook core' }, icon: Terminal, color: 'text-emerald-400' },
    { id: 'triggers', label: { en: 'Triggers', es: 'Triggers' }, icon: Play, color: 'text-green-400' },
    { id: 'core', label: { en: 'Core', es: 'Core' }, icon: Zap, color: 'text-blue-400' },
    { id: 'organization', label: { en: 'Organization', es: 'Organización' }, icon: Folder, color: 'text-slate-400' },
];

// Curated runbook step palette — see docs/rebranding-and-editor-audit.md
// section 3.5 for the full rationale. Down from 72 nodes to ~20.
//
// What got dropped:
//   - Social: Twitter, LinkedIn, Facebook, Instagram, Discord, Reddit
//   - Marketing/CRM: HubSpot, Salesforce, Mailchimp, Pipedrive, ActiveCampaign
//   - E-commerce/payments: Stripe (as integration), PayPal, Shopify
//   - Productivity: Google Sheets, Google Calendar, Notion, Airtable, Trello
//   - Storage: Google Drive, Dropbox, OneDrive (kept S3 only)
//   - Data ETL: Filter, JSON Parse, Item Lists, Split In Batches, Rename Keys
//   - Communication: Telegram, MS Teams, WhatsApp, Email Send (Notify covers)
//   - AI providers as individual nodes: OpenAI, LangChain, HuggingFace,
//     Anthropic, StabilityAI (the agent is global, not per-step)
//   - Redundant: function (dup of code), code (conflicts with shell),
//     manualTrigger (Run button), executeWorkflow, merge (data-flow concept),
//     n8n wait trigger (conflict with wait.executor), controller multiplex/
//     split/join, scheduleTrigger (cron covers it)
//   - Database: MySQL, Redis (kept Postgres only)
//
// What stayed: shell, approval, notify, wait, http, set, condition,
// switch, loop, error trigger, agent, frame, note, plus 4 native dev
// integrations (Postgres, GitHub, Docker, AWS S3) + webhook + cron triggers.
const NODE_TYPES: NodeType[] = [
    // === RUNBOOK CORE (NanoRun-native step types) ===
    {
        type: 'shell',
        icon: <Terminal size={18} />,
        label: { en: 'Shell command', es: 'Comando shell' },
        color: 'bg-emerald-600',
        category: 'devops',
        description: { en: 'Run a bash/sh command in a sandboxed runner', es: 'Ejecutar un comando bash/sh en un runner aislado' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            { name: 'command', displayName: 'Command', type: 'string', default: 'echo "hello from nanorun"' },
            { name: 'cwd', displayName: 'Working directory', type: 'string', default: '' },
            { name: 'timeout', displayName: 'Timeout (ms)', type: 'number', default: 60000 },
        ]
    },
    {
        type: 'approval',
        icon: <UserCheck size={18} />,
        label: { en: 'Approval gate', es: 'Gate de aprobación' },
        color: 'bg-amber-600',
        category: 'devops',
        description: { en: 'Pause until a human approves via Slack or CLI', es: 'Pausar hasta que un humano apruebe vía Slack o CLI' },
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
        description: { en: 'Send to Slack, Discord, or a generic webhook', es: 'Enviar a Slack, Discord o un webhook genérico' },
        inputs: ['main'],
        outputs: ['main'],
        properties: [
            { name: 'channel', displayName: 'Channel', type: 'options', options: [
                { name: 'Slack', value: 'slack' },
                { name: 'Discord', value: 'discord' },
                { name: 'Generic webhook', value: 'webhook' },
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

    // === TRIGGERS ===
    {
        type: 'nanorun.webhook',
        icon: <Webhook size={18} />,
        label: { en: 'Webhook trigger', es: 'Trigger webhook' },
        color: 'bg-green-500',
        category: 'triggers',
        description: { en: 'Run on incoming HTTP request (HMAC-verified)', es: 'Disparar al recibir HTTP request (verificado con HMAC)' },
        properties: [
            { name: 'httpMethod', displayName: 'HTTP method', type: 'options', options: [{ name: 'GET', value: 'GET' }, { name: 'POST', value: 'POST' }], default: 'POST' },
            { name: 'path', displayName: 'Path', type: 'string', default: 'webhook-demo' },
            { name: 'responseMode', displayName: 'Response mode', type: 'options', options: [{ name: 'On received', value: 'onReceived' }, { name: 'Last node', value: 'lastNode' }], default: 'onReceived' }
        ]
    },
    {
        type: 'nanorun.cron',
        icon: <Clock size={18} />,
        label: { en: 'Cron trigger', es: 'Trigger cron' },
        color: 'bg-green-500',
        category: 'triggers',
        description: { en: 'Run on a cron schedule', es: 'Disparar en horario cron' },
        properties: [
            { name: 'expression', displayName: 'Cron expression', type: 'string', default: '0 * * * *' },
        ]
    },

    // === CORE ===
    {
        type: 'nanorun.httpRequest',
        icon: <Globe size={18} />,
        label: { en: 'HTTP request', es: 'HTTP request' },
        color: 'bg-blue-500',
        category: 'core',
        description: { en: 'Call an external API (Datadog, Sentry, GitHub, etc.)', es: 'Llamar una API externa (Datadog, Sentry, GitHub, etc.)' },
        properties: [
            { name: 'method', displayName: 'Method', type: 'options', options: [{ name: 'GET', value: 'GET' }, { name: 'POST', value: 'POST' }, { name: 'PUT', value: 'PUT' }, { name: 'DELETE', value: 'DELETE' }], default: 'GET' },
            { name: 'url', displayName: 'URL', type: 'string', default: 'https://', typeOptions: { expression: true } },
            { name: 'authentication', displayName: 'Authentication', type: 'options', options: [{ name: 'None', value: 'none' }, { name: 'Bearer token', value: 'bearer' }], default: 'none' },
            { name: 'sendBody', displayName: 'Send body', type: 'boolean', default: false }
        ]
    },

    // === ORGANIZATION ===
    {
        type: 'custom.frame',
        icon: <Square size={18} />,
        label: { en: 'Section', es: 'Sección' },
        color: 'bg-slate-600',
        category: 'organization',
        description: { en: 'Group steps together visually', es: 'Agrupar pasos visualmente' },
        properties: [
            { name: 'title', displayName: 'Title', type: 'string', default: 'Section' },
            { name: 'color', displayName: 'Color', type: 'color', default: '#3791f5' },
        ]
    },
    {
        type: 'custom.note',
        icon: <StickyNote size={18} />,
        label: { en: 'Note', es: 'Nota' },
        color: 'bg-slate-600',
        category: 'organization',
        description: { en: 'Add inline documentation', es: 'Agregar documentación inline' },
        properties: [
            { name: 'text', displayName: 'Text', type: 'string', typeOptions: { rows: 5 }, default: '' },
        ]
    },
];

interface NodePaletteProps {
    lang: 'en' | 'es';
    onNodeDragStart: (nodeType: NodeType) => void;
}

export default function NodePalette({ lang: langProp, onNodeDragStart }: NodePaletteProps) {
    const lang = (langProp === 'en' || langProp === 'es') ? langProp : 'en';
    const [isOpen, setIsOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['devops', 'triggers']);
    const [searchTerm, setSearchTerm] = useState('');

    const content = {
        en: {
            title: 'Steps',
            subtitle: 'Drag to canvas or click +',
            toggle: isOpen ? 'Close' : 'Add step',
            search: 'Search steps...',
        },
        es: {
            title: 'Pasos',
            subtitle: 'Arrastrá al canvas o clic en +',
            toggle: isOpen ? 'Cerrar' : 'Agregar paso',
            search: 'Buscar pasos...',
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
