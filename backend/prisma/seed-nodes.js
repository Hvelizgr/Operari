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
    type: 'operari.postgres',
    category: 'devops',
    icon: 'Database',
    color: 'bg-blue-400',
    label: { en: 'Postgres (migrate)', es: 'Postgres (migrate)' },
    description: {
      en: 'Run a versioned migration / health probe against Postgres (stub — wire prisma to make it active)',
      es: 'Migración versionada o health probe contra Postgres (stub — falta wirear prisma)',
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
          'Template expression. Truthy result routes through "true", falsy through "false".',
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
