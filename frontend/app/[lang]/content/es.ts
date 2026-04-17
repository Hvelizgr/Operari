import { repo } from '@/config/repo.config';

export const content = {
  seo: {
    title: "NanoRun — La capa de acción para tus alertas",
    description:
      "Salta la alarma a las 3 de la mañana. NanoRun apaga el fuego. Runbooks visuales open source disparados por Datadog, Sentry, GitHub, PagerDuty, Grafana o cualquier webhook. Self-host con un comando.",
    openGraph: {
      title: "NanoRun — Salta la alarma. NanoRun apaga el fuego.",
      description:
        "Automatización open source de runbooks para responder a alertas. Visual para escribir, YAML para commitear, sandbox para ejecutar, auditado para probar.",
    },
  },
  navigation: {
    product: "Producto",
    docs: "Docs",
    github: "GitHub",
    login: "Entrar",
    getStarted: "Obtener API key",
  },
  hero: {
    badge: "API · alpha pre-lanzamiento",
    title: "Runbooks como\nuna API.",
    subtitle:
      "Disparás un runbook de producción con un único HTTP call. Cada step corre en un runner aislado, cada acción queda firmada en una cadena de auditoría, y la respuesta vuelve en menos de 300 ms.",
    ctaPrimary: "Obtener API key",
    ctaSecondary: "o self-host",
    scenario: {
      requestMethod: "POST",
      requestUrl: "/api/v1/runs/trigger",
      requestLabel: "Request",
      requestLines: [
        "curl -X POST https://api.cairn.run/v1/runs/trigger \\",
        "  -H \"Authorization: Bearer sk_live_…\" \\",
        "  -H \"Content-Type: application/json\" \\",
        "  -d '{\"runbook\": \"rollback-last-deploy\",",
        "       \"vars\": {\"service\": \"api\"}}'",
      ],
      responseLabel: "Response",
      responseStatus: "201 Created · 284 ms",
      responseBody: [
        "{",
        "  \"run_id\": \"run_3f9c2b7a\",",
        "  \"status\": \"running\",",
        "  \"steps\": 4,",
        "  \"audit_hash\": \"3f9c…b2e1\",",
        "  \"stream\": \"wss://api.cairn.run/v1/runs/run_3f9c2b7a/stream\"",
        "}",
      ],
      streamLabel: "Stream",
      streamSteps: [
        "▸ traer logs del servicio (kubectl)",
        "▸ rollback del último deploy (helm)",
        "▸ publicar status en #incidents",
        "▸ abrir ticket en Linear",
      ],
      streamFooter: "run completado · 4/4 steps · cadena de auditoría verificada",
    },
  },
  story: {
    eyebrow: "Cómo funciona",
    title: "Tres cosas, una sola herramienta.",
    subtitle:
      "Las otras herramientas del rubro eligen una y pierden el resto. NanoRun hace las tres porque ninguna funciona sola.",
    blocks: [
      {
        number: "01",
        title: "Escribí el runbook visualmente.",
        description:
          "Arrastrá un step de shell. Conectá su salida a un gate de aprobación. Ramificá con un condicional. El canvas y el YAML están sincronizados — no hay archivo de config aparte, no hay dos fuentes de verdad.",
        caption: "Arrastrar, soltar, guardar. Eso es un runbook.",
      },
      {
        number: "02",
        title: "Commiteá el YAML.",
        description:
          "Cada runbook hace round-trip entre el editor visual y un archivo YAML que commiteás a git. Hacé code-review como con cualquier otra infraestructura. Validá contra el JSON Schema publicado. Revertí con `git revert`.",
        caption: "Versionado. Revisable. Se revierte como código.",
      },
      {
        number: "03",
        title: "La alerta dispara → corre → la cadena de auditoría lo prueba.",
        description:
          "Webhook entra, runbook sale. Cada step corre en un runner sandboxeado con retries, gates condicionales y aprobación humana donde la quieras. Toda acción cae en una cadena hash SHA-256 verificable con `nanorun audit verify`.",
        caption: "De la alerta a la evidencia, en una sola herramienta.",
      },
    ],
  },
  templates: {
    eyebrow: "Templates",
    title: "Runbooks reales. Shell real. Leelos.",
    subtitle:
      "Cada template viene en el repo como YAML commiteable. Abrí uno, copialo, cambiá dos variables, corrélo. Sin DSL, sin plugins.",
    items: [
      {
        slug: "respond-to-sentry-alert",
        category: "respuesta a incidente",
        title: "Responder a una alerta de Sentry",
        description:
          "El runbook que promete el hero. Webhook entra, traer logs, gate de aprobación, helm rollback, notificar #incidents, abrir ticket de post-mortem.",
        accent: "violet",
      },
      {
        slug: "k8s-rolling-deploy",
        category: "deploy",
        title: "Rolling deploy en Kubernetes",
        description:
          "kubectl set image, mirar el rollout, smoke test de los pods, notificar Slack al terminar. El runbook de CI que todo equipo reescribe en bash.",
        accent: "primary",
      },
      {
        slug: "rotate-aws-secrets",
        category: "seguridad",
        title: "Rotar secrets de AWS IAM",
        description:
          "Crear nueva key, propagar a Vercel y GitHub, gate de aprobación humana, verificar, después revocar la vieja. Auditable end to end.",
        accent: "amber",
      },
      {
        slug: "db-migration-prisma",
        category: "datos",
        title: "Migración Prisma con backup",
        description:
          "Snapshot de la base, correr las migraciones pendientes, verificar con un row count, notificar Slack. Una aprobación humana antes del paso destructivo.",
        accent: "emerald",
      },
    ],
    cta: "Ver todos los templates en GitHub",
  },
  triggers: {
    eyebrow: "Fuentes de trigger",
    title: "Cualquier cosa que haga POST de JSON puede iniciar un runbook.",
    subtitle:
      "Verificación HMAC built-in para los proveedores que ya pagás. Webhook genérico para todo lo demás.",
    items: [
      {
        name: "Datadog",
        description:
          "Monitor alerts, detección de anomalías, SLO burns. Payload mapeado a variables del runbook.",
        status: "ready",
      },
      {
        name: "Sentry",
        description:
          "Alertas de issues, detección de regresiones, degradación de performance. HMAC verificado, parseado automático.",
        status: "ready",
      },
      {
        name: "GitHub",
        description:
          "Workflows fallidos, eventos de deploy, security advisories. Validación de webhook firmado.",
        status: "ready",
      },
      {
        name: "Webhook genérico",
        description:
          "Cualquier HTTP POST con JSON. Traé tu propio HMAC. PagerDuty, Grafana, OpsGenie, custom — mismo camino.",
        status: "ready",
      },
    ],
    callsAnything: {
      title: "Y cada step llama herramientas reales.",
      subtitle:
        "Sin DSL. Sin plugins por herramienta. Los steps corren como shell — cualquier cosa que tipearías en una terminal funciona desde el día 1.",
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
    eyebrow: "La tabla honesta",
    title: "No somos para todos. Acá la prueba.",
    subtitle:
      "Inclinada a nuestro favor donde ganamos, gris donde no competimos, roja donde perdemos. Leela antes de star.",
    headers: ["", "NanoRun", "Rundeck", "StackStorm", "incident.io", "Backstage"],
    rows: [
      {
        feature: "Canvas visual + round-trip YAML",
        cells: ["sí", "no", "no", "parcial", "no"],
      },
      {
        feature: "Disparado por alertas (Datadog/Sentry/PagerDuty)",
        cells: ["sí", "parcial", "sí", "sí", "no"],
      },
      {
        feature: "Ejecución de shell sandboxeada",
        cells: ["sí", "sí", "sí", "no", "no"],
      },
      {
        feature: "Replay desde cualquier step fallido",
        cells: ["sí", "sí", "no", "no", "no"],
      },
      {
        feature: "Agente IA al fallar (en contexto)",
        cells: ["sí", "no", "no", "parcial", "no"],
      },
      {
        feature: "Auditoría hash-chained (verificable)",
        cells: ["sí", "parcial", "parcial", "parcial", "no"],
      },
      {
        feature: "Licencia open source",
        cells: ["AGPL", "Apache", "Apache", "no", "Apache"],
      },
      {
        feature: "Precio por usuario",
        cells: ["alpha (no)", "$125/mes", "gratis", "$20–40/mes", "self-host"],
      },
      {
        feature: "Production-ready hoy",
        cells: ["no", "sí", "no", "sí", "sí"],
      },
    ],
    footnote:
      "Perdemos en production-readiness hoy. Estamos en alpha pre-launch. Si necesitás algo sólido como una roca, agarrá Rundeck o incident.io. Si querés influir en cómo se ve la próxima herramienta OSS de runbooks, hablanos.",
    cta: "OK, dame el repo",
  },
  cta: {
    eyebrow: "Self-host",
    pricing: "Gratis. Sin tarjeta. Sin tiers.",
    title: "Dos minutos hasta tu primer runbook.",
    subtitle:
      "Cloná, corré, abrí el editor en localhost:3000. AGPL para siempre. Sin telemetría. Sin sign-up.",
    code: repo.cloneSnippet,
    primary: "Leer el README",
    secondary: "Qué NO funciona todavía",
  },
  footer: {
    tagline: "Automatización open source de runbooks para responder alertas.",
    rights: "AGPL-3.0. Hecho por SREs que se cansaron de Confluence.",
    columns: [
      {
        title: "Producto",
        links: [
          { label: "Precios", href: "/pricing" },
          { label: "GitHub", href: repo.base },
          { label: "Templates", href: repo.templatesTree },
          { label: "Roadmap", href: repo.roadmap },
        ],
      },
      {
        title: "Recursos",
        links: [
          { label: "Docs", href: repo.readme },
          { label: "Changelog", href: "/changelog" },
          { label: "Contribuir", href: repo.contributing },
          { label: "Contacto", href: "/contact" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Seguridad", href: "/security" },
          { label: "Privacidad", href: "/privacy" },
          { label: "Términos", href: "/terms" },
          { label: "Licencia", href: repo.license },
        ],
      },
    ],
  },
  pricing: {
    eyebrow: "Precios",
    title: "Self-host gratis. Cloud cuando quieras.",
    subtitle:
      "Todo el producto, AGPL, self-hosted para siempre. Cloud es para equipos que no quieren correr un Postgres. Elegí una vez; cambiás después.",
    badge: "Cloud está en waitlist — self-host disponible hoy.",
    billingYearly: "Facturado anual (20% off)",
    billingMonthly: "Facturado mensual",
    perMonth: "/mes",
    perUserMonth: "/usuario/mes",
    contactSales: "Hablar con ventas",
    getStarted: "Self-host ahora",
    popular: "Más elegido",
    tiers: [
      {
        id: "self-host",
        name: "Self-host",
        price: "$0",
        priceYearly: "$0",
        period: "para siempre",
        description: "Docker compose, tu servidor, tus datos. AGPL para siempre.",
        features: [
          "Runbooks ilimitados",
          "Runs ilimitados",
          "Webhooks ilimitados",
          "Todas las fuentes de trigger",
          "Verificación de cadena de auditoría",
          "Ejecución de shell sandboxeada",
          "Discord de la comunidad",
        ],
        cta: "Self-host ahora",
        ctaHref: "#docker",
        highlighted: false,
      },
      {
        id: "team",
        name: "Team",
        price: "$19",
        priceYearly: "$15",
        period: "/usuario/mes",
        description: "Nosotros corremos el Postgres. Vos corrés los runbooks.",
        features: [
          "Todo lo de Self-host",
          "Postgres gestionado + backups",
          "Notificaciones Slack/Teams",
          "SSO (Google, Microsoft)",
          "Retención de runs 14 días",
          "Soporte por email · SLA 24h",
          "Ingest webhook prioritario",
        ],
        cta: "Unirse al waitlist",
        ctaHref: "/contact",
        highlighted: true,
      },
      {
        id: "business",
        name: "Business",
        price: "$49",
        priceYearly: "$39",
        period: "/usuario/mes",
        description: "Para equipos de plataforma que necesitan audit + SAML.",
        features: [
          "Todo lo de Team",
          "SAML SSO + SCIM",
          "Export de audit log (SIEM)",
          "Control de acceso por rol",
          "Retención de runs 1 año",
          "SLA 99.9%",
          "Canal dedicado de Slack",
        ],
        cta: "Unirse al waitlist",
        ctaHref: "/contact",
        highlighted: false,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        price: "A medida",
        priceYearly: "A medida",
        period: "",
        description: "On-prem, air-gapped, FedRAMP-track. Hablemos.",
        features: [
          "Todo lo de Business",
          "Self-host + cloud híbrido",
          "Compliance custom (SOC2, HIPAA)",
          "Deploy air-gapped",
          "Retención de runs ilimitada",
          "SLA 99.99% · CSM dedicado",
          "Source escrow",
        ],
        cta: "Hablar con ventas",
        ctaHref: "/contact",
        highlighted: false,
      },
    ],
    comparison: {
      title: "Compará cada plan",
      groups: [
        {
          name: "Core",
          rows: [
            { feature: "Runbooks", values: ["Ilimitados", "Ilimitados", "Ilimitados", "Ilimitados"] },
            { feature: "Historial de runs", values: ["Ilimitado (tu DB)", "14 días", "1 año", "A medida"] },
            { feature: "Webhooks", values: ["Ilimitados", "Ilimitados", "Ilimitados", "Ilimitados"] },
            { feature: "Shell sandboxeado", values: ["sí", "sí", "sí", "sí"] },
          ],
        },
        {
          name: "Seguridad",
          rows: [
            { feature: "Verify HMAC webhook", values: ["sí", "sí", "sí", "sí"] },
            { feature: "Cadena de hash audit", values: ["sí", "sí", "sí", "sí"] },
            { feature: "SSO (Google/MS)", values: ["no", "sí", "sí", "sí"] },
            { feature: "SAML + SCIM", values: ["no", "no", "sí", "sí"] },
            { feature: "Export audit log", values: ["no", "no", "sí", "sí"] },
            { feature: "Deploy air-gapped", values: ["sí", "no", "no", "sí"] },
          ],
        },
        {
          name: "Soporte",
          rows: [
            { feature: "Discord comunidad", values: ["sí", "sí", "sí", "sí"] },
            { feature: "SLA email", values: ["—", "24h", "4h", "1h"] },
            { feature: "Canal dedicado", values: ["no", "no", "sí", "sí"] },
            { feature: "SLA uptime", values: ["—", "—", "99.9%", "99.99%"] },
          ],
        },
      ],
    },
    faq: {
      title: "Preguntas sobre precios",
      items: [
        {
          q: "¿Self-host es realmente gratis para siempre?",
          a: "Sí. AGPL-3.0, sin trampas. El mismo binario que corremos en cloud corre en tu servidor. No hay feature flags escondiendo cosas detrás de un tier pago.",
        },
        {
          q: "¿Qué cuenta como usuario?",
          a: "Cualquiera que loguea. Webhooks, triggers y ejecuciones no cuentan como usuarios — solo humanos con cuenta.",
        },
        {
          q: "¿Puedo cambiar de Cloud a Self-host (o al revés) después?",
          a: "Sí. Cada runbook es YAML en git. Cada run está auditado con SHA-256. Los datos son portables por diseño — exportás un cloud instance a self-host con un comando.",
        },
        {
          q: "¿Hay descuento para OSS / startups?",
          a: "Self-host ya es gratis. Para Team/Business damos 50% off a non-profits registradas y startups con fondeo YC/Sequoia/Index en su primer año. Escribinos.",
        },
        {
          q: "¿Cuándo sale Cloud GA?",
          a: "Abrimos Cloud a cohorts del waitlist cada 2 semanas. Alpha pre-launch ahora — GA esperado Q3 2026.",
        },
      ],
    },
  },
  changelog: {
    eyebrow: "Changelog",
    title: "Qué se envió, cuándo y por qué.",
    subtitle: "Versionado, fechado, honesto. Sin reescrituras de marketing.",
    entries: [
      {
        date: "2026-04-10",
        version: "v0.6.0",
        tag: "feature",
        title: "Write tools opt-in del agente de aprobación",
        body: "El agente IA en contexto ahora puede otorgar o rechazar gates de aprobación cuando el operador lo habilita. Default read-only — write access es por runbook.",
      },
      {
        date: "2026-04-02",
        version: "v0.5.2",
        tag: "refactor",
        title: "Rename workflow → runbook (fase 2b)",
        body: "Tablas de DB, modelos Prisma y superficie de API migraron de workflow_* a runbook_*. Shim de compat eliminado; migrá con el script incluido.",
      },
      {
        date: "2026-03-28",
        version: "v0.5.1",
        tag: "sdk",
        title: "SDK público renombrado: NanoRun → Cairn",
        body: "Los SDKs de Python y TypeScript ahora exportan clases Cairn. NanoRun sigue siendo el nombre del producto; Cairn es el namespace del library.",
      },
      {
        date: "2026-03-14",
        version: "v0.5.0",
        tag: "feature",
        title: "Webhook GitHub + payload firmado",
        body: "Fuente de trigger nativa de GitHub con validación de webhook firmado. Cableás un workflow fallido a un runbook de rollback en 30 segundos.",
      },
      {
        date: "2026-02-22",
        version: "v0.4.0",
        tag: "feature",
        title: "Cadena de auditoría hash-chained",
        body: "Cada step cae en una cadena SHA-256. `nanorun audit verify` reejecuta la cadena entera; tampering se detecta determinísticamente.",
      },
    ],
  },
  security: {
    title: "Seguridad",
    subtitle: "Cómo manejamos secrets, datos e incidentes.",
    updated: "Última actualización: 2026-04-01",
    sections: [
      {
        heading: "Reportar una vulnerabilidad",
        body: "Email a security@nanorun.dev con mensaje cifrado PGP. Acusamos recibo en 24h, triage en 72h. Política de disclosure en SECURITY.md del repo.",
      },
      {
        heading: "Sandboxing",
        body: "Cada step de shell corre en un container con rootfs fresco, sin mount del host, sin egress de red a menos que se declare. El runner aplica límites CPU/memoria/wall-clock por step.",
      },
      {
        heading: "Secrets",
        body: "Los secrets en runtime nunca tocan disco. Se inyectan al proceso del step vía env vars desde un store respaldado por KMS. Logs se redactan al escribir, no al ver.",
      },
      {
        heading: "Cadena de auditoría",
        body: "I/O de cada step se hashea con SHA-256 y se encadena. Verificás un run end-to-end con `nanorun audit verify`. Tampering rompe la cadena determinísticamente.",
      },
      {
        heading: "Residencia de datos (Cloud)",
        body: "Cloud default en us-east-1. Planes Team+ pueden elegir eu-west-1 o ap-southeast-1 al provisionar. Sin replicación cross-region sin opt-in explícito.",
      },
      {
        heading: "Compliance",
        body: "SOC 2 Type I en curso (objetivo Q4 2026). HIPAA en tier Business con BAA. GDPR/CCPA compliant por diseño. FedRAMP Moderate trackeado para 2027.",
      },
    ],
  },
  subprocessors: {
    title: "Subprocesadores",
    subtitle: "Terceros que manejan datos en nuestro nombre. Actualizado cada vez que agregamos o sacamos uno.",
    updated: "Última actualización: 2026-04-01",
    intro:
      "Mantenemos la lista corta a propósito. Cada subprocesador está atado contractualmente con DPAs y solo procesa los datos que le pasamos explícitamente.",
    entries: [
      {
        name: "Amazon Web Services (AWS)",
        purpose: "Hosting — EC2, RDS Postgres, S3, CloudWatch",
        region: "us-east-1 (default), eu-west-1 / ap-southeast-1 opt-in",
        dataTypes: "Todos los datos del cliente (runbooks, runs, logs)",
      },
      {
        name: "Stripe",
        purpose: "Facturación — suscripción + facturas",
        region: "Estados Unidos + Irlanda",
        dataTypes: "Email de billing, empresa, token del método de pago",
      },
      {
        name: "Postmark",
        purpose: "Email transaccional — aprobaciones, fallos de runs",
        region: "Estados Unidos",
        dataTypes: "Email del destinatario, metadata del run",
      },
      {
        name: "Cloudflare",
        purpose: "DNS + WAF + CDN para sitio de marketing",
        region: "Global",
        dataTypes: "Logs anónimos de requests (sin cookies)",
      },
      {
        name: "Plausible",
        purpose: "Analytics privacy-first para marketing",
        region: "Alemania (UE)",
        dataTypes: "Page views agregados (sin datos personales)",
      },
      {
        name: "Sentry",
        purpose: "Monitoreo de errores (solo cloud build)",
        region: "Estados Unidos",
        dataTypes: "Stack traces, user ID anonimizado",
      },
    ],
    notice: "Aviso de cambios: avisamos a clientes registrados con al menos 30 días antes de activar un subprocesador nuevo.",
  },
  privacy: {
    title: "Privacidad",
    subtitle: "Qué guardamos, qué hacemos con eso y qué nos negamos a hacer.",
    updated: "Última actualización: 2026-04-01",
    sections: [
      {
        heading: "Self-host: cero telemetría",
        body: "Self-host no nos manda nada. Sin pings, sin contadores de uso, sin reportes de crash a menos que habilites explícitamente el flag NANORUN_TELEMETRY.",
      },
      {
        heading: "Cloud: solo datos operacionales",
        body: "Guardamos lo necesario para correr el servicio: tu email, tus runbooks, tu historial de runs y el billing. Nunca leemos el contenido de tu runbook por ningún motivo fuera de ejecutarlo.",
      },
      {
        heading: "Analytics",
        body: "El sitio de marketing usa analytics privacy-first (Plausible). Sin cookies, sin cross-site tracking. Podés bloquearlo sin romper nada.",
      },
      {
        heading: "Eliminación de datos",
        body: "Eliminás tu cuenta y todo se va en 30 días, incluidos backups. Export de datos disponible como tarball JSON + YAML desde settings.",
      },
      {
        heading: "Terceros",
        body: "Stripe para billing. AWS para hosting. Postmark para email transaccional. Lista completa en nanorun.dev/subprocessors.",
      },
    ],
  },
  terms: {
    title: "Términos del servicio",
    subtitle: "Las reglas del camino.",
    updated: "Última actualización: 2026-04-01",
    sections: [
      {
        heading: "Licencia self-host",
        body: "Self-host es AGPL-3.0. Si lo corrés como servicio, tenés que liberar el source de tus modificaciones. Texto completo en github.com.",
      },
      {
        heading: "Suscripción Cloud",
        body: "Mes a mes o anual. Cancelás cuando quieras; refunds prorrateados en anual. Precios pueden cambiar con aviso de 60 días. Pricing grandfather bajo pedido para los primeros 100 clientes.",
      },
      {
        heading: "Uso aceptable",
        body: "No uses NanoRun para atacar sistemas que no son tuyos, exfiltrar datos que no controlás o correr mineros de cripto. Todo lo demás juego limpio.",
      },
      {
        heading: "Garantía",
        body: "Self-host se entrega as-is. Cloud se entrega con el SLA de tu plan. Responsabilidad hasta 12 meses de fees pagados en los 12 meses previos al reclamo.",
      },
      {
        heading: "Jurisdicción",
        body: "Delaware, USA. Disputas van a arbitraje JAMS antes que corte. Sin class actions.",
      },
    ],
  },
  contact: {
    title: "Hablanos.",
    subtitle:
      "Leemos todo. Alpha pre-launch, así que somos los humanos construyendo el producto — no hay ticket queue.",
    channels: [
      {
        name: "Abrir un issue",
        description: "Bugs y pedidos de features.",
        href: "issues",
        action: "GitHub issues",
      },
      {
        name: "Discussions",
        description: "Preguntas, ideas y how-tos de la comunidad.",
        href: "discussions",
        action: "Abrir discussions",
      },
      {
        name: "Seguridad",
        description: "Vulnerabilidades. PGP cifrado, ack 24h.",
        href: "mailto:security@nanorun.dev",
        action: "security@nanorun.dev",
      },
      {
        name: "Ventas",
        description: "Business, Enterprise y on-prem.",
        href: "mailto:hello@nanorun.dev",
        action: "hello@nanorun.dev",
      },
    ],
    form: {
      title: "O mandanos una nota",
      name: "Tu nombre",
      email: "Email laboral",
      company: "Empresa",
      message: "¿Qué tenés en mente?",
      submit: "Enviar",
      sending: "Enviando...",
      sent: "Recibido. Respondemos en 48 horas.",
    },
  },
  modal: {
    title: "Sé un design partner",
    subtitle:
      "Alpha pre-lanzamiento. Buscamos 5 equipos de SRE / plataforma usando NanoRun en serio. Gratis para siempre en self-host, office hours semanales, línea directa con la gente que lo está construyendo.",
    placeholder: "vos@empresa.com",
    button: "Pedir un chat",
    processing: "Enviando...",
    successTitle: "Listo",
    successDesc: "Te contactamos en 48 horas.",
    successButton: "Cerrar",
  },
};
