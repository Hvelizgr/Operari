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
    badge: "Open source · AGPL · v0.1",
    title: "Runbooks visuales para ingenieros.",
    subtitle: "Dejá de esconder deploys, migraciones y respuesta a incidentes en wikis muertas de Confluence. Componé runbooks shell-native con gates de aprobación y una cadena de auditoría que se verifica con un comando.",
    ctaPrimary: "Self-host gratis",
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
    title: "Se enchufa al stack que ya usás",
    subtitle: "Disparable desde cualquier webhook HTTP con verificación HMAC.",
    items: ["GitHub", "Slack", "Sentry", "Datadog", "PagerDuty", "Postgres", "Docker", "Kubernetes"]
  },
  testimonials: {
    title: "Lo que dicen los design partners",
    items: [
      { quote: "Reemplazamos nuestra página de deploy en Confluence con un runbook NanoRun en una tarde. El gate de aprobación por Slack es el killer feature.", author: "Sarah Jenkins", role: "Staff SRE @ TechFlow" },
      { quote: "Por fin una herramienta que trata a `kubectl` como ciudadano de primera en vez de esconderlo detrás de 'bloques visuales'.", author: "Mike Chen", role: "Platform Lead" },
      { quote: "La cadena de auditoría nos salvó en el review de SOC2. El auditor corrió `nanorun audit verify` y listo.", author: "Elena Rodriguez", role: "Head of Platform" }
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
    title: "Sumate al cloud beta",
    subtitle: "Te mandamos invitación cuando abramos el cloud manejado. Self-host está disponible hoy.",
    placeholder: "vos@empresa.com",
    button: "Pedir invitación",
    processing: "Enviando...",
    successTitle: "Quedaste en la lista",
    successDesc: "Te avisamos cuando abra el cloud beta.",
    successButton: "Cerrar"
  }
};
