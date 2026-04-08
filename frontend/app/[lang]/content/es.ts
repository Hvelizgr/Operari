export const content = {
  seo: {
    title: "NanoRun — Runbooks visuales para ingenieros",
    description: "Automatización open source de runbooks para equipos SRE y de plataforma. Shell-native, con gates de aprobación, audit-logged. Dejá de esconder deploys en páginas muertas de Confluence.",
    openGraph: {
      title: "NanoRun — Runbooks visuales para ingenieros",
      description: "El Sentry de los procedimientos operativos. Open source, dev-first, AI-native.",
    }
  },
  navigation: {
    product: "Producto",
    solutions: "Casos de uso",
    pricing: "Precios",
    docs: "Docs",
    login: "Ingresar",
    getStarted: "Comenzar"
  },
  hero: {
    badge: "Open source · AGPL · alpha pre-launch",
    title: "Runbooks visuales para ingenieros.",
    subtitle: "Dejá de esconder deploys, migraciones y respuesta a incidentes en wikis muertas de Confluence. Componé runbooks shell-native con gates de aprobación y una cadena de auditoría que se verifica con un comando.",
    ctaPrimary: "Star en GitHub",
    ctaSecondary: "Ver la docs"
  },
  editor: {
    title: "Shell-native, audit-ready, AI-asistido",
    description: "Arrastrá un step shell al canvas. Pipeá su salida a un gate de aprobación. Notificá a Slack cuando termina. Cada paso queda en una cadena append-only verificable con un comando CLI.",
    nodes: {
      webhook: "Trigger por webhook",
      transform: "Set variable",
      api: "HTTP request",
      db: "Query Postgres"
    }
  },
  useCases: {
    title: "Lo que ingenieros corren acá",
    items: [
      {
        title: "Deploys a producción",
        description: "Codificá la secuencia kubectl + helm + smoke tests detrás de un solo botón Run. Los gates de aprobación pausan al on-call."
      },
      {
        title: "Migraciones de base de datos",
        description: "Backup → migrate → verify → notify. Cada paso es shell, cada paso es auditable, cada paso se puede replay."
      },
      {
        title: "Respuesta a incidentes",
        description: "Disparado desde Sentry, Datadog o PagerDuty. Procedimientos pre-armados ejecutan en runners aislados mientras el on-call ve los logs en vivo."
      }
    ]
  },
  howItWorks: {
    title: "De script bash a runbook",
    steps: [
      {
        title: "Componer",
        description: "Arrastrá pasos shell, HTTP, approval gate, notify al canvas. O escribí el YAML directo — las dos vistas quedan sincronizadas."
      },
      {
        title: "Ejecutar",
        description: "Cada paso corre en un runner aislado: Docker en self-host, Firecracker microVMs en cloud. Los logs streamean en vivo vía xterm.js."
      },
      {
        title: "Auditar",
        description: "Cada paso queda en una cadena Postgres append-only con hash SHA-256. `nanorun audit verify` la camina end to end."
      }
    ]
  },
  features: {
    headline: "Pensado para el SRE cansado de Confluence",
    subheadline: "Primitivas shell-native, audit-ready por default.",
    items: [
      { title: "Canvas visual", description: "Componé runbooks paso a paso. Toggle a YAML para versionar en git.", icon: "🧱" },
      { title: "Runners aislados", description: "Docker para self-host, Firecracker microVMs para cloud. El cancel se propaga a los containers vivos.", icon: "📦" },
      { title: "Agente AI in-context", description: "¿Falló un paso? El agente lee los últimos 5 outputs y sugiere el fix.", icon: "🤖" },
      { title: "Gates de aprobación", description: "Pausá hasta que un humano apruebe vía Slack o CLI. Cada aprobación queda en la cadena de auditoría.", icon: "🚦" },
      { title: "Audit tamper-evident", description: "Postgres append-only con hash chain SHA-256. Verificable desde un solo comando CLI.", icon: "🔐" },
      { title: "Open source", description: "AGPL para el server, MIT para SDK y CLI. Self-host con `docker compose up`.", icon: "📂" }
    ]
  },
  integrations: {
    title: "Disparadores del stack que ya usás",
    subtitle: "Cualquier webhook HTTP con HMAC dispara un runbook. El paso shell llama directo a kubectl / helm / aws / gh / psql — sin plugin por herramienta.",
    items: ["GitHub", "Slack", "Sentry", "Datadog", "Webhook genérico", "+ cualquier cosa que llames desde bash"]
  },
  testimonials: {
    title: "Buscando design partners",
    items: [
      {
        quote: "NanoRun está en alpha pre-launch. Estamos reclutando 5 equipos SRE / platform engineering que mantengan procedimientos de deploy, migraciones, rotación de secrets o respuesta a incidentes hoy y quieran una mejor herramienta. Los design partners reciben el producto gratis 12 meses, office hours semanales con el founder, prioridad en feature requests y descuento perpetuo del 50% cuando abra cloud.",
        author: "Invitación abierta",
        role: "Escribinos al maintainer o abrí una GitHub discussion"
      }
    ]
  },
  footer: {
    rights: "Todos los derechos reservados.",
    links: {
      product: "Producto",
      company: "Compañía",
      legal: "Legal"
    }
  },
  cta: {
    title: "Dejá de correr deploys desde una página de Confluence.",
    subtitle: "Self-host con `docker compose up`. Gratis para siempre. Open source.",
    button: "Bajar NanoRun"
  },
  modal: {
    title: "Convertite en design partner",
    subtitle: "Alpha pre-launch. Estamos buscando 5 equipos SRE / platform que usen NanoRun en serio. Gratis 12 meses, office hours semanales, descuento perpetuo del 50% cuando abra cloud.",
    placeholder: "vos@empresa.com",
    button: "Pedir una charla",
    processing: "Enviando...",
    successTitle: "Listo",
    successDesc: "Te escribimos en las próximas 48 horas.",
    successButton: "Cerrar"
  }
};
