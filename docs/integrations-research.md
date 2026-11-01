# Integraciones: research de n8n y auditoría del catálogo de Operari

_Noviembre 2026. Fuente: clon de `n8n-io/n8n` (commit `f5ed6cc72c`)._

> **Estado:** fase 1 completa (`deb2c15`, `fe74d97`). Lo que falta está priorizado en
> [`pendiente.md`](../pendiente.md) → "Catálogo de integraciones" y detallado en la hoja de ruta al final.

## Licencia: por qué no se copió nada

n8n se distribuye bajo la **Sustainable Use License** (fair-code), que no permite reutilizar su código en
otro producto. Por eso n8n se usó solo como **inventario** de qué servicios y operaciones existen.
Cada integración de Operari está escrita desde cero contra la API pública del proveedor, con el
constructor declarativo propio (`backend/src/runbook/catalog/service.ts`).

## Inventario de n8n

| | |
|---|---|
| Integraciones (carpetas de nodos) | 324 (305 en `nodes-base`, 19 en `@n8n/nodes-langchain`) |
| Tipos de nodo | 579 |
| Triggers | 116 |
| Operaciones (`action`) | 3446 |
| Tipos de credencial | 415 |
| Nodos utilitarios sin credencial | 66 |

Las más grandes por operaciones: Microsoft (205), Google (199), Freshservice (77), AWS (66),
Pipedrive (65), Salesforce (65), ClickUp (61), Zoho (61), Harvest (51), monday.com (49), Slack (49),
ActiveCampaign (48), Databricks (46), GitHub (46), QuickBooks (42), Trello (41), Telegram (38),
HubSpot (37), Todoist (36).

El script que generó el inventario está en el historial de la sesión; para regenerarlo basta con
recorrer `packages/nodes-base/nodes/**` y juntar los `action: '…'` de cada carpeta.

## Lo que se agregó en esta fase

**94 servicios con 667 operaciones** y **9 utilitarios**, todo cubierto por tests: cada operación de
cada servicio se ejecuta contra un `fetch` simulado y se verifica URL https, ruta sin placeholders,
método, autenticación en el lugar correcto y cuerpo válido (`services.test.ts`).

| Categoría | Ops | Servicios |
|---|---|---|
| CRM y ventas | 117 | HubSpot, Pipedrive, Salesforce, Zoho CRM, Close, Attio, ActiveCampaign, Intercom, Freshsales |
| Productividad | 121 | Jira, Confluence, Todoist, monday.com, Notion, Coda, Baserow, NocoDB, Smartsheet, Clockify, Harvest, Google Calendar/Docs/Tasks/Contacts, Gmail, YouTube, Outlook, Outlook Calendar, Microsoft To Do |
| Comercio y pagos | 82 | Stripe, Shopify, WooCommerce, Square, Paddle, Lemon Squeezy, Gumroad, Chargebee |
| Developer platforms | 75 | GitHub, Bitbucket, Vercel, Netlify, Render, Fly.io, DigitalOcean, Hetzner, npm, Docker Hub, Supabase |
| Mensajería | 68 | Slack, Discord (bot), Telegram (bot), WhatsApp Business, Twilio, Zoom, Matrix, Rocket.Chat, Zulip, Pushover, Microsoft Teams |
| Soporte e ITSM | 59 | Freshdesk, Freshservice, ServiceNow, Zammad, Help Scout, HaloPSA, Syncro |
| Monitoreo | 45 | PagerDuty, Opsgenie, UptimeRobot, Better Stack, Datadog, New Relic, Splunk, Grafana |
| Marketing y email | 41 | Mailchimp, Brevo, Mailgun, Postmark, MailerLite, Kit, Klaviyo, Customer.io |
| Archivos | 33 | Google Drive, OneDrive, Dropbox, Box, Nextcloud |
| IA | 26 | OpenAI (y cualquier API compatible), Mistral, Perplexity, Pinecone, Qdrant, ElevenLabs, Replicate |

Utilitarios nuevos: renombrar claves, separar lista, comparar datasets, resumir por grupo, HTML
(texto, título y links), XML ↔ JSON, feed RSS/Atom, invitación de calendario `.ics` y gráfico
(URL de QuickChart).

### Cómo se agrega una integración

```ts
service({
  type: 'acme', category: 'crm', icon: 'Users', color: 'bg-blue-600',
  label: ['Acme', 'Acme'], description: ['…', '…'],
  auth: { kind: 'bearer', provider: 'acme' },
  base: 'https://api.acme.com/v1',
  operations: [
    ...crud('contact', { one: ['contact', 'contacto'], many: ['contacts', 'contactos'] },
      '/contacts', r('contactId', 'Contact id'), [f('email', 'Email'), f('name', 'Name')]),
    { value: 'contact.search', label: ['Search', 'Buscar'], method: 'GET', path: '/contacts/search',
      fields: [r('q', 'Query')] },
  ],
});
```

El constructor arma el formulario (selector de operación, credencial filtrada por proveedor, campos
visibles según la operación, "Additional fields (JSON)" para lo no modelado), valida obligatorios
por operación, ubica cada valor en path/query/body, y comparte dry-run, timeout, guard SSRF y
logs con el resto de los pasos. Si dos operaciones usan el mismo nombre de campo con otro tipo u
otras opciones, falla al construirse (y por lo tanto en los tests).

Autenticaciones soportadas: `bearer`, `header` (con prefijo), `query`, `basic` (usuario + secreto),
`basicSecret` (usuario o password fijo, o `user:password`), `path` (Telegram) y `body` (Pushover,
UptimeRobot).

## Auditoría de los nodos de Operari

### Conexiones (credenciales)

- **Arreglado:** el formulario de credenciales tenía una lista fija de ~20 tipos; ahora agrega cada
  proveedor que pide algún paso del catálogo, así Stripe, HubSpot, Shopify… aparecen solos.
- **Arreglado:** Jira/Confluence usaban el proveedor `atlassian` y no veían las credenciales `jira`.
- **Pendiente — OAuth2:** solo GitHub tiene "Conectar con…". Google, Microsoft, HubSpot,
  Salesforce, Zoom, Zoho y Dropbox se usan pegando un access token, y los de Google/Microsoft
  **vencen en ~1 hora**. Es lo más importante que falta: flujo OAuth con refresh token guardado en
  el vault y renovación automática antes de cada paso.
- **Pendiente:** botón "Probar credencial" (una llamada de solo lectura por proveedor).
- **Pendiente:** los pasos viejos (`slack.message`, `jira.issue`, …) no filtran el selector por
  proveedor; los nuevos sí.

### Datos

- Cada paso devuelve un objeto (`{ status, data }`); no hay ejecución por ítem como en n8n.
  Los utilitarios nuevos (`splitOut`, `summarize`, `compareDatasets`) y el `loop` existente cubren
  los casos comunes, pero falta **paginación automática** ("traer todo") en los listados.
- **Archivos binarios:** no hay un tipo de dato archivo entre pasos, ni subida multipart. Bloquea
  "subir a Drive/Dropbox/S3 lo que descargó el paso anterior", adjuntos de email y OCR de PDFs.
- No hay nodo **Code** (JS/Python). El `shell` sandboxeado lo reemplaza en parte; un Code con el
  mismo runner sería lo siguiente.

### Selecciones (formularios)

- Tipos de campo disponibles: texto, número, booleano, opciones, secreto, SQL, color. Faltan
  **listas dinámicas** (elegir el canal de Slack, la base de Notion o el proyecto de Jira desde la
  API en vez de pegar el id), **multi-selección**, **colecciones clave-valor** (headers, query
  params), **editor JSON** y **fecha/hora**.
- Las etiquetas de los campos solo están en inglés (el nombre y la descripción del paso sí son
  bilingües).
- **Arreglado:** la paleta y el buscador ocultaban cualquier paso de una categoría que no conocían;
  ahora hay 6 categorías nuevas y lo desconocido cae en "Integraciones".

### Triggers

n8n tiene 116; Operari tiene cron y webhook (más la verificación HMAC de Datadog/Sentry/GitHub).
Faltan triggers por aplicación (nuevo pago en Stripe, nuevo ticket en Zendesk, email entrante,
fila nueva en una hoja) — con webhooks registrados automáticamente o por polling.

## Hoja de ruta propuesta

1. **OAuth2 genérico** con refresh (Google, Microsoft, Slack, HubSpot, Salesforce, Zoom, Dropbox).
2. **Listas dinámicas** en el formulario (`loadOptions`), empezando por Slack, Notion, Jira y GitHub.
3. **Paginación** "traer todo" en las operaciones de listado.
4. **Archivos binarios** entre pasos + multipart (Drive, Dropbox, S3, email con adjuntos).
5. **Triggers por aplicación** (webhook auto-registrado o polling con cursor).
6. Más servicios. Los grandes que faltan respecto de n8n: Microsoft Excel/SharePoint/Dynamics,
   QuickBooks, Xero, Trello/Asana/ClickUp/Linear/GitLab completos (hoy hay pasos de una sola acción),
   AWS (DynamoDB, SES, Textract, Comprehend…), Google BigQuery/Sheets completo, Snowflake,
   Databricks, Kafka, RabbitMQ, MQTT, FTP/SFTP, LDAP, IMAP, X/Twitter, LinkedIn, Meta, Reddit,
   Typeform, Calendly, Cal.com, Webflow, WordPress, Contentful, Strapi, Ghost, PayPal, Wise, Plaid.
7. Nodo **Code** sobre el runner sandboxeado y etiquetas de campo bilingües.
