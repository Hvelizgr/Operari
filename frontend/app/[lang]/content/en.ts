import { repo } from '@/config/repo.config';

export const content = {
  seo: {
    title: 'Operari — The action layer for your alerts',
    description:
      'Your alert fires at 3am. Operari runs the fix. Open-source visual runbooks triggered by Datadog, Sentry, GitHub, PagerDuty, Grafana, or any webhook. Self-host with one command.',
    openGraph: {
      title: 'Operari — Your alert fires. Operari runs the fix.',
      description:
        'Open-source runbook automation for alert response. Visual to author, YAML to commit, sandboxed to execute, audited to prove.',
    },
  },
  navigation: {
    product: 'Product',
    docs: 'Docs',
    github: 'GitHub',
    login: 'Log in',
    getStarted: 'Get API key',
  },
  hero: {
    badge: 'Self-serve · pre-launch alpha',
    title: 'Runbooks as\nan API.',
    subtitle:
      'Trigger production runbooks with a single HTTP call. Dry-run against prod first, every step runs in a sandboxed executor, each action lands in a signed audit chain, and the whole response is yours in under 300 ms.',
    ctaPrimary: 'Create your workspace',
    ctaSecondary: 'or self-host',
    // Terminal-style code + live response panel that replaces the legacy
    // alert→webhook→resolved scenario card. Written as a single POST to
    // /api/v1/runs/trigger so readers get the mental model in four lines.
    scenario: {
      requestMethod: 'POST',
      requestUrl: '/api/v1/runs/trigger',
      requestLabel: 'Request',
      requestLines: [
        'curl -X POST https://api.operari.dev/v1/runs/trigger \\',
        '  -H "Authorization: Bearer sk_live_…" \\',
        '  -H "Content-Type: application/json" \\',
        '  -d \'{"runbook": "rollback-last-deploy",',
        '       "vars": {"service": "api"}}\'',
      ],
      responseLabel: 'Response',
      responseStatus: '201 Created · 284 ms',
      responseBody: [
        '{',
        '  "run_id": "run_3f9c2b7a",',
        '  "status": "running",',
        '  "steps": 4,',
        '  "audit_hash": "3f9c…b2e1",',
        '  "stream": "wss://api.operari.dev/v1/runs/run_3f9c2b7a/stream"',
        '}',
      ],
      // Emitted to the stream endpoint, replayed by anime.js as the
      // runbook progresses in real time under the response body.
      streamLabel: 'Stream',
      streamSteps: [
        '▸ fetch service logs (kubectl)',
        '▸ rollback last deploy (helm)',
        '▸ post status to #incidents',
        '▸ open Linear ticket',
      ],
      streamFooter: 'run completed · 4/4 steps · audit chain verified · live SSE stream',
    },
  },
  trust: {
    eyebrow: 'Built to sit in the stack you already trust',
    line: 'Wire into the tools your on-call already opens at 3am.',
  },
  metrics: {
    eyebrow: 'Engineering by the numbers',
    title: 'Production-grade, from the first run.',
    items: [
      {
        value: 300,
        suffix: 'ms',
        label: 'p95 trigger → first step log',
        hint: 'measured on the hosted API',
      },
      {
        value: 12,
        suffix: '',
        label: 'first-party step types',
        hint: 'shell · http · approve · notify · sql · …',
      },
      {
        value: 100,
        suffix: '%',
        label: 'open source core, AGPL-3.0',
        hint: 'SDK + CLI are MIT · self-host or run hosted — same binary',
      },
      {
        value: 10,
        suffix: 'ms',
        label: 'live event tail latency',
        hint: 'SSE stream from the engine to every watching UI',
      },
    ],
  },
  safety: {
    eyebrow: 'Safety rails',
    title: 'Four primitives most workflow tools miss.',
    subtitle:
      "The features below are the actual line between 'Zapier for backend devs' and a tool you are willing to trust with prod traffic.",
    rails: [
      {
        title: 'Dry-run against production.',
        description:
          'Flip a flag and every step logs what it WOULD do — no subprocess, no HTTP call, no approval pause, no notification. Run it against prod credentials before the real rollback, see the exact payload, sleep at night.',
        example:
          'curl -X POST https://api.operari.dev/v1/runs/trigger \\\n  -d \'{"runbook":"rollback","dryRun":true}\'',
      },
      {
        title: 'Errors trigger the next runbook automatically.',
        description:
          'Declare onErrorRunbook on your deploy. When it fails, the rollback runbook fires with the error payload as input. Cycle-detected, same tenant, one line of YAML.',
        example: 'name: deploy-api\nonErrorRunbook: rollback-api\nsteps: [...]',
      },
      {
        title: "Compose runbooks. Don't copy-paste them.",
        description:
          "Drop a `runbook` step to invoke another runbook as a sub-run. Sync or async, inherits dry-run, 5-level depth cap, tenant-scoped — so shared procedures like 'notify stakeholders' stay one file.",
        example:
          '- id: pre_checks\n  type: runbook\n  config:\n    ref: standard-prechecks\n    inputs:\n      service: "{{vars.service}}"',
      },
      {
        title: 'Your own step types, shipped as npm packages.',
        description:
          "The @operari/sdk exports defineStep({type, configSchema, execute}). Author in TypeScript, ship the built package, drop it in OPERARI_PLUGINS_DIR. The runtime validates config via your zod schema before execute. Reserved types can't be overridden.",
        example:
          "import { defineStep } from '@operari/sdk/steps';\nexport default defineStep({\n  type: 'myorg.slack-notify',\n  configSchema: z.object({ webhook: z.string().url() }),\n  async execute(config, ctx) { /* ... */ },\n});",
      },
    ],
  },
  story: {
    eyebrow: 'How it works',
    title: 'Three things, one tool.',
    subtitle:
      'The other tools in this space pick one and lose the rest. Operari does all three because none of them work alone.',
    blocks: [
      {
        number: '01',
        title: 'Author the runbook visually.',
        description:
          'Drag a shell step. Pipe its output into an approval gate. Branch on a conditional. The canvas stays in lockstep with the YAML — no separate config file, no two sources of truth.',
        caption: 'Drag, drop, save. That is a runbook.',
      },
      {
        number: '02',
        title: 'Commit it as YAML.',
        description:
          'Every runbook round-trips between the visual editor and a YAML file you commit to git. Code-review it like any other infrastructure. Pin it against the published JSON Schema. Roll back with `git revert`.',
        caption: 'Versioned. Reviewable. Reverts like code.',
      },
      {
        number: '03',
        title: 'The alert fires → it runs → audit chain proves it.',
        description:
          'Webhook in, runbook out. Each step executes in a sandboxed runner with retries, conditional gates, and human approval where you want it. Operators watch the run live in a Temporal-style event log (SSE tail, jump-to-latest, retry-from-step) while the same transitions land in a SHA-256 hash chain you can verify with `operari audit verify`.',
        caption: 'From alert to evidence in one tool.',
      },
    ],
  },
  templates: {
    eyebrow: 'Templates',
    title: 'Real runbooks. Real shell. Read them.',
    subtitle:
      'Every template ships in the repo as commitable YAML. Open one, copy it, change two variables, run it. No DSL, no plugins.',
    items: [
      {
        slug: 'respond-to-sentry-alert',
        category: 'incident response',
        title: 'Respond to a Sentry alert',
        description:
          'The runbook the hero promises. Webhook in, fetch logs, gate on approval, helm rollback, notify #incidents, open post-mortem ticket.',
        accent: 'violet',
      },
      {
        slug: 'k8s-rolling-deploy',
        category: 'deploy',
        title: 'Kubernetes rolling deploy',
        description:
          'kubectl set image, watch rollout, smoke test the pods, notify Slack on success. The CI runbook every team rewrites in bash.',
        accent: 'primary',
      },
      {
        slug: 'rotate-aws-secrets',
        category: 'security',
        title: 'Rotate AWS IAM secrets',
        description:
          'Create a new key, propagate to Vercel and GitHub, gate on human approval, verify, then revoke the old one. Auditable end to end.',
        accent: 'amber',
      },
      {
        slug: 'db-migration-prisma',
        category: 'data',
        title: 'Prisma migration with backup',
        description:
          'Snapshot the database, run the pending migrations, verify with a row count, notify Slack. One human approval before the destructive step.',
        accent: 'emerald',
      },
    ],
    cta: 'Browse all templates on GitHub',
  },
  triggers: {
    eyebrow: 'Trigger sources',
    title: 'Anything that POSTs JSON can start a runbook.',
    subtitle:
      'Built-in HMAC verification for the providers you already pay for. Generic webhook for everything else.',
    items: [
      {
        name: 'Datadog',
        description:
          'Monitor alerts, anomaly detection, SLO burns. Payload mapped to runbook variables.',
        status: 'ready',
      },
      {
        name: 'Sentry',
        description:
          'Issue alerts, regression detection, performance degradation. HMAC-verified, auto-parsed.',
        status: 'ready',
      },
      {
        name: 'GitHub',
        description:
          'Workflow failures, deployment events, security advisories. Signed webhook validation.',
        status: 'ready',
      },
      {
        name: 'Generic webhook',
        description:
          'Any HTTP POST with JSON. Bring your own HMAC. PagerDuty, Grafana, OpsGenie, custom — same path.',
        status: 'ready',
      },
    ],
    callsAnything: {
      title: 'And every step calls real tools.',
      subtitle:
        "No DSL. No per-tool plugin to install. Steps run as shell — so anything you'd type in a terminal works on day one.",
      tools: [
        'kubectl',
        'helm',
        'aws',
        'gh',
        'terraform',
        'psql',
        'curl',
        'ssh',
        'ansible',
        'docker',
        'git',
        'bash',
      ],
    },
  },
  comparison: {
    eyebrow: 'The honest table',
    title: 'We are not for everyone. Here is the proof.',
    subtitle:
      'Tilted in our favor where we win, gray where we do not compete, red where we lose. Read it before you star.',
    headers: ['', 'Operari', 'Rundeck', 'StackStorm', 'incident.io', 'Backstage'],
    rows: [
      {
        feature: 'Visual canvas + YAML round-trip',
        cells: ['yes', 'no', 'no', 'partial', 'no'],
      },
      {
        feature: 'Triggered by alerts (Datadog/Sentry/PagerDuty)',
        cells: ['yes', 'partial', 'yes', 'yes', 'no'],
      },
      {
        feature: 'Sandboxed shell execution',
        cells: ['yes', 'yes', 'yes', 'no', 'no'],
      },
      {
        feature: 'Replay from any failed step',
        cells: ['yes', 'yes', 'no', 'no', 'no'],
      },
      {
        feature: 'AI agent on failure (in-context)',
        cells: ['yes', 'no', 'no', 'partial', 'no'],
      },
      {
        feature: 'Hash-chained audit (verifiable)',
        cells: ['yes', 'partial', 'partial', 'partial', 'no'],
      },
      {
        feature: 'Open source license',
        cells: ['AGPL', 'Apache', 'Apache', 'no', 'Apache'],
      },
      {
        feature: 'Dry-run against prod (no side effects)',
        cells: ['yes', 'no', 'no', 'no', 'no'],
      },
      {
        feature: 'Custom step plugins (SDK)',
        cells: ['yes', 'no', 'partial', 'no', 'partial'],
      },
      {
        feature: 'Built-in MFA + email verification',
        cells: ['yes', 'yes', 'no', 'yes', 'partial'],
      },
      {
        feature: 'Price per seat',
        cells: ['$19/$49', '$125/mo', 'free', '$20–40/mo', 'self-host'],
      },
      {
        feature: 'Production-ready today',
        cells: ['no', 'yes', 'no', 'yes', 'yes'],
      },
    ],
    footnote:
      'We lose on production-readiness today. We are pre-launch alpha. If you need rock-solid, pick Rundeck or incident.io. If you want to influence what the next OSS runbook tool looks like, talk to us.',
    cta: 'OK, show me the repo',
  },
  cta: {
    eyebrow: 'Self-host',
    pricing: 'Free. No card. No tier.',
    title: 'Two minutes to your first runbook.',
    subtitle:
      'Clone, run, open the editor at localhost:3000. AGPL forever. No telemetry. No sign-up.',
    code: repo.cloneSnippet,
    primary: 'Read the README',
    secondary: 'What does NOT work yet',
  },
  footer: {
    tagline: 'Open-source runbook automation for alert response.',
    rights: 'AGPL-3.0. Built by SREs who got tired of Confluence.',
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Pricing', href: '/pricing' },
          { label: 'GitHub', href: repo.base },
          { label: 'Templates', href: repo.templatesTree },
          { label: 'Roadmap', href: repo.roadmap },
        ],
      },
      {
        title: 'Resources',
        links: [
          { label: 'Docs', href: repo.readme },
          { label: 'Changelog', href: '/changelog' },
          { label: 'Contributing', href: repo.contributing },
          { label: 'Contact', href: '/contact' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { label: 'Security', href: '/security' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Terms', href: '/terms' },
          { label: 'License', href: repo.license },
        ],
      },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Self-host free. Cloud when you want it.',
    subtitle:
      'The whole product, AGPL, self-hosted forever. Cloud is for teams that do not want to run a Postgres. Pick once; switch later.',
    badge: 'Cloud is in waitlist — self-host available today.',
    billingYearly: 'Billed yearly (save 20%)',
    billingMonthly: 'Billed monthly',
    perMonth: '/mo',
    perUserMonth: '/user/mo',
    contactSales: 'Contact sales',
    getStarted: 'Self-host now',
    popular: 'Most popular',
    tiers: [
      {
        id: 'self-host',
        name: 'Self-host',
        price: '$0',
        priceYearly: '$0',
        period: 'forever',
        description: 'Docker compose, your server, your data. AGPL forever.',
        features: [
          'Unlimited runbooks',
          'Unlimited runs',
          'Unlimited webhooks',
          'All trigger sources',
          'Audit chain verification',
          'Sandboxed shell execution',
          'Community Discord',
        ],
        cta: 'Self-host now',
        ctaHref: '#docker',
        highlighted: false,
      },
      {
        id: 'team',
        name: 'Team',
        price: '$19',
        priceYearly: '$15',
        period: '/user/mo',
        description: 'We run the Postgres. You run the runbooks.',
        features: [
          'Everything in Self-host',
          'Managed Postgres + backups',
          'Slack/Teams notifications',
          'SSO (Google, Microsoft)',
          '14-day run retention',
          'Email support · 24h SLA',
          'Priority webhook ingest',
        ],
        cta: 'Join waitlist',
        ctaHref: '/contact',
        highlighted: true,
      },
      {
        id: 'business',
        name: 'Business',
        price: '$49',
        priceYearly: '$39',
        period: '/user/mo',
        description: 'For platform teams that need audit + SAML.',
        features: [
          'Everything in Team',
          'SAML SSO + SCIM',
          'Audit log export (SIEM)',
          'Role-based access control',
          '1-year run retention',
          '99.9% SLA',
          'Dedicated Slack channel',
        ],
        cta: 'Join waitlist',
        ctaHref: '/contact',
        highlighted: false,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 'Custom',
        priceYearly: 'Custom',
        period: '',
        description: "On-prem, air-gapped, FedRAMP-track. Let's talk.",
        features: [
          'Everything in Business',
          'Self-host + managed hybrid',
          'Custom compliance (SOC2, HIPAA)',
          'Air-gapped deployment',
          'Unlimited run retention',
          '99.99% SLA · named CSM',
          'Source escrow',
        ],
        cta: 'Contact sales',
        ctaHref: '/contact',
        highlighted: false,
      },
    ],
    comparison: {
      title: 'Compare every plan',
      groups: [
        {
          name: 'Core',
          rows: [
            { feature: 'Runbooks', values: ['Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
            {
              feature: 'Run history',
              values: ['Unlimited (your DB)', '14 days', '1 year', 'Custom'],
            },
            { feature: 'Webhooks', values: ['Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'] },
            { feature: 'Sandboxed shell', values: ['yes', 'yes', 'yes', 'yes'] },
          ],
        },
        {
          name: 'Security',
          rows: [
            { feature: 'HMAC webhook verify', values: ['yes', 'yes', 'yes', 'yes'] },
            { feature: 'Audit hash chain', values: ['yes', 'yes', 'yes', 'yes'] },
            { feature: 'SSO (Google/MS)', values: ['no', 'yes', 'yes', 'yes'] },
            { feature: 'SAML + SCIM', values: ['no', 'no', 'yes', 'yes'] },
            { feature: 'Audit log export', values: ['no', 'no', 'yes', 'yes'] },
            { feature: 'Air-gapped deploy', values: ['yes', 'no', 'no', 'yes'] },
          ],
        },
        {
          name: 'Support',
          rows: [
            { feature: 'Community Discord', values: ['yes', 'yes', 'yes', 'yes'] },
            { feature: 'Email SLA', values: ['—', '24h', '4h', '1h'] },
            { feature: 'Dedicated channel', values: ['no', 'no', 'yes', 'yes'] },
            { feature: 'Uptime SLA', values: ['—', '—', '99.9%', '99.99%'] },
          ],
        },
      ],
    },
    faq: {
      title: 'Pricing questions',
      items: [
        {
          q: 'Is self-host really free forever?',
          a: 'Yes. AGPL-3.0, no strings. The same binary we run in cloud runs on your server. No feature flags gating functionality behind a paid tier.',
        },
        {
          q: 'What counts as a user?',
          a: 'Anyone who logs in. Webhooks, triggers, and runbook executions do not count as users — only humans with an account do.',
        },
        {
          q: 'Can I switch from Cloud to Self-host (or back) later?',
          a: 'Yes. Every runbook is YAML in git. Every run is SHA-256 audited. Data is portable by design — you can export a Cloud instance to self-host with one command.',
        },
        {
          q: 'Do you offer a discount for OSS / startups?',
          a: 'Self-host is already free. For Team/Business, we offer 50% off for registered non-profits and YC/Sequoia/Index-backed startups in their first year. Email us.',
        },
        {
          q: 'When is Cloud generally available?',
          a: 'We open Cloud to waitlist cohorts every 2 weeks. Pre-launch alpha right now — expect Q3 2026 for general availability.',
        },
      ],
    },
  },
  changelog: {
    eyebrow: 'Changelog',
    title: 'What shipped, when, and why.',
    subtitle: 'Versioned, dated, honest. No marketing rewrites.',
    entries: [
      {
        date: '2026-04-10',
        version: 'v0.6.0',
        tag: 'feature',
        title: 'Opt-in approval write tools for the recovery agent',
        body: 'The in-context AI agent can now grant or reject approval gates when the operator opts in. Default stays read-only — write access is per-runbook.',
      },
      {
        date: '2026-04-02',
        version: 'v0.5.2',
        tag: 'refactor',
        title: 'Workflow → runbook rename (phase 2b)',
        body: 'Database tables, Prisma models, and API surface moved from workflow_* to runbook_*. Backwards-compat shim dropped; migrate with included script.',
      },
      {
        date: '2026-04-24',
        version: 'v0.6.0',
        tag: 'sdk',
        title: 'Public SDK consolidated under @operari/*',
        body: 'The TypeScript SDK, CLI, and shared types now ship as @operari/sdk, @operari/cli, and @operari/shared. The intermediate Operari namespace was retired to keep the brand consistent across the CLI binary, package names, email templates, and in-app copy.',
      },
      {
        date: '2026-03-14',
        version: 'v0.5.0',
        tag: 'feature',
        title: 'GitHub webhook + signed payload verification',
        body: 'Native GitHub trigger source with signed webhook validation. Wire a workflow failure to a rollback runbook in 30 seconds.',
      },
      {
        date: '2026-02-22',
        version: 'v0.4.0',
        tag: 'feature',
        title: 'Hash-chained audit trail',
        body: 'Every step lands in a SHA-256 hash chain. `operari audit verify` reruns the chain end-to-end; tampering is detected deterministically.',
      },
    ],
  },
  security: {
    title: 'Security',
    subtitle: 'How we handle secrets, data, and incidents.',
    updated: 'Last updated: 2026-04-01',
    sections: [
      {
        heading: 'Reporting a vulnerability',
        body: 'Email security@operari.dev with a PGP-encrypted message. We acknowledge within 24 hours, triage within 72. Full disclosure policy in the repo SECURITY.md.',
      },
      {
        heading: 'Sandboxing',
        body: 'Every shell step runs inside a container with a fresh rootfs, no host mount, no network egress unless declared. The runner enforces CPU/memory/wall-clock limits per step.',
      },
      {
        heading: 'Secrets',
        body: 'Runtime secrets never touch disk. They are injected into the step process via environment variables from a KMS-backed store. Logs are redacted at write time, not at view time.',
      },
      {
        heading: 'Audit chain',
        body: 'Step I/O is hashed with SHA-256 and chained. You can verify a run end-to-end with `operari audit verify`. Tampering breaks the chain deterministically.',
      },
      {
        heading: 'Data residency (Cloud)',
        body: 'Cloud defaults to us-east-1. Team+ plans can pick eu-west-1 or ap-southeast-1 at provisioning. No cross-region replication without explicit opt-in.',
      },
      {
        heading: 'Compliance',
        body: 'SOC 2 Type I in progress (target Q4 2026). HIPAA on Business tier with a BAA. GDPR/CCPA compliant by design. FedRAMP Moderate tracked for 2027.',
      },
    ],
  },
  subprocessors: {
    title: 'Subprocessors',
    subtitle: 'Third parties that handle data on our behalf. Updated whenever we add or drop one.',
    updated: 'Last updated: 2026-04-01',
    intro:
      'We keep the list tight on purpose. Every subprocessor is contractually bound by DPAs and processes only the data we explicitly hand over.',
    entries: [
      {
        name: 'Amazon Web Services (AWS)',
        purpose: 'Hosting — EC2, RDS Postgres, S3, CloudWatch',
        region: 'us-east-1 (default), eu-west-1 / ap-southeast-1 opt-in',
        dataTypes: 'All customer data (runbooks, runs, logs)',
      },
      {
        name: 'Stripe',
        purpose: 'Billing — subscription + invoicing',
        region: 'United States + Ireland',
        dataTypes: 'Billing email, company, payment method token',
      },
      {
        name: 'Postmark',
        purpose: 'Transactional email — approvals, run failures',
        region: 'United States',
        dataTypes: 'Recipient email, run metadata',
      },
      {
        name: 'Cloudflare',
        purpose: 'DNS + WAF + CDN for marketing site',
        region: 'Global',
        dataTypes: 'Anonymous request logs (no cookies)',
      },
      {
        name: 'Plausible',
        purpose: 'Privacy-first marketing analytics',
        region: 'Germany (EU)',
        dataTypes: 'Aggregate page views (no personal data)',
      },
      {
        name: 'Sentry',
        purpose: 'Error monitoring (cloud build only)',
        region: 'United States',
        dataTypes: 'Stack traces, anonymized user ID',
      },
    ],
    notice:
      "Notice of changes: we'll email customers on record at least 30 days before activating a new subprocessor.",
  },
  privacy: {
    title: 'Privacy',
    subtitle: 'What we collect, what we do with it, what we refuse to do.',
    updated: 'Last updated: 2026-04-17',
    sections: [
      {
        heading: 'Self-host: zero telemetry',
        body: 'Self-host sends nothing to us. No pings, no usage counters, no crash reports unless you explicitly opt in via the OPERARI_TELEMETRY flag. Your runbooks, executions, logs, and credentials never leave your infrastructure.',
      },
      {
        heading: 'Cloud: data we store',
        body: 'When you sign up for the hosted service we store: (a) account identity — email, hashed password, optional display name, and the OAuth provider subject id if you sign in via Google or GitHub; (b) workspace data — runbooks, executions, step logs, secrets you entered, audit events; (c) billing metadata from Stripe — subscription status, plan, invoice ids. We never read your runbook content or secrets for any reason other than executing them on your request.',
      },
      {
        heading: 'Lawful basis (GDPR)',
        body: "We process account and workspace data under the contract basis — you signed up to receive a service and we can't deliver it without processing the data. Marketing emails go out under legitimate interest with a one-click unsubscribe on every send. We do not profile for advertising.",
      },
      {
        heading: 'Your rights',
        body: "You can access, correct, export, or delete every field tied to your account through the Settings page. For rights that need manual handling (restriction, objection, portability in bulk), email privacy@operari.dev and we'll respond within 30 days. EU/EEA and UK residents may also lodge a complaint with their local supervisory authority.",
      },
      {
        heading: 'Retention',
        body: 'Account data is retained while your account is active. When you delete your account, your user row, workspace, runbooks, executions, secrets, and step logs are purged within 30 days across primary storage and backups. The audit log is hash-chained and immutable by design — deletion events are tombstoned with the userId and timestamp but the event stream itself is retained for compliance (required by SOC 2 / ISO 27001 processes).',
      },
      {
        heading: 'International transfers',
        body: 'The hosted service runs in the region you picked at signup (today: EU or US). Where processing involves a subprocessor in another region, we rely on Standard Contractual Clauses (SCCs) and the UK International Data Transfer Agreement as applicable.',
      },
      {
        heading: 'Cookies',
        body: 'We set two functional cookies: operari_session (HttpOnly, required for login) and operari_csrf (readable by your browser so forms can include a CSRF token). The marketing site uses privacy-first analytics without cookies or cross-site tracking.',
      },
      {
        heading: 'Subprocessors',
        body: 'See /subprocessors for the canonical list of hosting, email, error-tracking, and payment processors we use. We notify customers of record at least 30 days before activating any new subprocessor.',
      },
      {
        heading: 'Security breach notice',
        body: "In the unlikely event of a personal-data breach affecting your account, we'll notify you within 72 hours of confirmation, consistent with GDPR Article 33/34 obligations, and publish a post-incident report within 30 days.",
      },
      {
        heading: "Children's data",
        body: "The service is not directed at anyone under 16. We don't knowingly collect data from children; if you believe a minor's data reached us, email privacy@operari.dev and we'll remove it.",
      },
      {
        heading: 'Contact',
        body: "Privacy questions or rights requests: privacy@operari.dev. Security disclosures: security@operari.dev (PGP on request). For EU GDPR matters we'll maintain an EEA representative once revenue in the region crosses the EU Rep threshold.",
      },
    ],
  },
  terms: {
    title: 'Terms of service',
    subtitle: 'The rules of the road.',
    updated: 'Last updated: 2026-04-17',
    sections: [
      {
        heading: 'Parties',
        body: 'These terms form an agreement between you ("Customer") and Operari ("we", "us"). By signing up for the hosted service or running the self-host distribution in production you agree to them.',
      },
      {
        heading: 'Self-host license',
        body: "The self-host server is AGPL-3.0 — you may run it, fork it, and embed it in products; running a modified copy as a public service triggers the AGPL's source-availability obligation. The official SDK and CLI packages are MIT. A handful of enterprise modules (SAML/SCIM connectors, managed Postgres backup tooling) are source-available under a separate Business Source License that converts to Apache 2.0 on its declared change date.",
      },
      {
        heading: 'Cloud subscription',
        body: "Monthly or annual, billed in advance via Stripe. You can cancel at any time from Settings → Billing; the current period remains active until the end of its billing cycle. Annual plans receive a prorated refund on the unused portion at the admin's request.",
      },
      {
        heading: 'Fees and taxes',
        body: "Prices are in USD unless your plan page says otherwise. You're responsible for applicable taxes (VAT/GST/sales tax); Stripe Tax handles the majority of regions automatically. We may change pricing with 60 days' notice emailed to your account admin; the first 100 paying customers keep their price for as long as they remain on a paid plan.",
      },
      {
        heading: 'Acceptable use',
        body: 'Do not use the service to attack systems you do not own, exfiltrate data you do not control, or run resource-abusive workloads (cryptocurrency mining, DDoS reflectors, content scrapers targeting rate-limited third parties). Runbook content remains your property and your responsibility; we may suspend workloads that trip infrastructure safeguards and will notify you before permanent action unless an active incident requires otherwise.',
      },
      {
        heading: 'Your data, your ownership',
        body: 'You retain all rights to the runbooks, executions, secrets, and logs you upload. We receive a limited license to process that data solely to deliver the service. We do not train AI models on your runbook content, inspect your executions for product analytics, or share your data with third parties beyond the subprocessors listed at /subprocessors.',
      },
      {
        heading: 'Availability + SLA',
        body: "Free and self-host ship with no uptime commitment. Team and Business plans target 99.9% monthly availability on the primary API, measured against our public status page. Missed-SLA credits for Team/Business equal 10% of the month's fees per hour of downtime above the target, capped at 50% of that month. Enterprise contracts may add stricter terms in an executed order form.",
      },
      {
        heading: 'Support',
        body: "Free: community support via GitHub Discussions. Team: email response within two business days. Business: email response within one business day, with a shared incident bridge during customer-confirmed production incidents. Enterprise: contract-defined. We don't guarantee support for unmodified self-host beyond bug reports that reproduce against the current release.",
      },
      {
        heading: 'Confidentiality',
        body: "Each party will protect the other's confidential information with reasonable care and only use it to fulfill the agreement. Our security practices — encryption at rest, per-tenant secret isolation, hash-chained audit logs — are documented on the security page and apply to every customer regardless of plan.",
      },
      {
        heading: 'Warranties',
        body: 'The service is provided on an "as is" and "as available" basis. We disclaim implied warranties to the maximum extent permitted by law. We do warrant that we have authority to grant the rights we grant here and that our production binary is not knowingly shipped with malicious code.',
      },
      {
        heading: 'Limitation of liability',
        body: "Neither party will be liable for indirect, incidental, special, consequential, or punitive damages. Each party's aggregate liability under this agreement is limited to the fees Customer paid in the twelve months preceding the claim. Nothing in this section limits liability for willful misconduct or breach of confidentiality.",
      },
      {
        heading: 'Indemnity',
        body: 'We will defend and indemnify you against third-party claims that the service as delivered infringes their intellectual property, except where the infringement arises from your modifications, combination with third-party software, or unlawful use. You will indemnify us against third-party claims arising from your runbook content or your use of the service.',
      },
      {
        heading: 'Data processing (GDPR)',
        body: 'For customers processing EU/UK personal data through the service, our Data Processing Addendum (available at /dpa) is incorporated by reference on execution. It covers Article 28 obligations, a current subprocessor list, and Standard Contractual Clauses for international transfers.',
      },
      {
        heading: 'Suspension + termination',
        body: "Either party may terminate for convenience with 30 days' notice (or immediately at the end of the current billing period for hosted). We may suspend the service on short notice if we reasonably believe your account is compromised, engaged in acceptable-use violations, or causing harm to other customers. On termination you can export your data for 30 days; after that it is purged per the retention section of the Privacy policy.",
      },
      {
        heading: 'Export controls + sanctions',
        body: 'You represent that you are not on, and will not use the service on behalf of, any party subject to a US, UK, or EU sanctions list, and that you will not export the service to any jurisdiction restricted under applicable trade law.',
      },
      {
        heading: 'Changes',
        body: 'Material changes to these terms or the Privacy policy go into effect 30 days after we post a notice at the top of the page and email the admin on record. Non-material edits (typo fixes, clarifications) may take effect immediately and will be listed on /changelog.',
      },
      {
        heading: 'Jurisdiction',
        body: 'These terms are governed by the laws of Delaware, USA, without reference to its conflict-of-laws rules. Disputes go to JAMS arbitration seated in San Francisco under its Streamlined Rules; each party retains the right to seek injunctive relief in any court of competent jurisdiction for intellectual-property misuse. Class actions are waived.',
      },
      {
        heading: 'Entire agreement',
        body: 'These terms plus the DPA, order form (if any), and product-specific addenda form the entire agreement. If any provision is found unenforceable, the rest continues to apply.',
      },
    ],
  },
  contact: {
    title: 'Talk to us.',
    subtitle:
      'We read every message. Pre-launch alpha, so we are the humans building the product — no ticket queue.',
    channels: [
      {
        name: 'Open an issue',
        description: 'Bug reports and feature requests.',
        href: 'issues',
        action: 'GitHub issues',
      },
      {
        name: 'Discussions',
        description: 'Questions, ideas, and how-tos from the community.',
        href: 'discussions',
        action: 'Open discussions',
      },
      {
        name: 'Security',
        description: 'Vulnerabilities. PGP-encrypted, 24h ack.',
        href: 'mailto:security@operari.dev',
        action: 'security@operari.dev',
      },
      {
        name: 'Sales',
        description: 'Business, Enterprise, and on-prem.',
        href: 'mailto:hello@operari.dev',
        action: 'hello@operari.dev',
      },
    ],
    form: {
      title: 'Or send us a note',
      name: 'Your name',
      email: 'Work email',
      company: 'Company',
      message: "What's on your mind?",
      submit: 'Send',
      sending: 'Sending...',
      sent: 'Got it. We will reply within 48 hours.',
    },
  },
  modal: {
    title: 'Become a design partner',
    subtitle:
      'Pre-launch alpha. We are looking for 5 SRE / platform teams using Operari in earnest. Free forever on self-host, weekly office hours, direct line to the people building it.',
    placeholder: 'you@company.com',
    button: 'Request a chat',
    processing: 'Sending...',
    successTitle: 'Got it',
    successDesc: 'We will be in touch within 48 hours.',
    successButton: 'Close',
  },
};
