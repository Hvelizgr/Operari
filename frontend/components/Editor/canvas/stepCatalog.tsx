'use client';

// Data-only catalog: this file used to be `components/Node/NodePalette.tsx`
// — the V1 UI portion was stripped at the cutover and the data moved
// here under the V2 namespace. Icons that remain are referenced inside
// `NODE_TYPES` (rendered as JSX nodes) and `CATEGORIES` (passed by
// reference for downstream consumers like Navigation/SearchBar).
import {
  Bell,
  Clock,
  Database,
  Folder,
  GitBranch,
  Globe,
  KeyRound,
  Play,
  Repeat,
  Route,
  Square,
  StickyNote,
  Terminal,
  UserCheck,
  Webhook,
  Zap,
} from 'lucide-react';

import type { Property } from '@/components/Node/DynamicNodeForm';

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
export const CATEGORIES = [
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
export const NODE_TYPES: NodeType[] = [
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
