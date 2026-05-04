'use client';

// Data-only catalog: this file used to be `components/Node/NodePalette.tsx`
// — the V1 UI portion was stripped at the cutover and the data moved
// here under the V2 namespace. Icons that remain are referenced inside
// `NODE_TYPES` (rendered as JSX nodes) and `CATEGORIES` (passed by
// reference for downstream consumers like Navigation/SearchBar).
import {
  Anchor,
  Bell,
  Clock,
  Database,
  Download,
  Folder,
  GitBranch,
  Globe,
  KeyRound,
  Mail,
  Play,
  Repeat,
  Route,
  Split,
  Square,
  StickyNote,
  Terminal,
  Upload,
  UserCheck,
  Wand2,
  Webhook,
  Zap,
} from 'lucide-react';

import type { Property } from '@/components/Node/DynamicNodeForm';

/**
 * SRE-tailored visual metadata. Optional on every node — defaults to
 * neutral when missing. The visual treatment for each axis lives in
 * `globals.css` keyed off `data-blast-radius`, `data-idempotent`,
 * `data-secret-touch`. Centralized in `NODE_VISUAL_METADATA` below
 * (NOT inlined per type) so it stays one screen of data instead of
 * sprinkled across the seed.
 *
 * - `blastRadius` — what this step touches.
 *     `readonly`    — observation only (kubectl get, http GET, condition)
 *     `writes`      — modifies state but reversible (commit, notify, set)
 *     `destructive` — irreversible without recovery (drop, rm -rf, delete)
 * - `idempotent`   — running it twice has the same effect as once.
 *                    Affects retry safety. UI shows a loop icon.
 * - `touchesSecrets` — reads from the secrets vault. UI shows a key
 *                      icon so reviewers can spot secret surface area.
 */
export type BlastRadius = 'readonly' | 'writes' | 'destructive';

export interface NodeVisualMetadata {
  blastRadius?: BlastRadius;
  idempotent?: boolean;
  touchesSecrets?: boolean;
}

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

/**
 * Per-type visual metadata. Default to readonly/idempotent/no-secrets
 * when a key is absent. Separate from NODE_TYPES so it's easy to scan
 * the SRE story at a glance and tune without touching the catalog
 * shape. New step types can be added here lazily — anything missing
 * just gets neutral (readonly) styling.
 */
export const NODE_VISUAL_METADATA: Record<string, NodeVisualMetadata> = {
  shell: { blastRadius: 'destructive', idempotent: false, touchesSecrets: false },
  ssh: { blastRadius: 'destructive', idempotent: false, touchesSecrets: true },
  'operari.postgres': { blastRadius: 'writes', idempotent: false, touchesSecrets: true },
  'operari.database': { blastRadius: 'writes', idempotent: false, touchesSecrets: true },
  'operari.httpRequest': { blastRadius: 'writes', idempotent: false, touchesSecrets: true },
  'operari.webhook': { blastRadius: 'readonly', idempotent: true, touchesSecrets: false },
  'operari.cron': { blastRadius: 'readonly', idempotent: true, touchesSecrets: false },
  'operari.if': { blastRadius: 'readonly', idempotent: true, touchesSecrets: false },
  'operari.loop': { blastRadius: 'readonly', idempotent: true, touchesSecrets: false },
  wait: { blastRadius: 'readonly', idempotent: true, touchesSecrets: false },
  'github.commitFile': { blastRadius: 'writes', idempotent: true, touchesSecrets: true },
  notify: { blastRadius: 'writes', idempotent: false, touchesSecrets: true },
  runbook: { blastRadius: 'readonly', idempotent: false, touchesSecrets: false },
  approval: { blastRadius: 'readonly', idempotent: true, touchesSecrets: false },
  waitpoint: { blastRadius: 'readonly', idempotent: true, touchesSecrets: false },
  // Tier 0 promotions — legacy editor executors now exposed in palette.
  Transform: { blastRadius: 'readonly', idempotent: true, touchesSecrets: false },
  StoreGet: { blastRadius: 'readonly', idempotent: true, touchesSecrets: false },
  StoreSet: { blastRadius: 'writes', idempotent: false, touchesSecrets: false },
  Switch: { blastRadius: 'readonly', idempotent: true, touchesSecrets: false },
  Email: { blastRadius: 'writes', idempotent: false, touchesSecrets: false },
  // kubectl: marked destructive on purpose — `kubectl delete pod`,
  // `kubectl set image`, `apply -f -` all change cluster state in
  // ways no rollback button can undo. The amber/red ring at-a-glance
  // is the point. touchesSecrets=true since the kubeconfig usually
  // arrives via a connected-account secret.
  kubectl: { blastRadius: 'destructive', idempotent: false, touchesSecrets: true },
  // `custom.frame` and `custom.note` intentionally omitted — they're
  // visual-only nodes with no executor; metadata would be confusing.
};

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
    id: 'flow',
    label: { en: 'Flow control', es: 'Control de flujo' },
    icon: Route,
    color: 'text-amber-400',
  },
  {
    id: 'integrations',
    label: { en: 'Integrations', es: 'Integraciones' },
    icon: Globe,
    color: 'text-rose-400',
  },
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
        type: 'shell',
        default: 'echo "hello from operari"',
        typeOptions: { rows: 6 },
      },
      { name: 'cwd', displayName: 'Working directory', type: 'string', default: '' },
      {
        name: 'shell',
        displayName: 'Shell binary',
        type: 'string',
        default: 'sh',
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
        type: 'shell',
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
  // Sub-runbook composition. The backend dispatches `runbook` as
  // `RunbookExecutor` which loads another runbook, runs it (sync /
  // async, with optional inputs and timeout) and surfaces its output
  // as if it were a single step. Was previously missing from the
  // frontend palette — operators couldn't drag it onto the canvas
  // even though the executor + visual metadata were ready.
  {
    type: 'runbook',
    icon: <Route size={18} />,
    label: { en: 'Sub-runbook', es: 'Sub-runbook' },
    color: 'bg-fuchsia-600',
    category: 'devops',
    description: {
      en: 'Invoke another runbook as a child step. Pass inputs, wait for completion, surface its output.',
      es: 'Invocar otro runbook como sub-paso. Pasar inputs, esperar al final, exponer su output.',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        name: 'runbookId',
        displayName: 'Runbook to invoke',
        type: 'string',
        default: '',
        description: 'ID of the runbook to call. Use the slug or UUID from /runbooks.',
      },
      {
        name: 'inputs',
        displayName: 'Inputs (JSON)',
        type: 'string',
        default: '{}',
        typeOptions: { rows: 3 },
        description:
          "JSON object passed as the child runbook's input vars. Each value is template-resolved against the parent context, so {{vars.x}} works.",
      },
      {
        name: 'waitFor',
        displayName: 'Wait mode',
        type: 'options',
        default: 'sync',
        options: [
          { name: 'Wait for completion (sync)', value: 'sync' },
          { name: "Fire and don't wait (async)", value: 'async' },
        ],
        description:
          'Sync blocks the parent run until the child finishes; async dispatches it and continues.',
      },
      {
        name: 'timeoutSeconds',
        displayName: 'Timeout (seconds)',
        type: 'number',
        default: 300,
        description:
          'How long to wait in sync mode before failing the parent step. Ignored in async.',
      },
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
      {
        name: 'timeoutSeconds',
        displayName: 'Auto-reject after (seconds)',
        type: 'number',
        default: 0,
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
  {
    type: 'waitpoint',
    icon: <Anchor size={18} />,
    label: { en: 'Wait token', es: 'Token de espera' },
    color: 'bg-violet-600',
    category: 'devops',
    description: {
      en: 'Pause until an external system POSTs to a unique URL',
      es: 'Pausar hasta que un sistema externo haga POST a una URL única',
    },
    inputs: ['main'],
    outputs: ['completed', 'timed_out'],
    properties: [
      {
        name: 'message',
        displayName: 'Label (shown in operator dashboard)',
        type: 'string',
        default: '',
      },
      {
        name: 'timeoutSeconds',
        displayName: 'Auto-timeout after (seconds, 0 = wait forever)',
        type: 'number',
        default: 0,
      },
      {
        name: 'tags',
        displayName: 'Tags (comma-separated)',
        type: 'string',
        default: '',
      },
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
  // Switch was duplicated here when the legacy executors got promoted
  // to the palette — the canonical entry now lives in the FLOW category
  // below with `case_1/case_2/default` output port names that match
  // the seed and what the engine dispatches against. Keeping a second
  // entry under `core` would have shipped two visually-distinct nodes
  // mapped to the same backend type, confusing the operator about
  // which one to pick. Removed deliberately.
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
    outputs: ['iteration', 'done'],
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

  // === DEVOPS — kubectl native ===
  {
    type: 'kubectl',
    icon: <Anchor size={18} />,
    label: { en: 'kubectl', es: 'kubectl' },
    color: 'bg-blue-700',
    category: 'devops',
    description: {
      en: 'Run kubectl with kubeconfig from a connected account secret',
      es: 'Ejecutar kubectl con kubeconfig desde un secret de connected account',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        name: 'command',
        displayName: 'Command (after `kubectl`)',
        type: 'string',
        default: 'get pods',
      },
      { name: 'namespace', displayName: 'Namespace', type: 'string', default: '' },
      { name: 'context', displayName: 'Context', type: 'string', default: '' },
      {
        name: 'kubeconfigSecret',
        displayName: 'Kubeconfig secret',
        type: 'string',
        default: '',
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

  // === CORE — legacy editor executors promoted to palette ===
  {
    type: 'Transform',
    icon: <Wand2 size={18} />,
    label: { en: 'Transform', es: 'Transformar' },
    color: 'bg-violet-600',
    category: 'core',
    description: {
      en: 'Apply a key-mapping (JSON) over the previous step output',
      es: 'Aplicar un mapeo de claves (JSON) sobre el output del paso anterior',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      // The post-pivot Transform executor only honors `mapping` —
      // arbitrary JS evaluation was dropped to remove the eval()
      // surface area. Listing `code` here would be a footgun: the
      // operator fills it in, the executor silently ignores it, and
      // the runbook produces unexpected outputs.
      { name: 'mapping', displayName: 'Mapping (JSON)', type: 'string', default: '' },
    ],
  },
  {
    type: 'StoreGet',
    icon: <Download size={18} />,
    label: { en: 'Store: get', es: 'Store: obtener' },
    color: 'bg-slate-600',
    category: 'core',
    description: {
      en: 'Read a value from the per-tenant key-value scratch store',
      es: 'Leer un valor del KV scratch per-tenant',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      { name: 'bucketName', displayName: 'Bucket', type: 'string', default: 'default' },
      { name: 'key', displayName: 'Key', type: 'string', default: '' },
    ],
  },
  {
    type: 'StoreSet',
    icon: <Upload size={18} />,
    label: { en: 'Store: set', es: 'Store: guardar' },
    color: 'bg-slate-600',
    category: 'core',
    description: {
      en: 'Write a value to the per-tenant key-value scratch store',
      es: 'Escribir un valor al KV scratch per-tenant',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      { name: 'bucketName', displayName: 'Bucket', type: 'string', default: 'default' },
      { name: 'key', displayName: 'Key', type: 'string', default: '' },
      { name: 'value', displayName: 'Value', type: 'string', default: '' },
    ],
  },

  // === FLOW — Switch (multi-output) ===
  {
    type: 'Switch',
    icon: <Split size={18} />,
    label: { en: 'Switch', es: 'Switch' },
    color: 'bg-amber-600',
    category: 'flow',
    description: {
      en: 'N-way branch on a field value. Each case routes to its own output port.',
      es: 'Branch de N caminos sobre un campo. Cada case rutea a su propio output.',
    },
    inputs: ['main'],
    outputs: ['case_1', 'case_2', 'default'],
    properties: [
      { name: 'field', displayName: 'Field path', type: 'string', default: 'input.status' },
      { name: 'cases', displayName: 'Cases (JSON)', type: 'string', default: '[]' },
    ],
  },

  // === INTEGRATIONS — Email ===
  {
    type: 'Email',
    icon: <Mail size={18} />,
    label: { en: 'Email', es: 'Correo' },
    color: 'bg-rose-600',
    category: 'integrations',
    description: {
      en: 'Send an email via the configured SMTP transporter',
      es: 'Enviar email vía el SMTP configurado',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      { name: 'to', displayName: 'To', type: 'string', default: '' },
      { name: 'subject', displayName: 'Subject', type: 'string', default: '' },
      { name: 'body', displayName: 'Body (text)', type: 'string', default: '' },
      { name: 'html', displayName: 'Body (HTML)', type: 'string', default: '' },
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
