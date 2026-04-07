import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * NanoRun curated node catalog.
 *
 * This seed populates the `NodeType` table with the runbook-relevant
 * subset of step types — the same ~20 nodes the editor's NodePalette
 * (frontend/components/Node/NodePalette.tsx) renders. The previous
 * NanoFlow seed had 70+ n8n-era nodes (Google Sheets, Mailchimp,
 * Twitter, LangChain, etc.) which were dropped during the post-pivot
 * cleanup — they had no role in operational runbook automation.
 *
 * The list is grouped by the seven canonical categories:
 *   devops · triggers · core · flow · integrations · ai · organization
 *
 * Type-string convention: every step type uses the canonical
 * `nanorun.*` prefix (post pivot rename, see migration
 * 20260407170000_rename_n8n_node_types). A handful of executor
 * types — `shell`, `wait`, `notify`, `approval`, `agent`, plus the
 * `custom.frame` and `custom.note` organisation nodes — predate the
 * prefix scheme and stay unprefixed because the dispatcher matches
 * them by exact string.
 */

interface NodeSeed {
    type: string;
    category: string;
    icon: string;
    color: string;
    label: { en: string; es: string };
    description: { en: string; es: string };
    inputs: Array<{ name: string; type: string }>;
    outputs: Array<{ name: string; type: string }>;
}

const main = { name: 'main', type: 'main' };

const NODES: NodeSeed[] = [
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
        inputs: [main],
        outputs: [main],
    },
    {
        type: 'nanorun.github',
        category: 'devops',
        icon: 'GitBranch',
        color: 'bg-gray-700',
        label: { en: 'GitHub', es: 'GitHub' },
        description: { en: 'PRs, releases, status checks', es: 'PRs, releases, status checks' },
        inputs: [main],
        outputs: [main],
    },
    {
        type: 'nanorun.docker',
        category: 'devops',
        icon: 'Box',
        color: 'bg-blue-500',
        label: { en: 'Docker', es: 'Docker' },
        description: {
            en: 'Build, push, run containers',
            es: 'Build, push, run de containers',
        },
        inputs: [main],
        outputs: [main],
    },
    {
        type: 'nanorun.postgres',
        category: 'devops',
        icon: 'Database',
        color: 'bg-blue-400',
        label: { en: 'Postgres', es: 'Postgres' },
        description: {
            en: 'Run SQL against a Postgres database',
            es: 'Ejecutar SQL en una base Postgres',
        },
        inputs: [main],
        outputs: [main],
    },
    {
        type: 'nanorun.awsS3',
        category: 'devops',
        icon: 'Cloud',
        color: 'bg-orange-500',
        label: { en: 'AWS S3', es: 'AWS S3' },
        description: {
            en: 'Upload artifacts and dump logs',
            es: 'Subir artifacts y dump de logs',
        },
        inputs: [main],
        outputs: [main],
    },

    // === triggers ===
    {
        type: 'nanorun.webhook',
        category: 'triggers',
        icon: 'Webhook',
        color: 'bg-green-500',
        label: { en: 'Webhook', es: 'Webhook' },
        description: {
            en: 'Trigger from an external HTTP call (Sentry, Datadog, GitHub)',
            es: 'Disparar desde una llamada HTTP externa (Sentry, Datadog, GitHub)',
        },
        inputs: [],
        outputs: [main],
    },
    {
        type: 'nanorun.cron',
        category: 'triggers',
        icon: 'Clock',
        color: 'bg-green-500',
        label: { en: 'Schedule', es: 'Programación' },
        description: {
            en: 'Run on a cron schedule',
            es: 'Ejecutar según un cron',
        },
        inputs: [],
        outputs: [main],
    },
    {
        type: 'nanorun.errorTrigger',
        category: 'triggers',
        icon: 'AlertCircle',
        color: 'bg-red-500',
        label: { en: 'Error handler', es: 'Manejador de error' },
        description: {
            en: 'Catch a step error and route to recovery',
            es: 'Capturar error de un paso y enrutar a recovery',
        },
        inputs: [main],
        outputs: [main],
    },

    // === core ===
    {
        type: 'nanorun.httpRequest',
        category: 'core',
        icon: 'Globe',
        color: 'bg-indigo-500',
        label: { en: 'HTTP request', es: 'Petición HTTP' },
        description: {
            en: 'Call any HTTP API',
            es: 'Llamar a cualquier API HTTP',
        },
        inputs: [main],
        outputs: [main],
    },
    {
        type: 'nanorun.set',
        category: 'core',
        icon: 'Settings',
        color: 'bg-blue-500',
        label: { en: 'Set variable', es: 'Set variable' },
        description: {
            en: 'Set a runbook variable for downstream steps',
            es: 'Setear una variable del runbook para pasos siguientes',
        },
        inputs: [main],
        outputs: [main],
    },
    {
        type: 'nanorun.if',
        category: 'core',
        icon: 'GitBranch',
        color: 'bg-yellow-500',
        label: { en: 'If', es: 'If' },
        description: {
            en: 'Branch on a declarative condition',
            es: 'Bifurcar según una condición declarativa',
        },
        inputs: [main],
        outputs: [
            { name: 'true', type: 'main' },
            { name: 'false', type: 'main' },
        ],
    },
    {
        type: 'nanorun.switch',
        category: 'core',
        icon: 'List',
        color: 'bg-yellow-500',
        label: { en: 'Switch', es: 'Switch' },
        description: {
            en: 'Branch into multiple routes',
            es: 'Bifurcar en múltiples rutas',
        },
        inputs: [main],
        outputs: [
            { name: '0', type: 'main' },
            { name: '1', type: 'main' },
            { name: '2', type: 'main' },
            { name: '3', type: 'main' },
        ],
    },

    // === flow ===
    {
        type: 'nanorun.loop',
        category: 'flow',
        icon: 'RefreshCw',
        color: 'bg-yellow-500',
        label: { en: 'Loop / Iterate', es: 'Loop / Iterar' },
        description: {
            en: 'Iterate over a list or retry N times',
            es: 'Iterar una lista o reintentar N veces',
        },
        inputs: [main],
        outputs: [main],
    },
    {
        type: 'wait',
        category: 'flow',
        icon: 'Clock',
        color: 'bg-amber-500',
        label: { en: 'Wait', es: 'Esperar' },
        description: {
            en: 'Pause for a fixed duration',
            es: 'Pausar por una duración fija',
        },
        inputs: [main],
        outputs: [main],
    },

    // === integrations ===
    {
        type: 'notify',
        category: 'integrations',
        icon: 'Bell',
        color: 'bg-pink-500',
        label: { en: 'Notify', es: 'Notificar' },
        description: {
            en: 'Send a Slack/Discord/email notification',
            es: 'Enviar una notificación Slack/Discord/email',
        },
        inputs: [main],
        outputs: [main],
    },

    // === ai ===
    {
        type: 'agent',
        category: 'ai',
        icon: 'Sparkles',
        color: 'bg-violet-500',
        label: { en: 'AI agent', es: 'Agente IA' },
        description: {
            en: 'Run a Claude/GPT prompt as part of the runbook',
            es: 'Ejecutar un prompt Claude/GPT como parte del runbook',
        },
        inputs: [main],
        outputs: [main],
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
        inputs: [main],
        outputs: [main],
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
        await prisma.nodeType.upsert({
            where: { type: node.type },
            update: {
                category: node.category,
                icon: node.icon,
                color: node.color,
                label: node.label,
                description: node.description,
                inputs: node.inputs,
                outputs: node.outputs,
            },
            create: {
                type: node.type,
                category: node.category,
                icon: node.icon,
                color: node.color,
                label: node.label,
                description: node.description,
                inputs: node.inputs,
                outputs: node.outputs,
            },
        });
    }
    console.log('Node types seeded.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
