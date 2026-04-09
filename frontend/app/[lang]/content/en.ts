export const content = {
  seo: {
    title: "NanoRun — The action layer for your alerts",
    description:
      "Sentry catches it at 3am. NanoRun runs the fix. Open-source visual runbooks that respond to alerts from Sentry, Datadog, GitHub, or any webhook. Self-host with one command.",
    openGraph: {
      title: "NanoRun — Sentry catches it. NanoRun runs the fix.",
      description:
        "Open-source runbook automation for alert response. Visual to author, YAML to commit, sandboxed to execute, audited to prove.",
    },
  },
  navigation: {
    product: "Product",
    docs: "Docs",
    github: "GitHub",
    login: "Log in",
    getStarted: "Self-host",
  },
  hero: {
    badge: "Open source · AGPL · pre-launch alpha",
    title: "Sentry catches it.\nNanoRun runs the fix.",
    subtitle:
      "Open-source runbooks that respond to your alerts. Visual to author, YAML to commit, sandboxed to execute, audited to prove.",
    ctaPrimary: "docker compose up",
    ctaSecondary: "Star on GitHub",
    // labels for the 4-frame "alert → runbook → resolved" diagram
    scenario: {
      step1Label: "1. Sentry alert",
      step1Body: "TypeError: Cannot read 'user' of undefined",
      step2Label: "2. Webhook → NanoRun",
      step2Body: "POST /api/webhooks/sentry  ✓ HMAC verified",
      step3Label: "3. Runbook executing",
      step3Steps: [
        "fetch service logs (kubectl)",
        "rollback last deploy (helm)",
        "post status to #incidents",
        "open Linear ticket",
      ],
      step4Label: "4. Resolved · 47s",
      step4Body: "Audit hash: 3f9c…b2e1 · all 4 steps verified",
    },
  },
  story: {
    eyebrow: "How it works",
    title: "Three things, one tool.",
    subtitle:
      "The other tools in this space pick one and lose the rest. NanoRun does all three because none of them work alone.",
    blocks: [
      {
        number: "01",
        title: "Author the runbook visually.",
        description:
          "Drag a shell step. Pipe its output into an approval gate. Branch on a conditional. The canvas stays in lockstep with the YAML — no separate config file, no two sources of truth.",
        caption: "Drag, drop, save. That is a runbook.",
      },
      {
        number: "02",
        title: "Commit it as YAML.",
        description:
          "Every runbook round-trips between the visual editor and a YAML file you commit to git. Code-review it like any other infrastructure. Pin it against the published JSON Schema. Roll back with `git revert`.",
        caption: "Versioned. Reviewable. Reverts like code.",
      },
      {
        number: "03",
        title: "Sentry fires → it runs → audit chain proves it.",
        description:
          "Webhook in, runbook out. Each step executes in a sandboxed runner with retries, conditional gates, and human approval where you want it. Every action lands in a SHA-256 hash chain you can verify with `nanorun audit verify`.",
        caption: "From alert to evidence in one tool.",
      },
    ],
  },
  templates: {
    eyebrow: "Templates",
    title: "Real runbooks. Real shell. Read them.",
    subtitle:
      "Every template ships in the repo as commitable YAML. Open one, copy it, change two variables, run it. No DSL, no plugins.",
    items: [
      {
        slug: "respond-to-sentry-alert",
        category: "incident response",
        title: "Respond to a Sentry alert",
        description:
          "The runbook the hero promises. Webhook in, fetch logs, gate on approval, helm rollback, notify #incidents, open post-mortem ticket.",
        accent: "violet",
      },
      {
        slug: "k8s-rolling-deploy",
        category: "deploy",
        title: "Kubernetes rolling deploy",
        description:
          "kubectl set image, watch rollout, smoke test the pods, notify Slack on success. The CI runbook every team rewrites in bash.",
        accent: "primary",
      },
      {
        slug: "rotate-aws-secrets",
        category: "security",
        title: "Rotate AWS IAM secrets",
        description:
          "Create a new key, propagate to Vercel and GitHub, gate on human approval, verify, then revoke the old one. Auditable end to end.",
        accent: "amber",
      },
      {
        slug: "db-migration-prisma",
        category: "data",
        title: "Prisma migration with backup",
        description:
          "Snapshot the database, run the pending migrations, verify with a row count, notify Slack. One human approval before the destructive step.",
        accent: "emerald",
      },
    ],
    cta: "Browse all templates on GitHub",
  },
  triggers: {
    eyebrow: "Trigger sources",
    title: "Anything that POSTs JSON can start a runbook.",
    subtitle:
      "Built-in HMAC verification for the providers you already pay for. Generic webhook for everything else.",
    items: [
      {
        name: "Sentry",
        description:
          "Issue alerts, regression detection, performance degradation. HMAC-verified, auto-parsed.",
        status: "ready",
      },
      {
        name: "Datadog",
        description:
          "Monitor alerts, anomaly detection, SLO burns. Payload mapped to runbook variables.",
        status: "ready",
      },
      {
        name: "GitHub",
        description:
          "Workflow failures, deployment events, security advisories. Signed webhook validation.",
        status: "ready",
      },
      {
        name: "Generic webhook",
        description:
          "Any HTTP POST with JSON. Bring your own HMAC. PagerDuty, Grafana, OpsGenie, custom — same path.",
        status: "ready",
      },
    ],
    callsAnything: {
      title: "And every step calls real tools.",
      subtitle:
        "No DSL. No per-tool plugin to install. Steps run as shell — so anything you'd type in a terminal works on day one.",
      tools: [
        "kubectl",
        "helm",
        "aws",
        "gh",
        "terraform",
        "psql",
        "curl",
        "ssh",
        "ansible",
        "docker",
        "git",
        "bash",
      ],
    },
  },
  comparison: {
    eyebrow: "The honest table",
    title: "We are not for everyone. Here is the proof.",
    subtitle:
      "Tilted in our favor where we win, gray where we do not compete, red where we lose. Read it before you star.",
    headers: ["", "NanoRun", "Rundeck", "StackStorm", "incident.io", "Backstage"],
    rows: [
      {
        feature: "Visual canvas + YAML round-trip",
        cells: ["yes", "no", "no", "partial", "no"],
      },
      {
        feature: "Triggered by alerts (Sentry/Datadog)",
        cells: ["yes", "partial", "yes", "yes", "no"],
      },
      {
        feature: "Sandboxed shell execution",
        cells: ["yes", "yes", "yes", "no", "no"],
      },
      {
        feature: "Replay from any failed step",
        cells: ["yes", "partial", "no", "no", "no"],
      },
      {
        feature: "AI agent on failure (in-context)",
        cells: ["yes", "no", "no", "yes", "no"],
      },
      {
        feature: "Hash-chained audit (verifiable)",
        cells: ["yes", "yes", "partial", "yes", "partial"],
      },
      {
        feature: "Open source license",
        cells: ["AGPL", "Apache", "Apache", "no", "Apache"],
      },
      {
        feature: "Price per seat",
        cells: ["alpha (no)", "$125/mo", "free", "$20–40/mo", "self-host"],
      },
      {
        feature: "Production-ready today",
        cells: ["no", "yes", "no", "yes", "yes"],
      },
    ],
    footnote:
      "We lose on production-readiness today. We are pre-launch alpha. If you need rock-solid, pick Rundeck or incident.io. If you want to influence what the next OSS runbook tool looks like, talk to us.",
    cta: "OK, show me the repo",
  },
  cta: {
    eyebrow: "Self-host",
    pricing: "Free. No card. No tier.",
    title: "Two minutes to your first runbook.",
    subtitle:
      "Clone, run, open the editor at localhost:3000. AGPL forever. No telemetry. No sign-up.",
    code: "git clone https://github.com/Hvelizgr/NanoFlow\ncd NanoFlow && docker compose up",
    primary: "Read the README",
    secondary: "What does NOT work yet",
  },
  footer: {
    tagline: "Open-source runbook automation for alert response.",
    rights: "AGPL-3.0. Built by SREs who got tired of Confluence.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "GitHub", href: "https://github.com/Hvelizgr/NanoFlow" },
          { label: "README", href: "https://github.com/Hvelizgr/NanoFlow#readme" },
          { label: "Templates", href: "https://github.com/Hvelizgr/NanoFlow/tree/main/templates" },
          { label: "Roadmap", href: "https://github.com/Hvelizgr/NanoFlow#roadmap" },
        ],
      },
      {
        title: "Project",
        links: [
          { label: "Contributing", href: "https://github.com/Hvelizgr/NanoFlow/blob/main/CONTRIBUTING.md" },
          { label: "Issues", href: "https://github.com/Hvelizgr/NanoFlow/issues" },
          { label: "Discussions", href: "https://github.com/Hvelizgr/NanoFlow/discussions" },
          { label: "License", href: "https://github.com/Hvelizgr/NanoFlow/blob/main/LICENSE" },
        ],
      },
    ],
  },
  modal: {
    title: "Become a design partner",
    subtitle:
      "Pre-launch alpha. We are looking for 5 SRE / platform teams using NanoRun in earnest. Free for 12 months, weekly office hours, perpetual 50% discount when cloud opens.",
    placeholder: "you@company.com",
    button: "Request a chat",
    processing: "Sending...",
    successTitle: "Got it",
    successDesc: "We will be in touch within 48 hours.",
    successButton: "Close",
  },
};
