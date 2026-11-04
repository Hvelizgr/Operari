# Pendiente

Items que no entraron en las sesiones de implementación. Se ordenan por scope estimado, no por prioridad.

Última actualización: 2026-11-04 (sandbox: fases 1–4 en prod). Antes: 2026-11-02 (sandbox fases 1 y 2). Antes: 2026-11-01 (integraciones: research de n8n y fase 1 del catálogo). Antes: 2026-04-30. Después de los 6 commits del último push (audit chain, webhook wizard, metrics, Grafana, plugin metadata bridge, plugin tenant-scoped schema, WorkOS, Python SDK).

---

## Código pendiente

### 🟢 Sandbox para terminal y runbooks; sudo solo por SSH a servidores propios (2026-11-01)

**Detalle y diseño:** [`docs/sandbox-research.md`](docs/sandbox-research.md).

**Estado (2026-11-04):** fases 1 a 4 **en producción**. Pasos shell y terminal en el sandbox
rootless; servidores registrados con clave del host fijada; política de ejecución por workspace;
proxy de salida con lista permitida; CA SSH por workspace.

**Hallazgo original:** el runner `local` comparte el uid del backend: desde la terminal se lee
`/proc/1/environ` (`DATABASE_URL`, `ENCRYPTION_KEY`, `JWT_SECRET`, API keys) y se llega a Postgres,
Redis y los otros sitios de la red `web`. Prod usa el runner `sandbox` desde 2026-11-02.

**Hecho y verificado en prod (2026-11-04):**

- Proxy de salida en el daemon rootless: `pip install` con `pypi.org` permitido funciona;
  `example.com` → 403; sin proxy no hay ruta; un sandbox en modo lista y otro con internet abierta
  no llegan a un tercer sandbox; una IP por el proxy → 403. (Dos bugs encontrados y arreglados en
  `f76d1db`: el proxy no arrancaba por el comentario de source map con `node -e`, y los pasos
  tenían `HOME=/` de solo lectura.)
- SSH a este servidor desde el backend: la huella escaneada coincide con `ssh-keygen -lf` del host;
  con la clave correcta autentica y corre el comando forzado; con otra clave fijada se rechaza antes
  de autenticar. (`~/bin/operari-ssh` no tenía `+x`: la clave de deploy no servía; arreglado.)
- Certificados: emisión real con `ssh-keygen` en el backend (6 min de validez, principal = usuario
  del servidor, sin reenvíos, solo `permit-pty`), CA guardada cifrada.
- Túnel SSH del paso de base de datos por `serverId`, con la clave del host fijada y la misma
  política SSH; el runner `docker` también respeta la política de salida (lista → sin red, porque
  no tiene proxy). Tests de rutas `servers` y `execution-policy`.

**Falta (requiere `sudo` en el servidor):**

1. Login real con certificado: en Configuración → Servidores → *Mostrar CA*, copiar el snippet y
   correrlo en el servidor (`TrustedUserCAKeys` + `systemctl reload ssh`); registrar el servidor en
   modo certificado y *Probar conexión*.
2. Paso privilegiado de punta a punta: un usuario con `sudoers` acotado, p. ej.
   `operari-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart nginx`, registrado con *sudo
   permitido*, y un runbook aprobación → `ssh` con *Run with sudo*.

**Decisiones (no se van a hacer salvo que haga falta):**

- El runner `local` no puede aplicar la política de salida (corre en el host); en prod no se usa.
- Verificación de propiedad del servidor (token en `~/.operari-verify`): no implementada. La raíz de
  confianza es el admin del workspace confirmando la huella; un token no protege contra ese admin y
  solo agrega pasos.
- Los servidores registrados siguen pasando por el SSRF guard: con
  `OPERARI_ALLOW_PRIVATE_TARGETS=false` no se registran IPs privadas.
- gVisor: sin instalar (opcional, `install-rootless.sh --with-gvisor` + `acceptance.sh` con
  `OPERARI_SANDBOX_RUNTIME=runsc`).

### 🔴 Catálogo de integraciones: lo que falta después de la fase 1 (2026-11-01)

**Detalle completo, inventario de n8n y auditoría:** [`docs/integrations-research.md`](docs/integrations-research.md).

**Lo que shipeó** (`deb2c15`, `fe74d97`): constructor declarativo `service()`, 94 servicios con 667
operaciones, 9 utilitarios, 6 categorías nuevas en la paleta y formulario de credenciales que ofrece
todos los proveedores del catálogo. Catálogo en prod: 89 → 192 tipos de paso. Cobertura frente a n8n:
~1/3 de sus integraciones (324), sin contar triggers (116).

**Pendiente, en este orden:**

1. ✅ **OAuth2 genérico con refresh** (2026-11-04, `c00f821`): "Conectar con…" para Google, Microsoft,
   Slack, HubSpot, Salesforce, Zoom, Dropbox y Zoho; el token se renueva solo antes de cada paso.
   **Falta (tuyo):** URI de redirección en cada consola y `OAUTH_<PROVEEDOR>_CLIENT_ID/_SECRET` en `.env`.
2. ✅ **Listas dinámicas** (2026-11-04, `efe31a6`): canales/usuarios de Slack, repos de GitHub, bases de
   Notion, proyectos de Jira, calendarios de Google, equipos/canales de Teams. Loaders fijos del lado del
   servidor, sin URLs del cliente; cada lectura auditada.
3. ✅ **Paginación "traer todo"** (2026-11-04): opción *Return all* con tope de ítems en los listados de Slack, GitHub, Jira, Notion, Stripe y más; estrategias cursor, `Link`, último id y offset. Un `Link` a otro origen no se sigue (llevaría la credencial).
4. **Archivos binarios entre pasos + multipart** (subir a Drive/Dropbox/S3, adjuntos de email, OCR).
5. **Triggers por aplicación** (n8n: 116; Operari: cron + webhook). Webhook auto-registrado o polling con cursor.
6. **Más servicios:** Excel/SharePoint/Dynamics, QuickBooks, Xero, Trello/Asana/ClickUp/Linear/GitLab
   completos (hoy son pasos de una acción), AWS (DynamoDB, SES, Textract…), BigQuery, Sheets completo,
   Snowflake, Databricks, Kafka, RabbitMQ, MQTT, FTP/SFTP, LDAP, IMAP, X/Twitter, LinkedIn, Meta, Reddit,
   Typeform, Calendly, Cal.com, Webflow, WordPress, Contentful, Strapi, Ghost, PayPal, Wise, Plaid.
7. **Formularios:** multi-selección, colecciones clave-valor, editor JSON, fecha/hora; etiquetas de campo
   bilingües; botón "Probar credencial"; los pasos viejos (`slack.message`, `jira.issue`…) todavía no
   filtran el selector de credenciales por proveedor.
8. **Nodo Code** (JS/Python) sobre el runner sandboxeado.
9. **Validar contra las APIs reales.** Los tests cubren la construcción de cada request con `fetch`
   simulado, no respuestas reales: probar cada servicio con una cuenta real a medida que se use.


### 🟡 Plugin loader: tenant-scoped runtime

**Estado:** decidido y shipped. Schema (`f33efd4`) + scoped upsert + dispatcher tenant-scoped routing (commit pending).

**Decisión: opción B (in-process filter)** documentada en [`docs/adr/0006-plugin-runtime-tenant-isolation.md`](docs/adr/0006-plugin-runtime-tenant-isolation.md).

**Lo que shipeó:**

- `StepExecutor` interface gana `readonly tenantId?: string`
- Loader scanea `OPERARI_PLUGINS_DIR/tenants/<tenant-id>/<plugin>/` además del top-level
- Registry usa key compuesta: `${tenantId}::${type}` para tenant-scoped, `${type}` para globales
- Dispatcher hace lookup tenant-scoped primero, fallback a global; cross-tenant rechazado con `NODE_NOT_FOUND`
- `upsertPluginNodeTypes` se llama una vez por tenant + una vez para globales
- Reserved types siguen aplicando (un plugin tenant-scoped no puede claim `shell`)

**Pendiente para production multi-tenant** (no para self-host):

- Endpoint `POST /api/tenants/plugins/install` con tarball upload (UX, no runtime — runtime ya funciona)
- Opción A (worker pool) como escape hatch via `OPERARI_PLUGIN_ISOLATION=worker` env (~1 semana cuando cloud beta lo necesite — el ADR documenta el path)

---

### 🟠 Runner isolation: Fly Machines stdout/stderr sidecar

**Estado:** `FlyMachineRunner` está 80% real (CREATE/WAIT/STATE/DELETE + cancellation working). **Falta:** captura de stdout/stderr — hoy retorna vacío, marcado en código como "v1.1 sidecar pattern pending".

**Diseño pendiente:** la imagen del runner POSTea sus chunks de output a un webhook callback de Operari. Requiere:

1. Endpoint `POST /api/internal/runs/:runId/chunk` con HMAC firmado
2. Imagen Docker base con sidecar agent que tail-ea stdout y postea
3. Routing en `ExecutionService` para mergear los chunks contra el step en curso

**Lift estimado:** 1-2 semanas. Necesita infra de prueba real (Fly account o emulador) — no mockeable end-to-end.

**Por qué no entró:** sin Fly account + un environment de prueba, los tests serían mocks puros que no prueban el contrato real.

---

### 🟠 Plugin manifest: declarativo via JSON Schema (no Zod)

**Estado:** `defineStep` SDK ya acepta `properties: PluginStepProperty[]` (commit `98b0251`). **Falta:** convertir el `configSchema` (zod) en JSON Schema automáticamente para el editor.

**Hoy:** un autor de plugin escribe el schema dos veces — una vez como `configSchema` (zod, runtime) y otra vez como `properties[]` (form metadata). Idealmente sería una sola fuente.

**Lift estimado:** 3-5 días. Agregar `zod-to-json-schema`, derivar el `properties[]` automáticamente, dejar el override manual cuando el autor quiera.

**Por qué no entró:** scope creep en una sesión que ya tocó SDK + loader + DB. Mejor en su propio batch.

---

### ✅ ADR 0003 fase 4: step replay (event-sourced) (2026-11-04)

Hecho. El replay ya existía (`049395a`) pero estaba apagado y tenía dos bugs: seguía todas las
ramas al reanudar (ejecutaba la rama que una condición había descartado) y un crash antes del primer
paso terminaba en "éxito" sin ejecutar nada. Arreglados con una frontera compartida con el motor;
los pasos interrumpidos se repiten solo si son seguros (flujo, datos, esperas, GET), si no el run se
marca fallado con el motivo. Probado con un SIGKILL real a mitad de un paso. Encendido en prod
(`OPERARI_RESUME_WORKER_ACT/REPLAY=true`). Detalle en el ADR.

**Pendiente menor:** reanudar a mitad de un loop (hoy abandona) y clasificar como seguros los
GET de los servicios del catálogo (hoy cuentan como no seguros).

---

### ✅ ADR 0004: consolidar dual executor system (2026-11-04)

Hecho. Una sola interfaz (`StepExecutor`), un solo registro (`createExecutorRegistry`) y un solo
camino de despacho. Los 19 pasos heredados viven en `runbook/executors/core/` sobre `FlatInputStep`,
con el mismo comportamiento; se borraron `editor/nodes/`, `editor/logic/`, el adaptador y la
interfaz vieja. Queda a propósito sin hacer el renombre de `editor/execution/` (solo cosmético).
Detalle en el ADR.

---

### 🟡 Python SDK: paridad completa con TS

**Estado:** v0.2 + paridad operativa (2026-10-29). Loader Node-side, integración end-to-end, `execute` async (`7eda448`), docs de Pydantic / async / streaming con `context.emit` (`e1c94a1`), workflow de release a PyPI con trusted publishing (`c660f08`). 20/20 tests.

**Pendiente (fuera del código):**

- Registrar el proyecto `operari` en PyPI y agregar este repo + `release-python.yml` + environment `pypi-publish` como trusted publisher; después, tag `python-sdk-v0.2.0` (y subir `version` en `pyproject.toml`, hoy `0.1.0`)

---

### ✅ Editor canvas: cierre de la migración a React Flow (2026-10-29)

Migración commiteada y probada contra el backend real (runbook demo + plantilla `db-migration-prisma`): carga, fit view, drag, conectar, undo, autosave y recarga persisten. Arreglado en el camino: autosave (falso "Conflict" y columna JSON sin actualizar), fit view al abrir `?id=` y tope de 100 %, warning 015, seed del demo, espaciado de YAML, minimapa de React Flow con click para centrar, esquina inferior derecha sin superposiciones, menú contextual con Escape, notas visibles, fondo `lines` sin línea vertical, undo/redo fuera de los updaters de React (en dev se ejecutaban dos veces), runbooks demo viejos normalizados al cargar, ESLint flat config en el frontend y tests de los handlers de frames.

**Pendiente:**

- Estilos de flujo animados (`orbs`/`comet`/`particles`/`gradient`): solo se ven con un run en curso y el canvas 2D viejo ya no existe para comparar; ajustar velocidades a ojo si no convencen
- Los tests nunca estuvieron bajo lint: `eslint .` muestra ~70 warnings de testing-library/jest-dom (configurados como warning para no romper CI); limpiarlos y subirlos a error

---

### ✅ Producción operari.hvelizgr.dev (2026-10-29)

- Registro bloqueado con 429: Express sin `trust proxy` → todos los visitantes compartían un cupo de 5/min. `TRUST_PROXY=2` + el tier auth ya no cuenta GETs (`97fb6c0`)
- `OPERARI_DEV_LOGIN_ENABLED` estaba en `true` en el sitio público → forzado a `false` en el overlay (`071fae6`)
- `OPERARI_SECRET_KEY` nunca llegaba al contenedor → MFA daba 500 y el worker de rotación no arrancaba (`dfedc5e`); clave generada en `.env` del servidor
- Rate limit siempre en memoria (se creaba antes de que Redis conectara) → ahora en Redis, con fallo abierto si Redis cae (`455d597`)
- Runbooks demo con forma vieja: 0 en este servidor; para self-hosts viejos el editor los normaliza al cargar (`eb543a7`), porque `db push` no aplica migraciones SQL
- Paso shell colgado ignoraba su timeout y no se podía cancelar (el `SIGKILL` solo mataba el `sh`): ahora se mata el grupo de procesos (`be29863`)
- El build de las imágenes caía por timeouts de npm con conexión lenta: caché de npm persistente en los Dockerfiles

---

## Operativos / no-código (afuera del repo)

| Item | Estado |
| ---- | ------ |
| Public demo instance | None |
| Loom 90s walkthrough | None |
| Dominio + trademark `Operari` | El repo está en `Hvelizgr/NanoFlow`, dominios `.dev/.io/.com` no asegurados |
| 5 design partners en producción | Zero |
| 30 discovery interviews con platform engineers | Zero |
| Show HN draft + post | None |
| Hosted free tier deploy | Código listo (Stripe + WorkOS), falta el deploy real |
| WorkOS organization + creds reales | Adapter listo (commit `8c784b8`), falta la cuenta WorkOS y un dominio verificado |
| Grafana dashboard import en un instance real | JSON listo en `deploy/grafana/`, falta probarlo contra Prometheus en vivo |

---

## Lo que NO va al roadmap (decisión deliberada)

Del README, copia textual:

> No marketplace, no real-time collab, no MCP server, no service catalog. If a customer asks for them, they go on the list. Until then, they don't exist.

Si un usuario pide algo de esto, agregalo arriba con un estimado.

---

## Tests baseline al cierre de la última sesión

- Backend: **1322/1323** passing, 1 skipped (2026-10-29). Las 6 fallas viejas arregladas: SDK sin buildear en CI, tests de `admin.overview` desactualizados, `operari.postgres` renombrado y el runner que no mataba el árbol de procesos
- Frontend: **254/254** passing; `eslint .` sin errores (flat config)
- Python SDK: **20/20** passing
- tsc clean ambos lados (TS)
