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
    badge: "Open source · AGPL · v0.1",
    title: "Visual runbooks for engineers.",
    subtitle: "Stop hiding deploys, migrations, and incident response in dead Confluence wikis. Compose shell-native runbooks with approval gates and an audit chain you can verify with one CLI command.",
    ctaPrimary: "Run self-host",
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
    title: "Plugs into the stack you already use",
    subtitle: "Trigger from any HTTP webhook with HMAC verification.",
    items: ["GitHub", "Slack", "Sentry", "Datadog", "PagerDuty", "Postgres", "Docker", "Kubernetes"]
  },
  testimonials: {
    title: "What design partners say",
    items: [
      { quote: "Replaced our Confluence deploy page with a NanoRun runbook in an afternoon. The Slack approval gate is the killer feature.", author: "Sarah Jenkins", role: "Staff SRE @ TechFlow" },
      { quote: "Finally a tool that treats `kubectl` as a first-class citizen instead of hiding it behind 'visual blocks'.", author: "Mike Chen", role: "Platform Lead" },
      { quote: "Audit chain saved us in our SOC2 review. Auditor ran `nanorun audit verify` and we were done.", author: "Elena Rodriguez", role: "Head of Platform" }
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
    title: "Join the cloud beta",
    subtitle: "We'll send an invite when the managed cloud opens. Self-host is available today.",
    placeholder: "you@company.com",
    button: "Request invite",
    processing: "Sending...",
    successTitle: "You're on the list",
    successDesc: "We'll be in touch when cloud beta opens.",
    successButton: "Close"
  }
};
