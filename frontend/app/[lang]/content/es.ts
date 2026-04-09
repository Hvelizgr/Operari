export const content = {
  seo: {
    title: "NanoRun — La capa de acción para tus alertas",
    description:
      "Sentry detecta el fuego a las 3 de la mañana. NanoRun lo apaga. Runbooks visuales open source que responden a alertas de Sentry, Datadog, GitHub o cualquier webhook. Self-host con un comando.",
    openGraph: {
      title: "NanoRun — Sentry lo detecta. NanoRun lo arregla.",
      description:
        "Automatización open source de runbooks para responder a alertas. Visual para escribir, YAML para commitear, sandbox para ejecutar, auditado para probar.",
    },
  },
  navigation: {
    product: "Producto",
    docs: "Docs",
    github: "GitHub",
    login: "Entrar",
    getStarted: "Self-host",
  },
  hero: {
    badge: "Open source · AGPL · alpha pre-lanzamiento",
    title: "Sentry lo detecta.\nNanoRun lo arregla.",
    subtitle:
      "Runbooks open source que responden a tus alertas. Visuales para escribir, YAML para commitear, sandbox para ejecutar, auditados para probar.",
    ctaPrimary: "docker compose up",
    ctaSecondary: "Star en GitHub",
    scenario: {
      step1Label: "1. Alerta de Sentry",
      step1Body: "TypeError: Cannot read 'user' of undefined",
      step2Label: "2. Webhook → NanoRun",
      step2Body: "POST /api/webhooks/sentry  ✓ HMAC verificado",
      step3Label: "3. Runbook ejecutándose",
      step3Steps: [
        "traer logs del servicio (kubectl)",
        "rollback del último deploy (helm)",
        "publicar status en #incidents",
        "abrir ticket en Linear",
      ],
      step4Label: "4. Resuelto · 47s",
      step4Body: "Hash de auditoría: 3f9c…b2e1 · 4 pasos verificados",
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
        title: "Sentry dispara → corre → la cadena de auditoría lo prueba.",
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
        name: "Sentry",
        description:
          "Alertas de issues, detección de regresiones, degradación de performance. HMAC verificado, parseado automático.",
        status: "ready",
      },
      {
        name: "Datadog",
        description:
          "Monitor alerts, detección de anomalías, SLO burns. Payload mapeado a variables del runbook.",
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
        feature: "Disparado por alertas (Sentry/Datadog)",
        cells: ["sí", "parcial", "sí", "sí", "no"],
      },
      {
        feature: "Ejecución de shell sandboxeada",
        cells: ["sí", "sí", "sí", "no", "no"],
      },
      {
        feature: "Replay desde cualquier step fallido",
        cells: ["sí", "parcial", "no", "no", "no"],
      },
      {
        feature: "Agente IA al fallar (en contexto)",
        cells: ["sí", "no", "no", "sí", "no"],
      },
      {
        feature: "Auditoría hash-chained (verificable)",
        cells: ["sí", "sí", "parcial", "sí", "parcial"],
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
    code: "git clone https://github.com/Hvelizgr/NanoFlow\ncd NanoFlow && docker compose up",
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
          { label: "GitHub", href: "https://github.com/Hvelizgr/NanoFlow" },
          { label: "README", href: "https://github.com/Hvelizgr/NanoFlow#readme" },
          { label: "Templates", href: "https://github.com/Hvelizgr/NanoFlow/tree/main/templates" },
          { label: "Roadmap", href: "https://github.com/Hvelizgr/NanoFlow#roadmap" },
        ],
      },
      {
        title: "Proyecto",
        links: [
          { label: "Contribuir", href: "https://github.com/Hvelizgr/NanoFlow/blob/main/CONTRIBUTING.md" },
          { label: "Issues", href: "https://github.com/Hvelizgr/NanoFlow/issues" },
          { label: "Discussions", href: "https://github.com/Hvelizgr/NanoFlow/discussions" },
          { label: "Licencia", href: "https://github.com/Hvelizgr/NanoFlow/blob/main/LICENSE" },
        ],
      },
    ],
  },
  modal: {
    title: "Sé un design partner",
    subtitle:
      "Alpha pre-lanzamiento. Buscamos 5 equipos de SRE / plataforma usando NanoRun en serio. Gratis por 12 meses, office hours semanales, 50% de descuento perpetuo cuando abra el cloud.",
    placeholder: "vos@empresa.com",
    button: "Pedir un chat",
    processing: "Enviando...",
    successTitle: "Listo",
    successDesc: "Te contactamos en 48 horas.",
    successButton: "Cerrar",
  },
};
