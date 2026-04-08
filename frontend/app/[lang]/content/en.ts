export const content = {
  seo: {
    title: "NanoRun — Visual runbooks for engineers",
    description: "Open-source runbook automation for SRE and platform teams. Shell-native, approval-gated, audit-logged. Stop hiding deploys in dead Confluence pages.",
    openGraph: {
      title: "NanoRun — Visual runbooks for engineers",
      description: "The Sentry for operational procedures. Open source, dev-first, AI-native.",
    }
  },
  navigation: {
    product: "Product",
    solutions: "Use cases",
    pricing: "Pricing",
    docs: "Docs",
    login: "Log in",
    getStarted: "Get started"
  },
  hero: {
    badge: "Open source · AGPL · pre-launch alpha",
    title: "Visual runbooks for engineers.",
    subtitle: "Stop hiding deploys, migrations, and incident response in dead Confluence wikis. Compose shell-native runbooks with approval gates and an audit chain you can verify with one CLI command.",
    ctaPrimary: "Star on GitHub",
    ctaSecondary: "Read the docs"
  },
  editor: {
    title: "Shell-native, audit-ready, AI-assisted",
    description: "Drag a shell step onto the canvas. Pipe its output to an approval gate. Notify Slack when it ships. Every step logged in an append-only chain you can verify with one CLI command.",
    nodes: {
      webhook: "Webhook trigger",
      transform: "Set variable",
      api: "HTTP request",
      db: "Postgres query"
    }
  },
  useCases: {
    title: "What engineers run on it",
    items: [
      {
        title: "Production deploys",
        description: "Codify the kubectl, helm, and smoke-test sequence behind a single Run button. Approval gates pause for the on-call engineer."
      },
      {
        title: "Database migrations",
        description: "Backup → migrate → verify → notify. Every step is shell, every step is auditable, every step is replayable."
      },
      {
        title: "Incident response runbooks",
        description: "Triggered by Sentry, Datadog, or PagerDuty. Pre-built procedures execute under tenant-isolated runners while the on-call gets logs in real time."
      }
    ]
  },
  howItWorks: {
    title: "From bash script to runbook",
    steps: [
      {
        title: "Compose",
        description: "Drag shell, HTTP, approval gate, and notify steps onto the canvas. Or write the YAML directly — both views stay in sync."
      },
      {
        title: "Run",
        description: "Each step executes in a sandboxed runner: Docker for self-host, Firecracker microVMs for cloud. Logs stream live via xterm.js."
      },
      {
        title: "Audit",
        description: "Every step lands in an append-only Postgres log with a SHA-256 hash chain. `nanorun audit verify` walks the chain end to end."
      }
    ]
  },
  features: {
    headline: "Built for the SRE who's tired of Confluence",
    subheadline: "Shell-native primitives, audit-ready by default.",
    items: [
      { title: "Visual canvas", description: "Compose runbooks step by step. Toggle to YAML for git versioning.", icon: "🧱" },
      { title: "Sandboxed runners", description: "Docker for self-host, Firecracker microVMs for cloud. Cancel propagates to live containers.", icon: "📦" },
      { title: "AI agent in-context", description: "Step fails? The agent reads the last 5 step outputs and suggests the fix.", icon: "🤖" },
      { title: "Approval gates", description: "Pause until a human approves via Slack or the CLI. Every approval lands in the audit chain.", icon: "🚦" },
      { title: "Tamper-evident audit", description: "Append-only Postgres log with SHA-256 hash chain. Verifiable from one CLI command.", icon: "🔐" },
      { title: "Open source", description: "AGPL server, MIT SDK and CLI. Self-host with `docker compose up`.", icon: "📂" }
    ]
  },
  integrations: {
    title: "Triggers from the stack you already use",
    subtitle: "Any HTTP webhook with HMAC verification can start a runbook. The shell step calls kubectl / helm / aws / gh / psql directly — no per-tool plugin to install.",
    items: ["GitHub", "Slack", "Sentry", "Datadog", "Generic webhook", "+ anything you can call from bash"]
  },
  testimonials: {
    title: "Looking for design partners",
    items: [
      {
        quote: "NanoRun is in pre-launch alpha. We are recruiting 5 SRE / platform-engineering teams who maintain deploy procedures, migrations, secret rotation, or incident response runbooks today and want a better tool. Design partners get the product free for 12 months, weekly office hours with the founder, priority on feature requests, and a perpetual 50% discount when cloud opens.",
        author: "Open invitation",
        role: "Email the maintainer or open a GitHub discussion"
      }
    ]
  },
  footer: {
    rights: "All rights reserved.",
    links: {
      product: "Product",
      company: "Company",
      legal: "Legal"
    }
  },
  cta: {
    title: "Stop running deploys from a Confluence page.",
    subtitle: "Self-host with `docker compose up`. Free forever. Open source.",
    button: "Get NanoRun"
  },
  modal: {
    title: "Become a design partner",
    subtitle: "Pre-launch alpha. We are looking for 5 SRE / platform teams using NanoRun in earnest. Free for 12 months, weekly office hours, perpetual 50% discount when cloud opens.",
    placeholder: "you@company.com",
    button: "Request a chat",
    processing: "Sending...",
    successTitle: "Got it",
    successDesc: "We will be in touch within 48 hours.",
    successButton: "Close"
  }
};
