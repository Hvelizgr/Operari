export const content = {
  seo: {
    title: "NanoFlow - n8n Governance & Education Platform",
    description: "The missing layer for n8n. Auto-grading for schools, policy enforcement for enterprises, and health checks for developers.",
    openGraph: {
      title: "NanoFlow - Control Your Automation",
      description: "Secure your n8n instances. manage students, enforce policies, and audit execution logs.",
    }
  },
  navigation: {
    product: "Product",
    solutions: "Solutions",
    pricing: "Pricing",
    docs: "Docs",
    login: "Log in",
    getStarted: "Get Started"
  },
  hero: {
    badge: "New: Workflow Doctor 1.0",
    title: "The Governance Layer\nfor n8n Automation.",
    subtitle: "Stop the chaos. Manage students, enforce security policies, and auto-grade workflows on your existing n8n instances.",
    ctaPrimary: "Diagnose My Flows",
    ctaSecondary: "For Schools & Teams"
  },
  editor: {
    title: "Visualize & Audit",
    description: "NanoFlow doesn't just build; it verifies. Our engine scans your n8n JSONs for security risks, bad practices, and grading criteria.",
    nodes: {
      webhook: "Policy Check",
      transform: "Secret Scanner",
      api: "Auto-Grader",
      db: "Audit Log"
    }
  },
  useCases: {
    title: "Who uses NanoFlow?",
    items: [
      {
        title: "Education (Schools)",
        description: "Auto-grade 30 student workflows instantly. Give each student a private secure workspace."
      },
      {
        title: "Enterprise (DevOps)",
        description: "Prevent 'Shadow IT'. Enforce policies like 'No HTTP calls to unknown IPs' before execution."
      },
      {
        title: "Freelancers",
        description: "The 'Workflow Doctor' analyzes your flows for performance bottlenecks and security leaks."
      }
    ]
  },
  howItWorks: {
    title: "How it works",
    steps: [
      {
        title: "Connect",
        description: "Link your existing n8n instance URL and API Key. We don't host it; we manage it."
      },
      {
        title: "Govern",
        description: "Set rules: 'Students can't use Command Line nodes' or 'Require Auth for Webhooks'."
      },
      {
        title: "Execute",
        description: "Users run flows through NanoFlow. We intercept, validate, and then relay to n8n safely."
      }
    ]
  },
  features: {
    headline: "Governance Features",
    subheadline: "The tools n8n Community Edition is missing.",
    items: [
      { title: "Workflow Doctor", description: "Static analysis to detect exposed secrets and loops.", icon: "🩺" },
      { title: "Classroom Mode", description: "Multi-user login and automatic grading for student tasks.", icon: "🎓" },
      { title: "Policy Firewall", description: "Block specific nodes or domains at the gateway level.", icon: "🛡️" },
      { title: "Audit Logs", description: "Trace exactly who executed what and when.", icon: "📜" },
      { title: "Version Snaps", description: "Local history snapshots to rollback mistakes instantly.", icon: "⏪" },
      { title: "SSO Gateway", description: "Login with Google/Microsoft before accessing n8n.", icon: "🔑" }
    ]
  },
  integrations: {
    title: "Works with your Stack",
    subtitle: "Compatible with self-hosted and cloud n8n instances.",
    items: ["n8n", "Docker", "Kubernetes", "Postgres", "Auth0", "Google Workspace", "GitHub", "GitLab"]
  },
  testimonials: {
    title: "Trusted by Educators & CTOs",
    items: [
      { quote: "NanoFlow allowed me to teach n8n to 50 students without them deleting each other's work.", author: "Prof. Sarah Jenkins", role: "Digital Skills Instructor" },
      { quote: "Finally, I can look at the audit logs and see which dev broke production.", author: "Mike Chen", role: "CTO @ TechFlow" },
      { quote: "The Workflow Doctor found an API Key I left exposed in a public repo. Lifesaver.", author: "Elena Rodriguez", role: "Freelance Automator" }
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
    title: "Secure Your Automation",
    subtitle: "Join schools and companies adding a governance layer to their workflows.",
    button: "Start Free Audit"
  },
  modal: {
    title: "Get Governance Access",
    subtitle: "Join the waitlist for the managed governance cloud.",
    placeholder: "work@school.edu",
    button: "Request Early Access",
    processing: "Processing...",
    successTitle: "You're on the list!",
    successDesc: "We'll be in touch shortly.",
    successButton: "Close"
  }
};
