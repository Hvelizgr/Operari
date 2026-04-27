import { repo } from '@/config/repo.config';

export const content = {
  seo: {
    title: 'Operari — La capa de acción para tus alertas',
    description:
      'Salta la alarma a las 3 de la mañana. Operari apaga el fuego. Runbooks visuales open source disparados por Datadog, Sentry, GitHub, PagerDuty, Grafana o cualquier webhook. Self-host con un comando.',
    openGraph: {
      title: 'Operari — Salta la alarma. Operari apaga el fuego.',
      description:
        'Automatización open source de runbooks para responder a alertas. Visual para escribir, YAML para commitear, sandbox para ejecutar, auditado para probar.',
    },
  },
  navigation: {
    product: 'Producto',
    docs: 'Docs',
    github: 'GitHub',
    login: 'Entrar',
    getStarted: 'Obtener API key',
  },
  hero: {
    badge: 'Self-serve · alpha pre-lanzamiento',
    title: 'Runbooks como\nuna API.',
    subtitle:
      'Disparás un runbook de producción con un único HTTP call. Probalo en dry-run contra prod primero, cada step corre en un runner aislado, cada acción queda firmada en una cadena de auditoría, y la respuesta vuelve en menos de 300 ms.',
    ctaPrimary: 'Crear workspace',
    ctaSecondary: 'o self-host',
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
      streamLabel: 'Stream',
      streamSteps: [
        '▸ traer logs del servicio (kubectl)',
        '▸ rollback del último deploy (helm)',
        '▸ publicar status en #incidents',
        '▸ abrir ticket en Linear',
      ],
      streamFooter:
        'run completado · 4/4 steps · cadena de auditoría verificada · stream SSE en vivo',
    },
  },
  trust: {
    eyebrow: 'Diseñado para encajar en el stack que ya usás',
    line: 'Se conecta con las herramientas que tu on-call abre a las 3 am.',
  },
  metrics: {
    eyebrow: 'Ingeniería en números',
    title: 'Producción desde el primer run.',
    items: [
      {
        value: 300,
        suffix: 'ms',
        label: 'p95 trigger → primer log',
        hint: 'medido en la API hospedada',
      },
      {
        value: 12,
        suffix: '',
        label: 'tipos de step first-party',
        hint: 'shell · http · approve · notify · sql · …',
      },
      {
        value: 100,
        suffix: '%',
        label: 'open source, Apache-2.0',
        hint: 'self-host o hosted — el mismo binario',
      },
      {
        value: 10,
        suffix: 'ms',
        label: 'latencia del event tail en vivo',
        hint: 'stream SSE desde el engine a cada UI que mira',
      },
    ],
  },
  safety: {
    eyebrow: 'Safety rails',
    title: 'Cuatro primitivas que a otros workflow tools les faltan.',
    subtitle:
      "Estas features son la línea real entre 'Zapier para devs backend' y una herramienta que confiás con tráfico de producción.",
    rails: [
      {
        title: 'Dry-run contra producción.',
        description:
          'Flag y listo: cada step loguea lo que HARÍA — sin subprocess, sin HTTP, sin pause de approval, sin notificación. Corrés contra credenciales de prod antes del rollback real, ves el payload exacto, dormís tranquilo.',
        example:
          'curl -X POST https://api.operari.dev/v1/runs/trigger \\\n  -d \'{"runbook":"rollback","dryRun":true}\'',
      },
      {
        title: 'Los errores disparan el siguiente runbook automáticamente.',
        description:
          'Declarás onErrorRunbook en tu deploy. Cuando falla, el runbook de rollback se dispara con el error como input. Cycle-detection, mismo tenant, una línea de YAML.',
        example: 'name: deploy-api\nonErrorRunbook: rollback-api\nsteps: [...]',
      },
      {
        title: 'Componé runbooks. No los copies y pegues.',
        description:
          "Un step `runbook` invoca otro runbook como sub-run. Sync o async, hereda dry-run, cap de profundidad 5, scoped al tenant — así 'notificar stakeholders' queda en un solo archivo.",
        example:
          '- id: pre_checks\n  type: runbook\n  config:\n    ref: standard-prechecks\n    inputs:\n      service: "{{vars.service}}"',
      },
      {
        title: 'Tus propios step types, shippeados como npm packages.',
        description:
          '@operari/sdk exporta defineStep({type, configSchema, execute}). Lo escribís en TypeScript, shippeás el build, lo dropeás en OPERARI_PLUGINS_DIR. El runtime valida config con tu zod schema antes del execute. Los types reservados no se pueden override.',
        example:
          "import { defineStep } from '@operari/sdk/steps';\nexport default defineStep({\n  type: 'myorg.slack-notify',\n  configSchema: z.object({ webhook: z.string().url() }),\n  async execute(config, ctx) { /* ... */ },\n});",
      },
    ],
  },
  story: {
    eyebrow: 'Cómo funciona',
    title: 'Tres cosas, una sola herramienta.',
    subtitle:
      'Las otras herramientas del rubro eligen una y pierden el resto. Operari hace las tres porque ninguna funciona sola.',
    blocks: [
      {
        number: '01',
        title: 'Escribí el runbook visualmente.',
        description:
          'Arrastrá un step de shell. Conectá su salida a un gate de aprobación. Ramificá con un condicional. El canvas y el YAML están sincronizados — no hay archivo de config aparte, no hay dos fuentes de verdad.',
        caption: 'Arrastrar, soltar, guardar. Eso es un runbook.',
      },
      {
        number: '02',
        title: 'Commiteá el YAML.',
        description:
          'Cada runbook hace round-trip entre el editor visual y un archivo YAML que commiteás a git. Hacé code-review como con cualquier otra infraestructura. Validá contra el JSON Schema publicado. Revertí con `git revert`.',
        caption: 'Versionado. Revisable. Se revierte como código.',
      },
      {
        number: '03',
        title: 'La alerta dispara → corre → la cadena de auditoría lo prueba.',
        description:
          'Webhook entra, runbook sale. Cada step corre en un runner sandboxeado con retries, gates condicionales y aprobación humana donde la quieras. El operador ve el run en vivo en un event log estilo Temporal (tail SSE, jump-to-latest, retry-desde-step) mientras las mismas transiciones caen en una cadena hash SHA-256 verificable con `operari audit verify`.',
        caption: 'De la alerta a la evidencia, en una sola herramienta.',
      },
    ],
  },
  templates: {
    eyebrow: 'Templates',
    title: 'Runbooks reales. Shell real. Leelos.',
    subtitle:
      'Cada template viene en el repo como YAML commiteable. Abrí uno, copialo, cambiá dos variables, corrélo. Sin DSL, sin plugins.',
    items: [
      {
        slug: 'respond-to-sentry-alert',
        category: 'respuesta a incidente',
        title: 'Responder a una alerta de Sentry',
        description:
          'El runbook que promete el hero. Webhook entra, traer logs, gate de aprobación, helm rollback, notificar #incidents, abrir ticket de post-mortem.',
        accent: 'violet',
      },
      {
        slug: 'k8s-rolling-deploy',
        category: 'deploy',
        title: 'Rolling deploy en Kubernetes',
        description:
          'kubectl set image, mirar el rollout, smoke test de los pods, notificar Slack al terminar. El runbook de CI que todo equipo reescribe en bash.',
        accent: 'primary',
      },
      {
        slug: 'rotate-aws-secrets',
        category: 'seguridad',
        title: 'Rotar secrets de AWS IAM',
        description:
          'Crear nueva key, propagar a Vercel y GitHub, gate de aprobación humana, verificar, después revocar la vieja. Auditable end to end.',
        accent: 'amber',
      },
      {
        slug: 'db-migration-prisma',
        category: 'datos',
        title: 'Migración Prisma con backup',
        description:
          'Snapshot de la base, correr las migraciones pendientes, verificar con un row count, notificar Slack. Una aprobación humana antes del paso destructivo.',
        accent: 'emerald',
      },
    ],
    cta: 'Ver todos los templates en GitHub',
  },
  triggers: {
    eyebrow: 'Fuentes de trigger',
    title: 'Cualquier cosa que haga POST de JSON puede iniciar un runbook.',
    subtitle:
      'Verificación HMAC built-in para los proveedores que ya pagás. Webhook genérico para todo lo demás.',
    items: [
      {
        name: 'Datadog',
        description:
          'Monitor alerts, detección de anomalías, SLO burns. Payload mapeado a variables del runbook.',
        status: 'ready',
      },
      {
        name: 'Sentry',
        description:
          'Alertas de issues, detección de regresiones, degradación de performance. HMAC verificado, parseado automático.',
        status: 'ready',
      },
      {
        name: 'GitHub',
        description:
          'Workflows fallidos, eventos de deploy, security advisories. Validación de webhook firmado.',
        status: 'ready',
      },
      {
        name: 'Webhook genérico',
        description:
          'Cualquier HTTP POST con JSON. Traé tu propio HMAC. PagerDuty, Grafana, OpsGenie, custom — mismo camino.',
        status: 'ready',
      },
    ],
    callsAnything: {
      title: 'Y cada step llama herramientas reales.',
      subtitle:
        'Sin DSL. Sin plugins por herramienta. Los steps corren como shell — cualquier cosa que tipearías en una terminal funciona desde el día 1.',
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
    eyebrow: 'La tabla honesta',
    title: 'No somos para todos. Acá la prueba.',
    subtitle:
      'Inclinada a nuestro favor donde ganamos, gris donde no competimos, roja donde perdemos. Leela antes de star.',
    headers: ['', 'Operari', 'Rundeck', 'StackStorm', 'incident.io', 'Backstage'],
    rows: [
      {
        feature: 'Canvas visual + round-trip YAML',
        cells: ['sí', 'no', 'no', 'parcial', 'no'],
      },
      {
        feature: 'Disparado por alertas (Datadog/Sentry/PagerDuty)',
        cells: ['sí', 'parcial', 'sí', 'sí', 'no'],
      },
      {
        feature: 'Ejecución de shell sandboxeada',
        cells: ['sí', 'sí', 'sí', 'no', 'no'],
      },
      {
        feature: 'Replay desde cualquier step fallido',
        cells: ['sí', 'sí', 'no', 'no', 'no'],
      },
      {
        feature: 'Agente IA al fallar (en contexto)',
        cells: ['sí', 'no', 'no', 'parcial', 'no'],
      },
      {
        feature: 'Auditoría hash-chained (verificable)',
        cells: ['sí', 'parcial', 'parcial', 'parcial', 'no'],
      },
      {
        feature: 'Licencia open source',
        cells: ['AGPL', 'Apache', 'Apache', 'no', 'Apache'],
      },
      {
        feature: 'Dry-run contra prod (sin side effects)',
        cells: ['sí', 'no', 'no', 'no', 'no'],
      },
      {
        feature: 'Custom step plugins (SDK)',
        cells: ['sí', 'no', 'partial', 'no', 'partial'],
      },
      {
        feature: 'MFA + verificación email built-in',
        cells: ['sí', 'sí', 'no', 'sí', 'partial'],
      },
      {
        feature: 'Precio por usuario',
        cells: ['$19/$49', '$125/mes', 'gratis', '$20–40/mes', 'self-host'],
      },
      {
        feature: 'Production-ready hoy',
        cells: ['no', 'sí', 'no', 'sí', 'sí'],
      },
    ],
    footnote:
      'Perdemos en production-readiness hoy. Estamos en alpha pre-launch. Si necesitás algo sólido como una roca, agarrá Rundeck o incident.io. Si querés influir en cómo se ve la próxima herramienta OSS de runbooks, hablanos.',
    cta: 'OK, dame el repo',
  },
  cta: {
    eyebrow: 'Self-host',
    pricing: 'Gratis. Sin tarjeta. Sin tiers.',
    title: 'Dos minutos hasta tu primer runbook.',
    subtitle:
      'Cloná, corré, abrí el editor en localhost:3000. AGPL para siempre. Sin telemetría. Sin sign-up.',
    code: repo.cloneSnippet,
    primary: 'Leer el README',
    secondary: 'Qué NO funciona todavía',
  },
  footer: {
    tagline: 'Automatización open source de runbooks para responder alertas.',
    rights: 'AGPL-3.0. Hecho por SREs que se cansaron de Confluence.',
    columns: [
      {
        title: 'Producto',
        links: [
          { label: 'Precios', href: '/pricing' },
          { label: 'GitHub', href: repo.base },
          { label: 'Templates', href: repo.templatesTree },
          { label: 'Roadmap', href: repo.roadmap },
        ],
      },
      {
        title: 'Recursos',
        links: [
          { label: 'Docs', href: repo.readme },
          { label: 'Changelog', href: '/changelog' },
          { label: 'Contribuir', href: repo.contributing },
          { label: 'Contacto', href: '/contact' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { label: 'Seguridad', href: '/security' },
          { label: 'Privacidad', href: '/privacy' },
          { label: 'Términos', href: '/terms' },
          { label: 'Licencia', href: repo.license },
        ],
      },
    ],
  },
  pricing: {
    eyebrow: 'Precios',
    title: 'Self-host gratis. Cloud cuando quieras.',
    subtitle:
      'Todo el producto, AGPL, self-hosted para siempre. Cloud es para equipos que no quieren correr un Postgres. Elegí una vez; cambiás después.',
    badge: 'Cloud está en waitlist — self-host disponible hoy.',
    billingYearly: 'Facturado anual (20% off)',
    billingMonthly: 'Facturado mensual',
    perMonth: '/mes',
    perUserMonth: '/usuario/mes',
    contactSales: 'Hablar con ventas',
    getStarted: 'Self-host ahora',
    popular: 'Más elegido',
    tiers: [
      {
        id: 'self-host',
        name: 'Self-host',
        price: '$0',
        priceYearly: '$0',
        period: 'para siempre',
        description: 'Docker compose, tu servidor, tus datos. AGPL para siempre.',
        features: [
          'Runbooks ilimitados',
          'Runs ilimitados',
          'Webhooks ilimitados',
          'Todas las fuentes de trigger',
          'Verificación de cadena de auditoría',
          'Ejecución de shell sandboxeada',
          'Discord de la comunidad',
        ],
        cta: 'Self-host ahora',
        ctaHref: '#docker',
        highlighted: false,
      },
      {
        id: 'team',
        name: 'Team',
        price: '$19',
        priceYearly: '$15',
        period: '/usuario/mes',
        description: 'Nosotros corremos el Postgres. Vos corrés los runbooks.',
        features: [
          'Todo lo de Self-host',
          'Postgres gestionado + backups',
          'Notificaciones Slack/Teams',
          'SSO (Google, Microsoft)',
          'Retención de runs 14 días',
          'Soporte por email · SLA 24h',
          'Ingest webhook prioritario',
        ],
        cta: 'Unirse al waitlist',
        ctaHref: '/contact',
        highlighted: true,
      },
      {
        id: 'business',
        name: 'Business',
        price: '$49',
        priceYearly: '$39',
        period: '/usuario/mes',
        description: 'Para equipos de plataforma que necesitan audit + SAML.',
        features: [
          'Todo lo de Team',
          'SAML SSO + SCIM',
          'Export de audit log (SIEM)',
          'Control de acceso por rol',
          'Retención de runs 1 año',
          'SLA 99.9%',
          'Canal dedicado de Slack',
        ],
        cta: 'Unirse al waitlist',
        ctaHref: '/contact',
        highlighted: false,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 'A medida',
        priceYearly: 'A medida',
        period: '',
        description: 'On-prem, air-gapped, FedRAMP-track. Hablemos.',
        features: [
          'Todo lo de Business',
          'Self-host + cloud híbrido',
          'Compliance custom (SOC2, HIPAA)',
          'Deploy air-gapped',
          'Retención de runs ilimitada',
          'SLA 99.99% · CSM dedicado',
          'Source escrow',
        ],
        cta: 'Hablar con ventas',
        ctaHref: '/contact',
        highlighted: false,
      },
    ],
    comparison: {
      title: 'Compará cada plan',
      groups: [
        {
          name: 'Core',
          rows: [
            {
              feature: 'Runbooks',
              values: ['Ilimitados', 'Ilimitados', 'Ilimitados', 'Ilimitados'],
            },
            {
              feature: 'Historial de runs',
              values: ['Ilimitado (tu DB)', '14 días', '1 año', 'A medida'],
            },
            {
              feature: 'Webhooks',
              values: ['Ilimitados', 'Ilimitados', 'Ilimitados', 'Ilimitados'],
            },
            { feature: 'Shell sandboxeado', values: ['sí', 'sí', 'sí', 'sí'] },
          ],
        },
        {
          name: 'Seguridad',
          rows: [
            { feature: 'Verify HMAC webhook', values: ['sí', 'sí', 'sí', 'sí'] },
            { feature: 'Cadena de hash audit', values: ['sí', 'sí', 'sí', 'sí'] },
            { feature: 'SSO (Google/MS)', values: ['no', 'sí', 'sí', 'sí'] },
            { feature: 'SAML + SCIM', values: ['no', 'no', 'sí', 'sí'] },
            { feature: 'Export audit log', values: ['no', 'no', 'sí', 'sí'] },
            { feature: 'Deploy air-gapped', values: ['sí', 'no', 'no', 'sí'] },
          ],
        },
        {
          name: 'Soporte',
          rows: [
            { feature: 'Discord comunidad', values: ['sí', 'sí', 'sí', 'sí'] },
            { feature: 'SLA email', values: ['—', '24h', '4h', '1h'] },
            { feature: 'Canal dedicado', values: ['no', 'no', 'sí', 'sí'] },
            { feature: 'SLA uptime', values: ['—', '—', '99.9%', '99.99%'] },
          ],
        },
      ],
    },
    faq: {
      title: 'Preguntas sobre precios',
      items: [
        {
          q: '¿Self-host es realmente gratis para siempre?',
          a: 'Sí. AGPL-3.0, sin trampas. El mismo binario que corremos en cloud corre en tu servidor. No hay feature flags escondiendo cosas detrás de un tier pago.',
        },
        {
          q: '¿Qué cuenta como usuario?',
          a: 'Cualquiera que loguea. Webhooks, triggers y ejecuciones no cuentan como usuarios — solo humanos con cuenta.',
        },
        {
          q: '¿Puedo cambiar de Cloud a Self-host (o al revés) después?',
          a: 'Sí. Cada runbook es YAML en git. Cada run está auditado con SHA-256. Los datos son portables por diseño — exportás un cloud instance a self-host con un comando.',
        },
        {
          q: '¿Hay descuento para OSS / startups?',
          a: 'Self-host ya es gratis. Para Team/Business damos 50% off a non-profits registradas y startups con fondeo YC/Sequoia/Index en su primer año. Escribinos.',
        },
        {
          q: '¿Cuándo sale Cloud GA?',
          a: 'Abrimos Cloud a cohorts del waitlist cada 2 semanas. Alpha pre-launch ahora — GA esperado Q3 2026.',
        },
      ],
    },
  },
  changelog: {
    eyebrow: 'Changelog',
    title: 'Qué se envió, cuándo y por qué.',
    subtitle: 'Versionado, fechado, honesto. Sin reescrituras de marketing.',
    entries: [
      {
        date: '2026-04-10',
        version: 'v0.6.0',
        tag: 'feature',
        title: 'Write tools opt-in del agente de aprobación',
        body: 'El agente IA en contexto ahora puede otorgar o rechazar gates de aprobación cuando el operador lo habilita. Default read-only — write access es por runbook.',
      },
      {
        date: '2026-04-02',
        version: 'v0.5.2',
        tag: 'refactor',
        title: 'Rename workflow → runbook (fase 2b)',
        body: 'Tablas de DB, modelos Prisma y superficie de API migraron de workflow_* a runbook_*. Shim de compat eliminado; migrá con el script incluido.',
      },
      {
        date: '2026-04-24',
        version: 'v0.6.0',
        tag: 'sdk',
        title: 'SDK público consolidado bajo @operari/*',
        body: 'El SDK de TypeScript, el CLI y los tipos compartidos ahora se publican como @operari/sdk, @operari/cli y @operari/shared. El namespace intermedio Operari fue retirado para mantener el branding consistente en el binario CLI, los nombres de paquetes, los templates de email y el copy in-app.',
      },
      {
        date: '2026-03-14',
        version: 'v0.5.0',
        tag: 'feature',
        title: 'Webhook GitHub + payload firmado',
        body: 'Fuente de trigger nativa de GitHub con validación de webhook firmado. Cableás un workflow fallido a un runbook de rollback en 30 segundos.',
      },
      {
        date: '2026-02-22',
        version: 'v0.4.0',
        tag: 'feature',
        title: 'Cadena de auditoría hash-chained',
        body: 'Cada step cae en una cadena SHA-256. `operari audit verify` reejecuta la cadena entera; tampering se detecta determinísticamente.',
      },
    ],
  },
  security: {
    title: 'Seguridad',
    subtitle: 'Cómo manejamos secrets, datos e incidentes.',
    updated: 'Última actualización: 2026-04-01',
    sections: [
      {
        heading: 'Reportar una vulnerabilidad',
        body: 'Email a security@operari.dev con mensaje cifrado PGP. Acusamos recibo en 24h, triage en 72h. Política de disclosure en SECURITY.md del repo.',
      },
      {
        heading: 'Sandboxing',
        body: 'Cada step de shell corre en un container con rootfs fresco, sin mount del host, sin egress de red a menos que se declare. El runner aplica límites CPU/memoria/wall-clock por step.',
      },
      {
        heading: 'Secrets',
        body: 'Los secrets en runtime nunca tocan disco. Se inyectan al proceso del step vía env vars desde un store respaldado por KMS. Logs se redactan al escribir, no al ver.',
      },
      {
        heading: 'Cadena de auditoría',
        body: 'I/O de cada step se hashea con SHA-256 y se encadena. Verificás un run end-to-end con `operari audit verify`. Tampering rompe la cadena determinísticamente.',
      },
      {
        heading: 'Residencia de datos (Cloud)',
        body: 'Cloud default en us-east-1. Planes Team+ pueden elegir eu-west-1 o ap-southeast-1 al provisionar. Sin replicación cross-region sin opt-in explícito.',
      },
      {
        heading: 'Compliance',
        body: 'SOC 2 Type I en curso (objetivo Q4 2026). HIPAA en tier Business con BAA. GDPR/CCPA compliant por diseño. FedRAMP Moderate trackeado para 2027.',
      },
    ],
  },
  subprocessors: {
    title: 'Subprocesadores',
    subtitle:
      'Terceros que manejan datos en nuestro nombre. Actualizado cada vez que agregamos o sacamos uno.',
    updated: 'Última actualización: 2026-04-01',
    intro:
      'Mantenemos la lista corta a propósito. Cada subprocesador está atado contractualmente con DPAs y solo procesa los datos que le pasamos explícitamente.',
    entries: [
      {
        name: 'Amazon Web Services (AWS)',
        purpose: 'Hosting — EC2, RDS Postgres, S3, CloudWatch',
        region: 'us-east-1 (default), eu-west-1 / ap-southeast-1 opt-in',
        dataTypes: 'Todos los datos del cliente (runbooks, runs, logs)',
      },
      {
        name: 'Stripe',
        purpose: 'Facturación — suscripción + facturas',
        region: 'Estados Unidos + Irlanda',
        dataTypes: 'Email de billing, empresa, token del método de pago',
      },
      {
        name: 'Postmark',
        purpose: 'Email transaccional — aprobaciones, fallos de runs',
        region: 'Estados Unidos',
        dataTypes: 'Email del destinatario, metadata del run',
      },
      {
        name: 'Cloudflare',
        purpose: 'DNS + WAF + CDN para sitio de marketing',
        region: 'Global',
        dataTypes: 'Logs anónimos de requests (sin cookies)',
      },
      {
        name: 'Plausible',
        purpose: 'Analytics privacy-first para marketing',
        region: 'Alemania (UE)',
        dataTypes: 'Page views agregados (sin datos personales)',
      },
      {
        name: 'Sentry',
        purpose: 'Monitoreo de errores (solo cloud build)',
        region: 'Estados Unidos',
        dataTypes: 'Stack traces, user ID anonimizado',
      },
    ],
    notice:
      'Aviso de cambios: avisamos a clientes registrados con al menos 30 días antes de activar un subprocesador nuevo.',
  },
  privacy: {
    title: 'Privacidad',
    subtitle: 'Qué guardamos, qué hacemos con eso y qué nos negamos a hacer.',
    updated: 'Última actualización: 2026-04-17',
    sections: [
      {
        heading: 'Self-host: cero telemetría',
        body: 'Self-host no nos manda nada. Sin pings, sin contadores de uso, sin reportes de crash a menos que habilites explícitamente el flag OPERARI_TELEMETRY. Tus runbooks, ejecuciones, logs y credenciales nunca salen de tu infraestructura.',
      },
      {
        heading: 'Cloud: qué datos guardamos',
        body: 'Cuando te registrás en el servicio hosted guardamos: (a) identidad de la cuenta — email, password hasheado, nombre a mostrar opcional y el subject id del proveedor OAuth si te logueás con Google o GitHub; (b) datos del workspace — runbooks, ejecuciones, logs de steps, secretos que cargaste, eventos de auditoría; (c) metadatos de billing desde Stripe — estado de suscripción, plan, ids de factura. Nunca leemos el contenido de tus runbooks ni tus secretos por ningún motivo que no sea ejecutarlos a tu pedido.',
      },
      {
        heading: 'Base legal (GDPR)',
        body: 'Procesamos los datos de cuenta y workspace bajo la base de contrato — te registraste para recibir un servicio y no podemos entregarlo sin procesar esos datos. Los emails de marketing salen bajo interés legítimo con un link de baja a un clic en cada envío. No hacemos profiling para publicidad.',
      },
      {
        heading: 'Tus derechos',
        body: 'Podés acceder, corregir, exportar o eliminar cada campo asociado a tu cuenta desde la página de Settings. Para derechos que requieren gestión manual (restricción, oposición, portabilidad en bulk), escribinos a privacy@operari.dev y respondemos en 30 días. Residentes en la UE/EEE y UK pueden también hacer reclamos ante su autoridad de protección de datos local.',
      },
      {
        heading: 'Retención',
        body: 'Los datos de cuenta se retienen mientras la cuenta esté activa. Cuando eliminás tu cuenta, tu fila de usuario, workspace, runbooks, ejecuciones, secretos y logs de steps se purgan en 30 días en storage primario y backups. El audit log está hash-chained y es inmutable por diseño — los eventos de eliminación quedan como tombstone con userId y timestamp pero el stream en sí se retiene por compliance (requerido por SOC 2 / ISO 27001).',
      },
      {
        heading: 'Transferencias internacionales',
        body: 'El servicio hosted corre en la región que elegiste al registrarte (hoy: UE o US). Cuando el procesamiento involucra un subprocesador en otra región, nos apoyamos en las Standard Contractual Clauses (SCCs) y en el UK International Data Transfer Agreement según corresponda.',
      },
      {
        heading: 'Cookies',
        body: 'Usamos dos cookies funcionales: operari_session (HttpOnly, requerida para login) y operari_csrf (legible por el navegador para que los forms incluyan un token CSRF). El sitio de marketing usa analytics privacy-first sin cookies ni tracking cross-site.',
      },
      {
        heading: 'Subprocesadores',
        body: 'Ver /subprocessors para la lista canónica de hosting, email, error-tracking y procesadores de pago que usamos. Notificamos a los clientes con al menos 30 días antes de activar un subprocesador nuevo.',
      },
      {
        heading: 'Aviso de brechas',
        body: 'En el caso improbable de una brecha de datos personales que afecte tu cuenta, te notificamos dentro de las 72 horas de la confirmación, consistente con los artículos 33/34 del GDPR, y publicamos un post-incident report dentro de los 30 días.',
      },
      {
        heading: 'Datos de menores',
        body: 'El servicio no está dirigido a menores de 16 años. No recolectamos conscientemente datos de menores; si creés que los datos de un menor llegaron a nosotros, escribinos a privacy@operari.dev y los eliminamos.',
      },
      {
        heading: 'Contacto',
        body: 'Consultas de privacidad o pedidos de derechos: privacy@operari.dev. Divulgaciones de seguridad: security@operari.dev (PGP bajo pedido). Para asuntos GDPR de la UE mantendremos un Representante EEA una vez que la facturación en la región supere el umbral de EU Rep.',
      },
    ],
  },
  terms: {
    title: 'Términos del servicio',
    subtitle: 'Las reglas del camino.',
    updated: 'Última actualización: 2026-04-17',
    sections: [
      {
        heading: 'Partes',
        body: 'Estos términos forman un acuerdo entre vos ("Cliente") y Operari ("nosotros"). Al registrarte en el servicio hosted o al correr la distribución self-host en producción, aceptás estos términos.',
      },
      {
        heading: 'Licencia self-host',
        body: 'El servidor self-host es AGPL-3.0 — podés correrlo, forkearlo e incrustarlo en productos; correr una copia modificada como servicio público dispara la obligación AGPL de liberar el código. Los paquetes oficiales de SDK y CLI son MIT. Un puñado de módulos enterprise (conectores SAML/SCIM, herramientas de backup gestionado de Postgres) son source-available bajo una Business Source License separada que convierte a Apache 2.0 en su change date declarada.',
      },
      {
        heading: 'Suscripción Cloud',
        body: 'Mensual o anual, facturada por adelantado vía Stripe. Podés cancelar en cualquier momento desde Settings → Billing; el período actual sigue activo hasta fin de ciclo de billing. Los planes anuales reciben un reembolso prorrateado sobre la porción no usada a pedido del admin.',
      },
      {
        heading: 'Tarifas e impuestos',
        body: 'Los precios están en USD salvo que la página de plan diga lo contrario. Sos responsable de los impuestos aplicables (IVA/GST/sales tax); Stripe Tax maneja la mayoría de las regiones automáticamente. Podemos cambiar precios con aviso de 60 días por email al admin de la cuenta; los primeros 100 clientes pagos mantienen su precio mientras permanezcan en un plan pago.',
      },
      {
        heading: 'Uso aceptable',
        body: 'No uses el servicio para atacar sistemas que no son tuyos, exfiltrar datos que no controlás, o correr cargas abusivas (minería de criptomonedas, DDoS reflectors, scrapers contra APIs de terceros rate-limited). El contenido de los runbooks es tu propiedad y responsabilidad; podemos suspender cargas que disparen safeguards de infra y te avisamos antes de acciones permanentes salvo que un incidente activo requiera otra cosa.',
      },
      {
        heading: 'Tus datos, tu propiedad',
        body: 'Retenés todos los derechos sobre los runbooks, ejecuciones, secretos y logs que subas. Recibimos una licencia limitada para procesar esos datos solamente para entregarte el servicio. No entrenamos modelos de AI con el contenido de tus runbooks, no inspeccionamos tus ejecuciones para analytics de producto, ni compartimos datos con terceros más allá de los subprocesadores listados en /subprocessors.',
      },
      {
        heading: 'Disponibilidad + SLA',
        body: 'Free y self-host se entregan sin compromiso de uptime. Los planes Team y Business apuntan a 99.9% de disponibilidad mensual en la API primaria, medida contra nuestra status page pública. Los créditos por SLA incumplido para Team/Business equivalen al 10% de los fees del mes por hora de downtime sobre el objetivo, con tope del 50% de ese mes. Los contratos Enterprise pueden agregar términos más estrictos en una orden ejecutada.',
      },
      {
        heading: 'Soporte',
        body: 'Free: soporte de comunidad vía GitHub Discussions. Team: respuesta por email en dos días hábiles. Business: respuesta por email en un día hábil, con un bridge de incidente compartido durante incidentes de producción confirmados. Enterprise: definido por contrato. No garantizamos soporte para self-host sin modificar más allá de bug reports que reproduzcan contra la release actual.',
      },
      {
        heading: 'Confidencialidad',
        body: 'Cada parte protegerá la información confidencial de la otra con cuidado razonable y la usará solo para cumplir el acuerdo. Nuestras prácticas de seguridad — encriptación en reposo, aislamiento de secretos por tenant, audit logs hash-chained — están documentadas en la página de security y aplican a todos los clientes sin importar el plan.',
      },
      {
        heading: 'Garantías',
        body: 'El servicio se provee "tal cual" y "según disponibilidad". Rechazamos garantías implícitas en la medida máxima que permita la ley. Sí garantizamos que tenemos la autoridad para otorgar los derechos que otorgamos acá y que nuestro binario de producción no se envía conscientemente con código malicioso.',
      },
      {
        heading: 'Limitación de responsabilidad',
        body: 'Ninguna de las partes será responsable por daños indirectos, incidentales, especiales, consecuentes o punitivos. La responsabilidad agregada de cada parte bajo este acuerdo se limita a los fees que el Cliente pagó en los doce meses previos al reclamo. Nada en esta sección limita la responsabilidad por conducta dolosa o incumplimiento de confidencialidad.',
      },
      {
        heading: 'Indemnización',
        body: 'Te defendemos e indemnizamos contra reclamos de terceros que aleguen que el servicio tal como se entrega infringe su propiedad intelectual, excepto cuando la infracción surja de tus modificaciones, combinación con software de terceros, o uso ilícito. Vos nos indemnizás contra reclamos de terceros originados en el contenido de tus runbooks o en tu uso del servicio.',
      },
      {
        heading: 'Procesamiento de datos (GDPR)',
        body: 'Para clientes que procesan datos personales de la UE/UK a través del servicio, nuestro Data Processing Addendum (disponible en /dpa) se incorpora por referencia al ejecutarse. Cubre las obligaciones del artículo 28, una lista vigente de subprocesadores y las Standard Contractual Clauses para transferencias internacionales.',
      },
      {
        heading: 'Suspensión + terminación',
        body: 'Cualquiera de las partes puede terminar por conveniencia con aviso de 30 días (o inmediatamente al final del período de billing actual para hosted). Podemos suspender el servicio con aviso corto si creemos razonablemente que tu cuenta está comprometida, involucrada en violaciones de uso aceptable, o causando daño a otros clientes. Al terminar podés exportar tus datos durante 30 días; después se purgan según la sección de retención de la política de Privacidad.',
      },
      {
        heading: 'Controles de exportación + sanciones',
        body: 'Declarás que no estás en, y que no usarás el servicio en representación de, ninguna parte sujeta a listas de sanciones US, UK o UE, y que no exportarás el servicio a ninguna jurisdicción restringida por la ley comercial aplicable.',
      },
      {
        heading: 'Cambios',
        body: 'Los cambios materiales a estos términos o a la política de Privacidad entran en vigor 30 días después de publicar un aviso al principio de la página y enviar email al admin registrado. Las ediciones no materiales (correcciones tipográficas, aclaraciones) pueden entrar en vigor inmediatamente y aparecerán en /changelog.',
      },
      {
        heading: 'Jurisdicción',
        body: 'Estos términos se rigen por las leyes de Delaware, USA, sin referencia a sus reglas de conflicto de leyes. Las disputas van a arbitraje JAMS con sede en San Francisco bajo sus Streamlined Rules; cada parte retiene el derecho a buscar medidas cautelares en cualquier corte competente por uso indebido de propiedad intelectual. Se renuncia a las acciones colectivas (class actions).',
      },
      {
        heading: 'Acuerdo completo',
        body: 'Estos términos más el DPA, la orden (si la hubiere) y los adendos específicos de producto forman el acuerdo completo. Si alguna disposición se encuentra inejecutable, el resto continúa aplicándose.',
      },
    ],
  },
  contact: {
    title: 'Hablanos.',
    subtitle:
      'Leemos todo. Alpha pre-launch, así que somos los humanos construyendo el producto — no hay ticket queue.',
    channels: [
      {
        name: 'Abrir un issue',
        description: 'Bugs y pedidos de features.',
        href: 'issues',
        action: 'GitHub issues',
      },
      {
        name: 'Discussions',
        description: 'Preguntas, ideas y how-tos de la comunidad.',
        href: 'discussions',
        action: 'Abrir discussions',
      },
      {
        name: 'Seguridad',
        description: 'Vulnerabilidades. PGP cifrado, ack 24h.',
        href: 'mailto:security@operari.dev',
        action: 'security@operari.dev',
      },
      {
        name: 'Ventas',
        description: 'Business, Enterprise y on-prem.',
        href: 'mailto:hello@operari.dev',
        action: 'hello@operari.dev',
      },
    ],
    form: {
      title: 'O mandanos una nota',
      name: 'Tu nombre',
      email: 'Email laboral',
      company: 'Empresa',
      message: '¿Qué tenés en mente?',
      submit: 'Enviar',
      sending: 'Enviando...',
      sent: 'Recibido. Respondemos en 48 horas.',
    },
  },
  modal: {
    title: 'Sé un design partner',
    subtitle:
      'Alpha pre-lanzamiento. Buscamos 5 equipos de SRE / plataforma usando Operari en serio. Gratis para siempre en self-host, office hours semanales, línea directa con la gente que lo está construyendo.',
    placeholder: 'vos@empresa.com',
    button: 'Pedir un chat',
    processing: 'Enviando...',
    successTitle: 'Listo',
    successDesc: 'Te contactamos en 48 horas.',
    successButton: 'Cerrar',
  },
};
