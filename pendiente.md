# Pendiente

Items que no entraron en las sesiones de implementación. Se ordenan por scope estimado, no por prioridad.

Última actualización: 2026-11-07 (aprobaciones con aviso y sesión obligatoria en rutas web). Antes: 2026-11-04 (sandbox: fases 1–4 en prod). Antes: 2026-11-02 (sandbox fases 1 y 2). Antes: 2026-11-01 (integraciones: research de n8n y fase 1 del catálogo). Antes: 2026-04-30. Después de los 6 commits del último push (audit chain, webhook wizard, metrics, Grafana, plugin metadata bridge, plugin tenant-scoped schema, WorkOS, Python SDK).

---

## Código pendiente

## Foco (decidido 2026-11-05): runbooks para incidentes, no paridad con n8n

n8n gana en cantidad de integraciones y no vale la pena competir ahí. Operari se enfoca en lo que n8n no
cubre: ejecución segura en servidores propios, aprobaciones, auditoría y respuesta a incidentes. Para
integraciones raras, llamar a un workflow de n8n o a un webhook.

**En este orden:**

1. ✅ **Alertas como trigger** (2026-11-05). Fuentes `alertmanager`, `grafana`, `pagerduty` y `opsgenie`
   en el panel de triggers, con guía de configuración. Payload normalizado en `vars.alert` (name, title,
   severity, status, labels, summary, description, url, fingerprint, startsAt). Una corrida por ocurrencia
   (huella + inicio, insert único): las repeticiones de Alertmanager y los reintentos no lanzan más; tope
   de 10 corridas por envío. La resolución se anota en la corrida (`metadata.alert.resolvedAt`). Secreto
   como `Authorization: Bearer` (Alertmanager/Opsgenie no firman) o HMAC; PagerDuty: se pega su propio
   secreto y se verifica `X-PagerDuty-Signature`. La vista del run muestra alerta activa/resuelta (2026-11-07).
   **Falta:** Sentry y Datadog siguen con el parser viejo (sin dedup por ocurrencia).
2. 🟡 **Aprobar donde está el de guardia** (2026-11-07, sin desplegar). El paso de aprobación avisa por
   email, Slack (webhook) y Telegram con botón *Review*. `approvers` y `timeoutSeconds` ahora se aplican de
   verdad; `escalateAfterSeconds` + `escalateTo` reenvían el aviso y suman aprobadores. Barrido cada minuto,
   entregas en la auditoría (`approval.notified/escalated/expired`). **Decisión:** el enlace no lleva token:
   abre `/inbox?approval=<id>` y aprobar exige sesión, así valen MFA y rol, y una vista previa de Slack o
   alguien del canal no puede aprobar; el estado de la aprobación ya la hace de un solo uso. Con `approvers`
   definidos, las API keys no pueden resolver (no tienen email). **Falta:** `RESEND_API_KEY` en prod (sin
   eso los emails solo quedan en el log); probar con Slack y Telegram reales; aprobar sin salir de Slack
   (requiere una app de Slack y mapear usuarios).
3. **Línea de tiempo del incidente.** Exportar en Markdown desde la cadena de auditoría: alerta, pasos,
   salidas, quién aprobó qué y cuándo; base del postmortem.
4. **Puente a n8n / webhooks:** paso que llama un workflow de n8n (o cualquier URL) y espera su respuesta.
5. **Plantillas de incidentes comunes:** disco lleno, reiniciar servicio, rollback de deploy, certificado
   por vencer, cola atascada.

**Bajan de prioridad:** más servicios en el catálogo (#6), webhooks auto-registrados fuera de alertas,
archivos en los pasos del catálogo, validar uno por uno los 94 servicios contra APIs reales.


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
4. 🟡 **Archivos binarios entre pasos + multipart** (2026-11-04): modelo `StepFile` (bytes en disco,
   SHA-256, 7 días), el paso HTTP guarda la respuesta como archivo (`output.file`) y manda un archivo
   como cuerpo binario (subidas a Drive/Dropbox/S3) o en multipart; descarga en `GET /api/files/:id`.
   El paso de email adjunta archivos de pasos anteriores (hasta 20 MB). La vista del run muestra un enlace de
   descarga por cada archivo de la salida. El paso Code (2026-11-05) lee archivos elegidos en *Files*
   (`read_file`/`readFile`, hasta 768 KB) y guarda los que escribe (`write_file`/`writeFile`, hasta 20 y
   10 MB). **Falta:** archivos en los pasos del catálogo (hoy se suben con el paso HTTP).
5. 🟡 **Triggers por aplicación** (n8n: 116; Operari: cron + webhook). ✅ (2026-11-04) Polling genérico:
   paso "Solo ítems nuevos" (`operari.newItems`) que recuerda entre corridas qué ítems ya dejó pasar;
   cron + cualquier listado del catálogo + este paso = trigger "nuevo X" para cualquier servicio (probado
   en Postgres real, sin duplicados con corridas superpuestas). **Falta:** webhooks auto-registrados por
   proveedor (Stripe, GitHub, Slack Events) para los casos que necesitan inmediatez.
6. **Más servicios:** Excel/SharePoint/Dynamics, QuickBooks, Xero, Trello/Asana/ClickUp/Linear/GitLab
   completos (hoy son pasos de una acción), AWS (DynamoDB, SES, Textract…), BigQuery, Sheets completo,
   Snowflake, Databricks, Kafka, RabbitMQ, MQTT, FTP/SFTP, LDAP, IMAP, X/Twitter, LinkedIn, Meta, Reddit,
   Typeform, Calendly, Cal.com, Webflow, WordPress, Contentful, Strapi, Ghost, PayPal, Wise, Plaid.
7. **Formularios:** ✅ (2026-11-04) editor JSON con validación (campos `json` y "Additional fields"),
   fecha/hora con selector que escribe ISO (todo campo `(ISO)` del catálogo), headers del paso HTTP como
   filas clave/valor, botón "Probar credencial", selector de credenciales filtrado por proveedor en los
   pasos viejos. (2026-11-05) Etiquetas de campo en español: glosario en
   `frontend/lib/field-labels.ts` (traducción exacta + "X id" → "ID de X"; 641 de 688 etiquetas, el
   resto son términos técnicos que no cambian) y el menú *Operación* muestra el nombre en español que ya
   tenía el catálogo. **Falta:** multi-selección (ningún campo la necesita todavía) y descripciones de
   campo en español.
8. ✅ **Nodo Code** (2026-11-04): `operari.code`, Python 3.12 o Node 20 en el sandbox; código y entrada viajan en base64 por env (nunca en la línea de shell), resultado tras un marcador por run, red apagada salvo que se pida (con la política como techo). Probado con Docker real. (2026-11-05) Los
   valores se parten en variables de ≤60 000 caracteres: antes, una entrada de más de ~48 KB fallaba en el
   sandbox, que limita cada variable a 64 000.
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

- Endpoint `POST /api/tenants/plugins/install` con tarball upload. **Decisión (2026-11-04): no hacerlo
  antes del aislamiento en worker.** Los plugins corren dentro del proceso del backend (opción B del ADR
  0006), que tiene `ENCRYPTION_KEY`, `DATABASE_URL` y todas las credenciales: dejar que un workspace suba
  código sería ejecución remota con acceso a los secretos de todos. El camino seguro es correr los
  plugins de tenants en el sandbox (como el paso Code) y recién ahí abrir la subida.
- Opción A (worker pool) como escape hatch via `OPERARI_PLUGIN_ISOLATION=worker` env (~1 semana cuando cloud beta lo necesite — el ADR documenta el path)

---

### 🟡 Runner isolation: Fly Machines stdout/stderr (2026-11-04)

**Hecho:** con `OPERARI_RUNNER_CALLBACK_URL` (URL pública del backend), cada máquina corre un
wrapper POSIX inyectado como archivo (sin imagen especial: alcanza con `sh` + `curl` o `wget` de
busybox) que manda cada línea de stdout/stderr, numerada, a `/webhook/runner-logs/<token>`; el token
es aleatorio por máquina y vence al terminar el run. El runner emite las líneas en vivo y las
devuelve ordenadas; el exit code sigue saliendo del estado de la máquina.

**Probado:** el wrapper con Docker real en `alpine` (busybox wget) y `curlimages/curl` (exit code,
stdout/stderr separados, comillas y `$HOME` intactos, última línea sin salto); runner y ruta con
tests (orden, duplicados, tokens vencidos o inventados).

**Falta (necesita cuenta de Fly):** una corrida real en Fly Machines: confirmar que `files` con
`raw_value` y `init.exec` se aplican como en la doc, y medir la latencia de las líneas.

---

### ✅ Plugin manifest: una sola fuente (zod) (2026-11-04)

`defineStep` deriva el formulario del `configSchema` de zod cuando no se pasa `properties`
(`propertiesFromZod` ya existía pero había que llamarlo a mano). Ahora marca los campos
obligatorios y ofrece arrays, objetos, records y uniones como campo JSON que el loader parsea antes
de validar, en vez de descartarlos. `properties` escrito a mano sigue teniendo prioridad.

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

### ✅ Salidas de los pasos `core` crecían de forma cuadrática (2026-11-04)

Los pasos de flujo copiaban en su salida el scope del run (`vars`, `steps`, una clave por paso)
además de la salida de sus padres. Ahora se descartan solo las copias del scope; lo que el paso produce
y lo que pasan sus padres queda igual, así que los templates siguen funcionando. En un runbook de 9
pasos la salida de `StoreGet` bajó de ~6 KB a 54 bytes.

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
- ✅ (2026-11-04) Lint de los tests: testing-library y jest-dom ya corren como `error` y pasan limpios; los tests que verifican estructura SVG/DOM apagan las reglas de acceso a nodos con el motivo. Quedan 41 warnings generales en código de la app (`any`, variables sin usar, `console`).

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
