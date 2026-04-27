'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Folder,
  GitBranch,
  Globe,
  KeyRound,
  Play,
  Repeat,
  Route,
  Search,
  Square,
  StickyNote,
  Terminal,
  UserCheck,
  Webhook,
  X,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Property } from './DynamicNodeForm';

export interface NodeType {
  type: string;
  icon: React.ReactNode;
  label: { en: string; es: string };
  color: string;
  category: string;
  description?: { en: string; es: string };
  inputs?: string[]; // e.g. ['main', 'ai_tool', 'ai_memory']
  outputs?: string[]; // e.g. ['main', 'main']
  properties?: Property[]; // Dynamic form schema
}

// Operari runbook step categories — only categories that have at least
// one step type with a real backend executor. Categories without
// backing executors (flow control, integrations, ai) were dropped on
// the editor cleanup pass — they were vapor and produced "Unknown
// node type" the moment an operator tried to run them. To re-add a
// category, first land its executor in backend/src/runbook/executors/.
const CATEGORIES = [
  {
    id: 'devops',
    label: { en: 'Runbook core', es: 'Runbook core' },
    icon: Terminal,
    color: 'text-emerald-400',
  },
  {
    id: 'triggers',
    label: { en: 'Triggers', es: 'Triggers' },
    icon: Play,
    color: 'text-green-400',
  },
  { id: 'core', label: { en: 'Core', es: 'Core' }, icon: Zap, color: 'text-primary/70' },
  {
    id: 'organization',
    label: { en: 'Organization', es: 'Organización' },
    icon: Folder,
    color: 'text-slate-400',
  },
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
// What stayed (post-pivot, hand-verified against the backend executors):
//   shell, approval, notify, wait, operari.httpRequest,
//   operari.webhook (trigger), operari.cron (trigger),
//   custom.frame, custom.note.
// 9 step types total. Anything not on this list has no executor and
// must not be re-added to the palette without one.
const NODE_TYPES: NodeType[] = [
  // === RUNBOOK CORE (Operari-native step types) ===
  {
    type: 'shell',
    icon: <Terminal size={18} />,
    label: { en: 'Shell command', es: 'Comando shell' },
    color: 'bg-emerald-600',
    category: 'devops',
    description: {
      en: 'Run a bash/sh command in a sandboxed runner',
      es: 'Ejecutar un comando bash/sh en un runner aislado',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        name: 'command',
        displayName: 'Command',
        type: 'string',
        default: 'echo "hello from operari"',
      },
      { name: 'cwd', displayName: 'Working directory', type: 'string', default: '' },
      { name: 'timeout', displayName: 'Timeout (ms)', type: 'number', default: 60000 },
    ],
  },
  {
    type: 'ssh',
    icon: <KeyRound size={18} />,
    label: { en: 'SSH command', es: 'Comando SSH' },
    color: 'bg-cyan-600',
    category: 'devops',
    description: {
      en: 'Run a command on a remote host via SSH',
      es: 'Ejecutar comando en host remoto vía SSH',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        name: 'host',
        displayName: 'Host',
        type: 'string',
        default: '',
        typeOptions: { expression: true },
        description: 'IP or hostname. Supports {{vars.x}} templates.',
      },
      { name: 'port', displayName: 'Port', type: 'number', default: 22 },
      {
        name: 'username',
        displayName: 'Username',
        type: 'string',
        default: 'deploy',
        typeOptions: { expression: true },
      },
      {
        name: 'credentialId',
        displayName: 'SSH private key',
        type: 'secret',
        typeOptions: { provider: 'ssh' },
        description: 'ConnectedAccount holding the PEM-encoded private key.',
      },
      {
        name: 'command',
        displayName: 'Command',
        type: 'string',
        default: 'hostname',
        typeOptions: { rows: 3, expression: true },
        description: 'Shell command to execute on the remote host.',
      },
      {
        name: 'cwd',
        displayName: 'Working directory',
        type: 'string',
        default: '',
        description: 'Prepended as cd <dir> && before the command.',
      },
      {
        name: 'failOnNonZeroExit',
        displayName: 'Fail on non-zero exit',
        type: 'boolean',
        default: true,
      },
      { name: 'timeout', displayName: 'Timeout (ms)', type: 'number', default: 60000 },
    ],
  },
  {
    type: 'operari.database',
    icon: <Database size={18} />,
    label: { en: 'Database', es: 'Base de datos' },
    color: 'bg-primary',
    category: 'devops',
    description: {
      en: 'Introspect schema, health check, or read-only query (PostgreSQL)',
      es: 'Introspección de esquema, health check o consulta de lectura (PostgreSQL)',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        options: [
          { name: 'Health check', value: 'health' },
          { name: 'Introspect schema', value: 'introspect' },
          { name: 'Query (read-only)', value: 'query' },
        ],
        default: 'health',
      },
      {
        name: 'credentialId',
        displayName: 'Database credential',
        type: 'secret',
        typeOptions: { provider: 'postgres' },
        description: 'ConnectedAccount with PostgreSQL connection string.',
      },
      {
        name: 'query',
        displayName: 'SQL query',
        type: 'sql',
        default: '',
        typeOptions: { rows: 5 },
        description: 'Only for operation=query. Read-only (wrapped in BEGIN READ ONLY).',
      },
      {
        name: 'useSshTunnel',
        displayName: 'Use SSH tunnel (bastion)',
        type: 'boolean',
        default: false,
        description: 'Route through an SSH bastion host for protected databases.',
      },
      {
        name: 'sshTunnel.host',
        displayName: 'Bastion host',
        type: 'string',
        default: '',
        typeOptions: { expression: true },
        description: 'SSH bastion hostname or IP.',
      },
      { name: 'sshTunnel.port', displayName: 'Bastion SSH port', type: 'number', default: 22 },
      {
        name: 'sshTunnel.username',
        displayName: 'Bastion username',
        type: 'string',
        default: 'ec2-user',
        typeOptions: { expression: true },
      },
      {
        name: 'sshTunnel.sshCredentialId',
        displayName: 'Bastion SSH key',
        type: 'secret',
        typeOptions: { provider: 'ssh' },
        description: 'SSH private key for the bastion host.',
      },
      { name: 'timeout', displayName: 'Timeout (ms)', type: 'number', default: 30000 },
    ],
  },
  {
    type: 'approval',
    icon: <UserCheck size={18} />,
    label: { en: 'Approval gate', es: 'Gate de aprobación' },
    color: 'bg-amber-600',
    category: 'devops',
    description: {
      en: 'Pause until a human approves via Slack or CLI',
      es: 'Pausar hasta que un humano apruebe vía Slack o CLI',
    },
    inputs: ['main'],
    outputs: ['approved', 'rejected'],
    properties: [
      {
        name: 'message',
        displayName: 'Message to approvers',
        type: 'string',
        default: 'Approve to continue',
      },
      {
        name: 'approvers',
        displayName: 'Approver emails (comma-separated)',
        type: 'string',
        default: '',
      },
    ],
  },
  {
    type: 'notify',
    icon: <Bell size={18} />,
    label: { en: 'Notify', es: 'Notificar' },
    color: 'bg-pink-600',
    category: 'devops',
    description: {
      en: 'Send to Slack, Discord, or a generic webhook',
      es: 'Enviar a Slack, Discord o un webhook genérico',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        name: 'channel',
        displayName: 'Channel',
        type: 'options',
        options: [
          { name: 'Slack', value: 'slack' },
          { name: 'Discord', value: 'discord' },
          { name: 'Generic webhook', value: 'webhook' },
        ],
        default: 'slack',
      },
      { name: 'webhookUrl', displayName: 'Webhook URL', type: 'string', default: '' },
      {
        name: 'message',
        displayName: 'Message',
        type: 'string',
        default: 'Runbook step completed',
      },
      { name: 'title', displayName: 'Title (optional)', type: 'string', default: '' },
    ],
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
    ],
  },

  // === TRIGGERS ===
  {
    type: 'operari.webhook',
    icon: <Webhook size={18} />,
    label: { en: 'Webhook trigger', es: 'Trigger webhook' },
    color: 'bg-green-500',
    category: 'triggers',
    description: {
      en: 'Run on incoming HTTP request (HMAC-verified)',
      es: 'Disparar al recibir HTTP request (verificado con HMAC)',
    },
    properties: [
      {
        name: 'httpMethod',
        displayName: 'HTTP method',
        type: 'options',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
        ],
        default: 'POST',
      },
      { name: 'path', displayName: 'Path', type: 'string', default: 'webhook-demo' },
      {
        name: 'responseMode',
        displayName: 'Response mode',
        type: 'options',
        options: [
          { name: 'On received', value: 'onReceived' },
          { name: 'Last node', value: 'lastNode' },
        ],
        default: 'onReceived',
      },
    ],
  },
  {
    type: 'operari.cron',
    icon: <Clock size={18} />,
    label: { en: 'Cron trigger', es: 'Trigger cron' },
    color: 'bg-green-500',
    category: 'triggers',
    description: { en: 'Run on a cron schedule', es: 'Disparar en horario cron' },
    properties: [
      { name: 'expression', displayName: 'Cron expression', type: 'string', default: '0 * * * *' },
    ],
  },

  // === CORE (control flow + integrations) ===
  {
    type: 'Condition',
    icon: <GitBranch size={18} />,
    label: { en: 'Condition', es: 'Condición' },
    color: 'bg-primary',
    category: 'core',
    description: {
      en: 'Branch true/false based on a field value',
      es: 'Bifurcar verdadero/falso según un campo',
    },
    inputs: ['main'],
    outputs: ['true', 'false'],
    properties: [
      {
        name: 'field',
        displayName: 'Field',
        type: 'string',
        default: '',
        typeOptions: { expression: true },
        description: 'Path to evaluate (e.g. "status", "vars.branch")',
      },
      {
        name: 'operator',
        displayName: 'Operator',
        type: 'options',
        options: [
          { name: 'Equals', value: 'equals' },
          { name: 'Not equals', value: 'notEquals' },
          { name: 'Contains', value: 'contains' },
          { name: 'Greater than', value: 'greaterThan' },
          { name: 'Less than', value: 'lessThan' },
          { name: 'Is empty', value: 'isEmpty' },
          { name: 'Is not empty', value: 'isNotEmpty' },
        ],
        default: 'equals',
      },
      {
        name: 'value',
        displayName: 'Value',
        type: 'string',
        default: '',
        typeOptions: { expression: true },
        description: 'Value to compare against. Supports {{vars.x}} templates.',
      },
    ],
  },
  {
    type: 'Switch',
    icon: <Route size={18} />,
    label: { en: 'Switch', es: 'Switch' },
    color: 'bg-primary',
    category: 'core',
    description: {
      en: 'Multi-way branch by matching a field against cases',
      es: 'Bifurcación múltiple comparando un campo contra casos',
    },
    inputs: ['main'],
    outputs: ['case 0', 'case 1', 'default'],
    properties: [
      {
        name: 'field',
        displayName: 'Field',
        type: 'string',
        default: '',
        typeOptions: { expression: true },
        description: 'Path to evaluate (e.g. "status", "vars.action")',
      },
      {
        name: 'cases',
        displayName: 'Cases (JSON array)',
        type: 'string',
        default: '[{"value":"success","label":"success"},{"value":"failure","label":"failure"}]',
        typeOptions: { rows: 3 },
        description: 'Array of {value, label} objects. Each case maps to an output port.',
      },
    ],
  },
  {
    type: 'Loop',
    icon: <Repeat size={18} />,
    label: { en: 'Loop', es: 'Bucle' },
    color: 'bg-primary',
    category: 'core',
    description: {
      en: 'Iterate over an array, running children once per item',
      es: 'Iterar sobre un arreglo, ejecutando hijos una vez por elemento',
    },
    inputs: ['main'],
    outputs: ['iteration'],
    properties: [
      {
        name: 'itemsPath',
        displayName: 'Items path',
        type: 'string',
        default: '',
        typeOptions: { expression: true },
        description:
          'Path to the array in input (e.g. "servers", "vars.targets"). Takes precedence over inline items.',
      },
      {
        name: 'items',
        displayName: 'Items (JSON array)',
        type: 'string',
        default: '[]',
        typeOptions: { rows: 3 },
        description: 'Inline array. Used only if Items path is empty.',
      },
    ],
  },
  {
    type: 'operari.httpRequest',
    icon: <Globe size={18} />,
    label: { en: 'HTTP request', es: 'HTTP request' },
    color: 'bg-primary',
    category: 'core',
    description: {
      en: 'Call an external API (Datadog, Sentry, GitHub, etc.)',
      es: 'Llamar una API externa (Datadog, Sentry, GitHub, etc.)',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        name: 'method',
        displayName: 'Method',
        type: 'options',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'HEAD', value: 'HEAD' },
        ],
        default: 'GET',
      },
      {
        name: 'url',
        displayName: 'URL',
        type: 'string',
        default: 'https://',
        typeOptions: { expression: true },
        description: 'Supports {{vars.x}} and {{secrets.y}} templates.',
      },
      {
        name: 'headers',
        displayName: 'Headers (JSON)',
        type: 'string',
        default: '',
        typeOptions: { rows: 3, expression: true },
        description: 'JSON object, e.g. {"Authorization": "Bearer {{secrets.token}}"}',
      },
      {
        name: 'body',
        displayName: 'Body',
        type: 'string',
        default: '',
        typeOptions: { rows: 4, expression: true },
        description: 'Request body (ignored for GET/HEAD). Supports templates.',
      },
      { name: 'failOnNon2xx', displayName: 'Fail on non-2xx', type: 'boolean', default: true },
      { name: 'followRedirects', displayName: 'Follow redirects', type: 'boolean', default: true },
      { name: 'timeout', displayName: 'Timeout (ms)', type: 'number', default: 30000 },
    ],
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
    ],
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
    ],
  },
];

interface NodePaletteProps {
  lang: 'en' | 'es';
  onNodeDragStart: (nodeType: NodeType) => void;
  /** Override the default runbook node types. Used by the SQL editor. */
  nodeTypes?: NodeType[];
  /** Override the default categories. */
  categories?: {
    id: string;
    label: { en: string; es: string };
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
  }[];
}

export default function NodePalette({
  lang: langProp,
  onNodeDragStart,
  nodeTypes: customNodeTypes,
  categories: customCategories,
}: NodePaletteProps) {
  const lang = langProp === 'en' || langProp === 'es' ? langProp : 'en';
  const effectiveNodeTypes = customNodeTypes ?? NODE_TYPES;
  const effectiveCategories = customCategories
    ? customCategories.map(c => ({ ...c, icon: c.icon ?? Zap }))
    : CATEGORIES;
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    effectiveCategories.slice(0, 2).map(c => c.id)
  );
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
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  const filteredNodes = useMemo(() => {
    if (!searchTerm) return effectiveNodeTypes;
    const term = searchTerm.toLowerCase();
    return effectiveNodeTypes.filter(
      node =>
        node.label[lang].toLowerCase().includes(term) ||
        node.type.toLowerCase().includes(term) ||
        node.description?.[lang].toLowerCase().includes(term)
    );
  }, [searchTerm, lang, effectiveNodeTypes]);

  const nodesByCategory = useMemo(() => {
    const grouped: Record<string, NodeType[]> = {};
    effectiveCategories.forEach(cat => {
      grouped[cat.id] = filteredNodes.filter(node => node.category === cat.id);
    });
    return grouped;
  }, [filteredNodes, effectiveCategories]);

  const hasResults = filteredNodes.length > 0;

  return (
    <motion.div
      className="absolute left-4 top-20 z-40 flex flex-col gap-2"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      onWheel={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="from-primary to-primary hover:from-primary/70 hover:to-primary shadow-primary/30 flex items-center gap-2 self-start rounded-lg bg-gradient-to-r px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all"
      >
        <Zap size={16} />
        {text.toggle}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="w-80 overflow-hidden rounded-xl border border-[#2d2d44] bg-[#1a1a2e] shadow-2xl"
            initial={{ scale: 0.95, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="border-b border-[#2d2d44] bg-[#16162a] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{text.title}</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 transition-colors hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">{text.subtitle}</p>
            </div>

            {/* Search */}
            <div className="border-b border-[#2d2d44] bg-[#16162a] p-3">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={text.search}
                  className="focus:border-primary focus:ring-primary/30 w-full rounded-lg border border-[#2d2d44] bg-[#0d0d1a] py-2.5 pl-9 pr-8 text-sm text-white placeholder-gray-500 transition-all focus:outline-none focus:ring-1"
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
                <div className="p-6 text-center text-sm text-gray-500">
                  {lang === 'en' ? 'No nodes found' : 'No se encontraron nodos'}
                </div>
              ) : searchTerm ? (
                <div className="p-2">
                  {filteredNodes.map(nodeType => (
                    <NodeItem
                      key={nodeType.type}
                      nodeType={nodeType}
                      lang={lang}
                      onDragStart={onNodeDragStart}
                    />
                  ))}
                </div>
              ) : (
                effectiveCategories.map(category => {
                  const nodes = nodesByCategory[category.id];
                  if (nodes.length === 0) return null;
                  const isExpanded = expandedCategories.includes(category.id);
                  const CategoryIcon = category.icon;

                  return (
                    <div key={category.id} className="border-b border-[#2d2d44] last:border-0">
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="group flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-[#22223a]"
                      >
                        <div className={`${category.color} transition-colors`}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                        <CategoryIcon size={16} className={category.color} />
                        <span className="flex-1 text-left text-sm font-medium text-gray-200">
                          {category.label[lang]}
                        </span>
                        <span className="rounded-full bg-[#2d2d44] px-2 py-0.5 text-xs text-gray-500">
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
                              {nodes.map(nodeType => (
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
  onDragStart,
}: {
  nodeType: NodeType;
  lang: 'en' | 'es';
  onDragStart: (nodeType: NodeType) => void;
}) {
  return (
    <motion.div
      draggable
      onDragStart={() => onDragStart(nodeType)}
      className="group mb-1.5 flex cursor-move items-center gap-3 rounded-lg border border-transparent bg-[#1a1a2e] px-3 py-2.5 transition-all last:mb-0 hover:border-[#3d3d5c] hover:bg-[#22223a]"
      whileHover={{ scale: 1.01, x: 2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        className={`h-9 w-9 ${nodeType.color} flex items-center justify-center rounded-lg text-white shadow-md`}
      >
        {nodeType.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-200 transition-colors group-hover:text-white">
          {nodeType.label[lang]}
        </div>
        {nodeType.description && (
          <div className="truncate text-xs text-gray-500">{nodeType.description[lang]}</div>
        )}
      </div>
      <div className="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
    </motion.div>
  );
}

export { CATEGORIES, NODE_TYPES };
