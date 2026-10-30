const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Operari curated node catalog.
 *
 * Plain CommonJS so it runs under `node prisma/seed-nodes.js` without
 * any TypeScript / ts-node / tsx machinery — the previous .ts version
 * required hooking ts-node from a deeply nested location which broke
 * under Node 20's ESM-default loading. The seed is data + a single
 * upsert loop, so the type information was nice-to-have but not
 * load-bearing.
 *
 * The catalog is the runbook-relevant subset of step types — the
 * same ~20 nodes the editor's NodePalette renders. The previous
 * Operari seed had 70+ n8n-era nodes (Google Sheets, Mailchimp,
 * Twitter, LangChain, etc.) which were dropped during the post-pivot
 * cleanup.
 *
 * Type-string convention: every step type uses the canonical
 * `operari.*` prefix (post pivot rename, see migration
 * 20260407170000_rename_n8n_node_types). A handful of executor
 * types — `shell`, `wait`, `notify`, `approval`, `agent`, plus the
 * `custom.frame` and `custom.note` organisation nodes — predate the
 * prefix scheme and stay unprefixed because the dispatcher matches
 * them by exact string.
 */

const MAIN_PORT = { name: 'main', type: 'main' };

// Curated to ONLY the step types that have a real executor today.
// Vapor entries (github / docker / awsS3 / set / switch / errorTrigger /
// agent) were removed in the connection-dispatch fix — having them in
// the palette without an executor produced "Unknown node type" the
// moment an operator tried to run them. They come back when their
// executors land.
const NODES = [
  // === devops ===
  {
    type: 'shell',
    category: 'devops',
    icon: 'Terminal',
    color: 'bg-zinc-700',
    label: { en: 'Shell command', es: 'Comando shell' },
    description: {
      en: 'Run kubectl, aws, helm, bash inside a sandboxed runner',
      es: 'Ejecutar kubectl, aws, helm, bash en un runner aislado',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'command',
        displayName: 'Command',
        type: 'string',
        description: 'Shell command to run. Supports {{vars.x}} templates.',
        typeOptions: { rows: 6, expression: true },
      },
      {
        name: 'cwd',
        displayName: 'Working directory',
        type: 'string',
        description: 'Optional. Defaults to the runner sandbox root.',
      },
      {
        name: 'shell',
        displayName: 'Shell binary',
        type: 'string',
        default: 'sh',
        description: 'sh, bash, zsh — must exist in the runner image.',
      },
      {
        name: 'timeout',
        displayName: 'Timeout (ms)',
        type: 'number',
        default: 60000,
        description: 'Hard kill if the command runs longer than this.',
      },
      {
        name: 'failOnNonZeroExit',
        displayName: 'Fail on non-zero exit',
        type: 'boolean',
        default: true,
        description: 'Off → step succeeds and exits go into output.exitCode.',
      },
      {
        name: 'image',
        displayName: 'Runner image (docker / fly only)',
        type: 'string',
        description: 'Override the default runner image for this step.',
      },
    ],
  },
  {
    type: 'operari.database',
    category: 'devops',
    icon: 'Database',
    color: 'bg-blue-400',
    label: { en: 'Postgres (migrate)', es: 'Postgres (migrate)' },
    description: {
      en: 'Health check, schema introspection or a read-only query against Postgres',
      es: 'Health check, introspección del esquema o una consulta de solo lectura contra Postgres',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        default: 'health',
        description: 'introspect = list tables; health = SELECT 1; query = read-only SQL.',
        options: [
          { name: 'Health check', value: 'health' },
          { name: 'Introspect schema', value: 'introspect' },
          { name: 'Read-only query', value: 'query' },
        ],
      },
      {
        name: 'credentialId',
        displayName: 'Postgres credential',
        type: 'secret',
        description: 'ConnectedAccount id for the Postgres DSN.',
        typeOptions: { provider: 'postgres' },
      },
      {
        name: 'query',
        displayName: 'SQL query',
        type: 'sql',
        description: 'Only used when operation = query. Read-only enforced.',
        typeOptions: { rows: 6 },
      },
      {
        name: 'timeout',
        displayName: 'Timeout (ms)',
        type: 'number',
        default: 30000,
      },
    ],
  },

  // === triggers ===
  {
    type: 'operari.webhook',
    category: 'triggers',
    icon: 'Webhook',
    color: 'bg-green-500',
    label: { en: 'Webhook', es: 'Webhook' },
    description: {
      en: 'Trigger from an external HTTP call (Sentry, Datadog, GitHub)',
      es: 'Disparar desde una llamada HTTP externa (Sentry, Datadog, GitHub)',
    },
    inputs: [],
    outputs: [MAIN_PORT],
  },
  {
    type: 'operari.cron',
    category: 'triggers',
    icon: 'Clock',
    color: 'bg-green-500',
    label: { en: 'Schedule', es: 'Programación' },
    description: { en: 'Run on a cron schedule', es: 'Ejecutar según un cron' },
    inputs: [],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'schedule',
        displayName: 'Cron expression',
        type: 'string',
        description: '5-field standard cron, e.g. "*/15 * * * *" for every 15 minutes.',
      },
    ],
  },

  // === core ===
  {
    type: 'operari.httpRequest',
    category: 'core',
    icon: 'Globe',
    color: 'bg-indigo-500',
    label: { en: 'HTTP request', es: 'Petición HTTP' },
    description: { en: 'Call any HTTP API', es: 'Llamar a cualquier API HTTP' },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'method',
        displayName: 'Method',
        type: 'options',
        default: 'GET',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'DELETE', value: 'DELETE' },
          { name: 'HEAD', value: 'HEAD' },
        ],
      },
      {
        name: 'url',
        displayName: 'URL',
        type: 'string',
        description: 'Supports {{vars.x}} and {{secrets.y}} templates.',
        typeOptions: { expression: true },
      },
      {
        name: 'headers',
        displayName: 'Headers (JSON)',
        type: 'string',
        description: 'JSON object, e.g. {"Authorization": "Bearer {{secrets.<id>}}"}.',
        typeOptions: { rows: 3, expression: true },
      },
      {
        name: 'body',
        displayName: 'Body',
        type: 'string',
        description: 'Request body. Empty for GET/HEAD.',
        typeOptions: { rows: 6, expression: true },
      },
      {
        name: 'timeout',
        displayName: 'Timeout (ms)',
        type: 'number',
        default: 30000,
      },
      {
        name: 'followRedirects',
        displayName: 'Follow redirects',
        type: 'boolean',
        default: true,
      },
      {
        name: 'failOnNon2xx',
        displayName: 'Fail on non-2xx',
        type: 'boolean',
        default: true,
        description: 'Off → response captured into output, step succeeds.',
      },
    ],
  },
  {
    type: 'operari.if',
    category: 'core',
    icon: 'GitBranch',
    color: 'bg-yellow-500',
    label: { en: 'If', es: 'If' },
    description: {
      en: 'Branch on a declarative condition',
      es: 'Bifurcar según una condición declarativa',
    },
    inputs: [MAIN_PORT],
    outputs: [
      { name: 'true', type: 'main' },
      { name: 'false', type: 'main' },
    ],
    properties: [
      {
        name: 'condition',
        displayName: 'Condition',
        type: 'string',
        description:
          'Template expression, e.g. {{steps.check.output.exitCode}}. Empty, false, 0, no or null route through "false"; anything else through "true".',
        typeOptions: { expression: true },
      },
    ],
  },

  // === flow ===
  {
    type: 'operari.loop',
    category: 'flow',
    icon: 'RefreshCw',
    color: 'bg-yellow-500',
    label: { en: 'Loop / Iterate', es: 'Loop / Iterar' },
    description: {
      en: 'Iterate over a list or retry N times',
      es: 'Iterar una lista o reintentar N veces',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'items',
        displayName: 'Items expression',
        type: 'string',
        description:
          'Template expression that resolves to an array. The downstream branch fires once per item.',
        typeOptions: { expression: true },
      },
    ],
  },
  {
    type: 'wait',
    category: 'flow',
    icon: 'Clock',
    color: 'bg-amber-500',
    label: { en: 'Wait', es: 'Esperar' },
    description: { en: 'Pause for a fixed duration', es: 'Pausar por una duración fija' },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'durationMs',
        displayName: 'Duration (ms)',
        type: 'number',
        default: 1000,
        description: 'Up to 600000 (10 min). Longer pauses belong in approval gates.',
      },
    ],
  },

  // === integrations ===
  {
    type: 'github.commitFile',
    category: 'integrations',
    icon: 'FileCode',
    color: 'bg-zinc-700',
    label: { en: 'GitHub: commit file', es: 'GitHub: commit de archivo' },
    description: {
      en: 'Commit a single file to a branch via the GitHub Contents API. Auth via ConnectedAccount (provider=github).',
      es: 'Commit de un archivo a una rama vía la GitHub Contents API. Auth con ConnectedAccount (provider=github).',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'repo',
        displayName: 'Repository',
        type: 'string',
        description: 'owner/name format, e.g. "Hvelizgr/operari".',
      },
      {
        name: 'branch',
        displayName: 'Branch',
        type: 'string',
        default: 'main',
      },
      {
        name: 'path',
        displayName: 'File path',
        type: 'string',
        description: 'Path inside the repo, no leading slash.',
      },
      {
        name: 'content',
        displayName: 'File content',
        type: 'string',
        description: 'Plain UTF-8. Supports {{vars.x}} templates.',
        typeOptions: { rows: 8, expression: true },
      },
      {
        name: 'message',
        displayName: 'Commit message',
        type: 'string',
        typeOptions: { expression: true },
      },
      {
        name: 'credentialId',
        displayName: 'GitHub credential',
        type: 'secret',
        description: 'ConnectedAccount id for a GitHub PAT with repo scope.',
        typeOptions: { provider: 'github' },
      },
      {
        name: 'committerName',
        displayName: 'Committer name',
        type: 'string',
        description: 'Optional. Defaults to the PAT owner.',
      },
      {
        name: 'committerEmail',
        displayName: 'Committer email',
        type: 'string',
      },
      {
        name: 'requireExisting',
        displayName: 'Require existing file',
        type: 'boolean',
        default: false,
        description: 'On → fail if the path does not already exist.',
      },
      {
        name: 'timeout',
        displayName: 'Timeout (ms)',
        type: 'number',
        default: 30000,
      },
    ],
  },
  {
    type: 'notify',
    category: 'integrations',
    icon: 'Bell',
    color: 'bg-pink-500',
    label: { en: 'Notify', es: 'Notificar' },
    description: {
      en: 'Send a Slack/Discord notification (Slack-aware error handling, retry on 429)',
      es: 'Enviar una notificación Slack/Discord (con error handling y retry 429)',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'channel',
        displayName: 'Channel',
        type: 'options',
        default: 'slack',
        options: [
          { name: 'Slack', value: 'slack' },
          { name: 'Discord', value: 'discord' },
          { name: 'Generic webhook', value: 'webhook' },
        ],
      },
      {
        name: 'webhookUrl',
        displayName: 'Webhook URL',
        type: 'string',
        description: 'Use {{secrets.<connected-account-id>}} to reference a stored secret.',
        typeOptions: { expression: true },
      },
      {
        name: 'title',
        displayName: 'Title',
        type: 'string',
        typeOptions: { expression: true },
      },
      {
        name: 'message',
        displayName: 'Message',
        type: 'string',
        typeOptions: { rows: 4, expression: true },
      },
      {
        name: 'color',
        displayName: 'Color',
        type: 'options',
        default: 'good',
        description: 'Slack-style severity. Hex codes also accepted by Slack.',
        options: [
          { name: 'Good (green)', value: 'good' },
          { name: 'Warning (amber)', value: 'warning' },
          { name: 'Danger (red)', value: 'danger' },
        ],
      },
    ],
  },

  {
    type: 'runbook',
    category: 'orchestration',
    icon: 'GitBranch',
    color: 'bg-indigo-500',
    label: { en: 'Sub-runbook', es: 'Sub-runbook' },
    description: {
      en: 'Invoke another runbook as a step. Waits for completion by default.',
      es: 'Ejecutá otro runbook como un paso. Espera a que termine por default.',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'runbookId',
        displayName: 'Runbook id or slug',
        type: 'string',
        description: 'The runbook this step should call. Tenant-scoped.',
      },
    ],
  },

  // === organization ===
  {
    type: 'approval',
    category: 'organization',
    icon: 'CheckCircle',
    color: 'bg-emerald-500',
    label: { en: 'Approval gate', es: 'Aprobación' },
    description: {
      en: 'Pause until a human approves the next step',
      es: 'Pausar hasta que un humano apruebe el siguiente paso',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'message',
        displayName: 'Approval prompt',
        type: 'string',
        description: 'Shown to the approver. Supports {{vars.x}} and {{steps.id.output.y}}.',
        typeOptions: { rows: 5, expression: true },
      },
      {
        name: 'timeoutSeconds',
        displayName: 'Timeout (seconds)',
        type: 'number',
        description: 'Optional. After this many seconds the approval auto-rejects.',
      },
    ],
  },
  {
    type: 'custom.frame',
    category: 'organization',
    icon: 'Square',
    color: 'bg-slate-500',
    label: { en: 'Section', es: 'Sección' },
    description: {
      en: 'Group related steps visually',
      es: 'Agrupar pasos relacionados visualmente',
    },
    inputs: [],
    outputs: [],
  },
  {
    type: 'custom.note',
    category: 'organization',
    icon: 'StickyNote',
    color: 'bg-amber-300',
    label: { en: 'Note', es: 'Nota' },
    description: {
      en: 'Add an inline annotation (non-executable)',
      es: 'Añadir una anotación inline (no ejecutable)',
    },
    inputs: [],
    outputs: [],
  },
  // --- Added to sync seed with executor registry + palette ---
  {
    type: 'ssh',
    category: 'devops',
    icon: 'KeyRound',
    color: 'bg-cyan-600',
    label: { en: 'SSH command', es: 'Comando SSH' },
    description: {
      en: 'Run a command on a remote host via SSH',
      es: 'Ejecutar comando en host remoto vía SSH',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      { name: 'host', displayName: 'Host', type: 'string', description: 'IP or hostname.' },
      { name: 'port', displayName: 'Port', type: 'number', default: 22 },
      { name: 'username', displayName: 'Username', type: 'string', default: 'deploy' },
      {
        name: 'credentialId',
        displayName: 'SSH private key',
        type: 'secret',
        typeOptions: { provider: 'ssh' },
      },
      { name: 'command', displayName: 'Command', type: 'string', typeOptions: { rows: 3 } },
      { name: 'timeout', displayName: 'Timeout (ms)', type: 'number', default: 60000 },
    ],
  },
  {
    type: 'operari.switch',
    category: 'core',
    icon: 'Route',
    color: 'bg-yellow-500',
    label: { en: 'Switch', es: 'Switch' },
    description: {
      en: 'Multi-way branch by matching a field against cases',
      es: 'Bifurcación múltiple comparando un campo contra casos',
    },
    inputs: [MAIN_PORT],
    outputs: [
      { name: 'case 0', type: 'main' },
      { name: 'case 1', type: 'main' },
      { name: 'default', type: 'main' },
    ],
    properties: [
      { name: 'field', displayName: 'Field', type: 'string', typeOptions: { expression: true } },
      {
        name: 'cases',
        displayName: 'Cases (JSON array)',
        type: 'string',
        description:
          'e.g. ["staging", "prod"] or [{"value": "prod", "label": "Prod"}]. Each case gets its own output, plus "default" when nothing matches.',
        typeOptions: { rows: 3 },
      },
    ],
  },
  // === integrations modelled on n8n's incident-response nodes ===
  {
    type: 'pagerduty.event',
    category: 'integrations',
    icon: 'Siren',
    color: 'bg-green-700',
    label: { en: 'PagerDuty', es: 'PagerDuty' },
    description: {
      en: 'Trigger, acknowledge or resolve an incident (Events API v2)',
      es: 'Abrir, reconocer o resolver un incidente (Events API v2)',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'trigger',
        options: [
          { name: 'Trigger', value: 'trigger' },
          { name: 'Acknowledge', value: 'acknowledge' },
          { name: 'Resolve', value: 'resolve' },
        ],
      },
      {
        name: 'routingKey',
        displayName: 'Integration key',
        type: 'secret',
        description: 'Events API v2 routing key of the PagerDuty service.',
      },
      {
        name: 'summary',
        displayName: 'Summary',
        type: 'string',
        typeOptions: { expression: true },
      },
      { name: 'source', displayName: 'Source', type: 'string', default: 'operari' },
      {
        name: 'severity',
        displayName: 'Severity',
        type: 'options',
        default: 'error',
        options: [
          { name: 'Critical', value: 'critical' },
          { name: 'Error', value: 'error' },
          { name: 'Warning', value: 'warning' },
          { name: 'Info', value: 'info' },
        ],
      },
      {
        name: 'dedupKey',
        displayName: 'Dedup key',
        type: 'string',
        description: 'Required to acknowledge or resolve. Reuse {{steps.<id>.output.dedupKey}}.',
        typeOptions: { expression: true },
      },
    ],
  },
  {
    type: 'opsgenie.alert',
    category: 'integrations',
    icon: 'BellRing',
    color: 'bg-blue-600',
    label: { en: 'Opsgenie', es: 'Opsgenie' },
    description: { en: 'Create or close an alert', es: 'Crear o cerrar una alerta' },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'create',
        options: [
          { name: 'Create alert', value: 'create' },
          { name: 'Close alert', value: 'close' },
        ],
      },
      { name: 'apiKey', displayName: 'API key', type: 'secret' },
      {
        name: 'region',
        displayName: 'Region',
        type: 'options',
        default: 'us',
        options: [
          { name: 'US', value: 'us' },
          { name: 'EU', value: 'eu' },
        ],
      },
      {
        name: 'message',
        displayName: 'Message',
        type: 'string',
        typeOptions: { expression: true },
      },
      {
        name: 'alias',
        displayName: 'Alias',
        type: 'string',
        description: 'Stable id. Required to close; dedupes on create.',
        typeOptions: { expression: true },
      },
      {
        name: 'description',
        displayName: 'Description',
        type: 'string',
        typeOptions: { rows: 4, expression: true },
      },
      {
        name: 'priority',
        displayName: 'Priority',
        type: 'options',
        default: 'P3',
        options: ['P1', 'P2', 'P3', 'P4', 'P5'].map(v => ({ name: v, value: v })),
      },
      { name: 'tags', displayName: 'Tags', type: 'string', description: 'Comma-separated.' },
    ],
  },
  {
    type: 'jira.issue',
    category: 'integrations',
    icon: 'Ticket',
    color: 'bg-blue-700',
    label: { en: 'Jira', es: 'Jira' },
    description: {
      en: 'Open an incident ticket, comment on it or transition it',
      es: 'Abrir un ticket de incidente, comentarlo o moverlo de estado',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'create',
        options: [
          { name: 'Create issue', value: 'create' },
          { name: 'Add comment', value: 'comment' },
          { name: 'Transition issue', value: 'transition' },
        ],
      },
      {
        name: 'baseUrl',
        displayName: 'Site URL',
        type: 'string',
        description: 'e.g. https://acme.atlassian.net',
      },
      { name: 'email', displayName: 'Account email', type: 'string' },
      { name: 'apiToken', displayName: 'API token', type: 'secret' },
      { name: 'projectKey', displayName: 'Project key', type: 'string', description: 'e.g. OPS' },
      { name: 'issueType', displayName: 'Issue type', type: 'string', default: 'Task' },
      {
        name: 'summary',
        displayName: 'Summary',
        type: 'string',
        typeOptions: { expression: true },
      },
      {
        name: 'description',
        displayName: 'Description',
        type: 'string',
        typeOptions: { rows: 5, expression: true },
      },
      { name: 'labels', displayName: 'Labels', type: 'string', description: 'Comma-separated.' },
      {
        name: 'issueKey',
        displayName: 'Issue key',
        type: 'string',
        description: 'For comment / transition, e.g. OPS-123 or {{steps.<id>.output.key}}.',
        typeOptions: { expression: true },
      },
      {
        name: 'comment',
        displayName: 'Comment',
        type: 'string',
        typeOptions: { rows: 4, expression: true },
      },
      { name: 'transitionId', displayName: 'Transition id', type: 'string' },
    ],
  },
  {
    type: 'github.issue',
    category: 'integrations',
    icon: 'CircleDot',
    color: 'bg-zinc-700',
    label: { en: 'GitHub: issue', es: 'GitHub: issue' },
    description: {
      en: 'Create, comment on or close an issue',
      es: 'Crear, comentar o cerrar un issue',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'create',
        options: [
          { name: 'Create issue', value: 'create' },
          { name: 'Add comment', value: 'comment' },
          { name: 'Close issue', value: 'close' },
        ],
      },
      {
        name: 'token',
        displayName: 'GitHub token',
        type: 'secret',
        typeOptions: { provider: 'github' },
      },
      { name: 'owner', displayName: 'Owner', type: 'string' },
      { name: 'repo', displayName: 'Repository', type: 'string' },
      { name: 'title', displayName: 'Title', type: 'string', typeOptions: { expression: true } },
      {
        name: 'body',
        displayName: 'Body / comment',
        type: 'string',
        typeOptions: { rows: 5, expression: true },
      },
      { name: 'labels', displayName: 'Labels', type: 'string', description: 'Comma-separated.' },
      {
        name: 'issueNumber',
        displayName: 'Issue number',
        type: 'string',
        description: 'For comment / close.',
        typeOptions: { expression: true },
      },
    ],
  },
  {
    type: 'teams.message',
    category: 'integrations',
    icon: 'MessagesSquare',
    color: 'bg-indigo-600',
    label: { en: 'Microsoft Teams', es: 'Microsoft Teams' },
    description: {
      en: 'Post a card to a channel through a Workflows webhook',
      es: 'Publicar una tarjeta en un canal vía webhook de Workflows',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      { name: 'webhookUrl', displayName: 'Webhook URL', type: 'secret' },
      { name: 'title', displayName: 'Title', type: 'string', typeOptions: { expression: true } },
      {
        name: 'text',
        displayName: 'Message',
        type: 'string',
        typeOptions: { rows: 4, expression: true },
      },
    ],
  },
  {
    type: 'telegram.message',
    category: 'integrations',
    icon: 'Send',
    color: 'bg-sky-500',
    label: { en: 'Telegram', es: 'Telegram' },
    description: { en: 'Send a message with a bot', es: 'Enviar un mensaje con un bot' },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      { name: 'botToken', displayName: 'Bot token', type: 'secret' },
      { name: 'chatId', displayName: 'Chat id', type: 'string' },
      {
        name: 'text',
        displayName: 'Message',
        type: 'string',
        typeOptions: { rows: 4, expression: true },
      },
      {
        name: 'parseMode',
        displayName: 'Formatting',
        type: 'options',
        default: 'none',
        options: [
          { name: 'Plain text', value: 'none' },
          { name: 'Markdown', value: 'Markdown' },
          { name: 'HTML', value: 'HTML' },
        ],
      },
      { name: 'disableNotification', displayName: 'Silent', type: 'boolean', default: false },
    ],
  },
  {
    type: 'email.send',
    category: 'integrations',
    icon: 'Mail',
    color: 'bg-rose-600',
    label: { en: 'Send email', es: 'Enviar email' },
    description: { en: 'Send an email over SMTP', es: 'Enviar un email por SMTP' },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'smtpUrl',
        displayName: 'SMTP URL',
        type: 'secret',
        description: 'smtps://user:pass@host:465. Empty uses the server SMTP_* settings.',
      },
      {
        name: 'from',
        displayName: 'From',
        type: 'string',
        description:
          'Only used with your own SMTP URL; the platform server always sends as itself.',
      },
      {
        name: 'to',
        displayName: 'To',
        type: 'string',
        description: 'Comma-separated.',
        typeOptions: { expression: true },
      },
      {
        name: 'subject',
        displayName: 'Subject',
        type: 'string',
        typeOptions: { expression: true },
      },
      {
        name: 'body',
        displayName: 'Body',
        type: 'string',
        typeOptions: { rows: 6, expression: true },
      },
    ],
  },
  {
    type: 'datadog.event',
    category: 'integrations',
    icon: 'Activity',
    color: 'bg-purple-600',
    label: { en: 'Datadog event', es: 'Evento de Datadog' },
    description: {
      en: 'Mark what the runbook did on the Datadog event stream',
      es: 'Marcar lo que hizo el runbook en el event stream de Datadog',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'apiKey',
        displayName: 'API key',
        type: 'secret',
        typeOptions: { provider: 'datadog' },
      },
      { name: 'site', displayName: 'Site', type: 'string', default: 'datadoghq.com' },
      { name: 'title', displayName: 'Title', type: 'string', typeOptions: { expression: true } },
      {
        name: 'text',
        displayName: 'Text',
        type: 'string',
        typeOptions: { rows: 4, expression: true },
      },
      {
        name: 'alertType',
        displayName: 'Type',
        type: 'options',
        default: 'info',
        options: [
          { name: 'Info', value: 'info' },
          { name: 'Success', value: 'success' },
          { name: 'Warning', value: 'warning' },
          { name: 'Error', value: 'error' },
        ],
      },
      {
        name: 'tags',
        displayName: 'Tags',
        type: 'string',
        description: 'e.g. service:checkout,env:prod',
      },
    ],
  },
  {
    type: 'grafana.annotation',
    category: 'integrations',
    icon: 'Gauge',
    color: 'bg-orange-600',
    label: { en: 'Grafana annotation', es: 'Anotación de Grafana' },
    description: {
      en: 'Annotate dashboards with the remediation',
      es: 'Anotar dashboards con la remediación',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      { name: 'baseUrl', displayName: 'Grafana URL', type: 'string' },
      { name: 'apiToken', displayName: 'Service account token', type: 'secret' },
      {
        name: 'text',
        displayName: 'Text',
        type: 'string',
        typeOptions: { rows: 3, expression: true },
      },
      { name: 'tags', displayName: 'Tags', type: 'string', description: 'Comma-separated.' },
      {
        name: 'dashboardUid',
        displayName: 'Dashboard UID',
        type: 'string',
        description: 'Empty = organization-wide annotation.',
      },
    ],
  },
  {
    type: 'operari.redis',
    category: 'integrations',
    icon: 'Server',
    color: 'bg-red-600',
    label: { en: 'Redis', es: 'Redis' },
    description: {
      en: 'Get, set or delete keys, bump counters, publish to a channel',
      es: 'Leer, escribir o borrar claves, incrementar contadores, publicar en un canal',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'url',
        displayName: 'Redis URL',
        type: 'secret',
        description: 'redis://user:pass@host:6379/0',
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        default: 'get',
        options: [
          { name: 'Get', value: 'get' },
          { name: 'Set', value: 'set' },
          { name: 'Delete', value: 'del' },
          { name: 'Increment', value: 'incr' },
          { name: 'Expire', value: 'expire' },
          { name: 'Publish', value: 'publish' },
        ],
      },
      { name: 'key', displayName: 'Key', type: 'string', typeOptions: { expression: true } },
      { name: 'value', displayName: 'Value', type: 'string', typeOptions: { expression: true } },
      { name: 'ttl', displayName: 'TTL (seconds)', type: 'number', default: 0 },
      { name: 'channel', displayName: 'Channel', type: 'string', description: 'For publish.' },
    ],
  },

  // === data steps modelled on n8n's core nodes ===
  {
    type: 'operari.set',
    category: 'core',
    icon: 'PenLine',
    color: 'bg-teal-600',
    label: { en: 'Edit fields (Set)', es: 'Editar campos (Set)' },
    description: {
      en: 'Name values once; later steps read {{steps.<id>.output.<field>}}',
      es: 'Nombrar valores una vez; los pasos siguientes leen {{steps.<id>.output.<campo>}}',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'fields',
        displayName: 'Fields (JSON)',
        type: 'string',
        default: '{\n  "service": "{{vars.service}}"\n}',
        typeOptions: { rows: 6, expression: true },
      },
    ],
  },
  {
    type: 'operari.crypto',
    category: 'core',
    icon: 'Fingerprint',
    color: 'bg-teal-700',
    label: { en: 'Crypto', es: 'Crypto' },
    description: {
      en: 'Hash, HMAC-sign, UUIDs and random tokens',
      es: 'Hash, firma HMAC, UUIDs y tokens aleatorios',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'hash',
        options: [
          { name: 'Hash', value: 'hash' },
          { name: 'HMAC', value: 'hmac' },
          { name: 'UUID', value: 'uuid' },
          { name: 'Random token', value: 'random' },
        ],
      },
      {
        name: 'algorithm',
        displayName: 'Algorithm',
        type: 'options',
        default: 'sha256',
        options: [
          { name: 'SHA-256', value: 'sha256' },
          { name: 'SHA-512', value: 'sha512' },
          { name: 'SHA-1', value: 'sha1' },
          { name: 'MD5', value: 'md5' },
        ],
      },
      { name: 'value', displayName: 'Value', type: 'string', typeOptions: { expression: true } },
      { name: 'secret', displayName: 'HMAC secret', type: 'secret' },
      {
        name: 'encoding',
        displayName: 'Encoding',
        type: 'options',
        default: 'hex',
        options: [
          { name: 'Hex', value: 'hex' },
          { name: 'Base64', value: 'base64' },
        ],
      },
      { name: 'length', displayName: 'Random bytes', type: 'number', default: 32 },
    ],
  },
  {
    type: 'operari.dateTime',
    category: 'core',
    icon: 'CalendarClock',
    color: 'bg-teal-600',
    label: { en: 'Date & time', es: 'Fecha y hora' },
    description: {
      en: 'Now, time windows ("now minus 15m") and durations',
      es: 'Ahora, ventanas de tiempo ("ahora menos 15m") y duraciones',
    },
    inputs: [MAIN_PORT],
    outputs: [MAIN_PORT],
    properties: [
      {
        name: 'action',
        displayName: 'Action',
        type: 'options',
        default: 'now',
        options: [
          { name: 'Now', value: 'now' },
          { name: 'Add', value: 'add' },
          { name: 'Subtract', value: 'subtract' },
          { name: 'Difference', value: 'diff' },
        ],
      },
      {
        name: 'date',
        displayName: 'Date',
        type: 'string',
        description: 'ISO date or unix seconds. Empty = now.',
        typeOptions: { expression: true },
      },
      {
        name: 'amount',
        displayName: 'Amount',
        type: 'number',
        description: 'How many units to add or subtract.',
      },
      {
        name: 'unit',
        displayName: 'Unit',
        type: 'options',
        default: 'minutes',
        options: [
          { name: 'Seconds', value: 'seconds' },
          { name: 'Minutes', value: 'minutes' },
          { name: 'Hours', value: 'hours' },
          { name: 'Days', value: 'days' },
        ],
      },
      {
        name: 'compareTo',
        displayName: 'Compare to',
        type: 'string',
        description: 'Second date for Difference.',
        typeOptions: { expression: true },
      },
      { name: 'timezone', displayName: 'Timezone', type: 'string', default: 'UTC' },
    ],
  },
  {
    type: 'operari.stopAndError',
    category: 'core',
    icon: 'OctagonX',
    color: 'bg-red-700',
    label: { en: 'Stop and error', es: 'Detener con error' },
    description: {
      en: 'Fail the run on purpose with a message',
      es: 'Hacer fallar el run a propósito con un mensaje',
    },
    inputs: [MAIN_PORT],
    outputs: [],
    properties: [
      {
        name: 'message',
        displayName: 'Error message',
        type: 'string',
        typeOptions: { expression: true },
      },
    ],
  },
];

async function main() {
  console.log(`Seeding ${NODES.length} runbook node types...`);
  for (const node of NODES) {
    // properties drives the auto-generated config form in the editor's
    // PropertiesPanel. Default to an empty array so visual-only nodes
    // (custom.frame, custom.note) and nodes that intentionally have
    // no config (operari.webhook) round-trip cleanly.
    const properties = node.properties ?? [];
    // Hand-rolled upsert: Prisma rejects `null` inside a compound
    // whereUniqueInput, so we look up the existing global row first
    // and dispatch update vs create. The partial unique index from
    // migration 20260430000000_node_type_tenant_scoped_unique
    // guarantees at most one global per type even if a parallel
    // seed run races between findFirst and create.
    const data = {
      category: node.category,
      icon: node.icon,
      color: node.color,
      label: node.label,
      description: node.description,
      inputs: node.inputs,
      outputs: node.outputs,
      properties,
    };
    const existing = await prisma.nodeType.findFirst({
      where: { type: node.type, tenantId: null },
      select: { id: true },
    });
    if (existing) {
      await prisma.nodeType.update({ where: { id: existing.id }, data });
    } else {
      await prisma.nodeType.create({ data: { type: node.type, tenantId: null, ...data } });
    }
  }
  console.log('Node types seeded.');
}

// Export the catalog so tests + tooling can pin the shape without
// re-parsing the seed file. Guarded by `require.main === module` so
// importing this file from a test does not connect to Postgres or
// run the seed loop.
module.exports = { NODES };

if (require.main === module) {
  main()
    .catch(e => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
