# Pendiente

Items que no entraron en las sesiones de implementación. Se ordenan por scope estimado, no por prioridad.

Última actualización: 2026-04-30. Después de los 6 commits del último push (audit chain, webhook wizard, metrics, Grafana, plugin metadata bridge, plugin tenant-scoped schema, WorkOS, Python SDK).

---

## Código pendiente

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

### 🔴 ADR 0003 fase 4: step replay (event-sourced)

**Estado:** fases 1-3 landed. ExecutionEvent table + RunState reducer + resume-worker scanner. **Falta:** la fase 4 real — caminar el event log y reconstruir `nodeOutputs`, retomar ejecución desde `lastSeq + 1`.

**Lift estimado:** 2-3 semanas. Tocar `ExecutionService` (1714 líneas), reescribir el resume path, pin de tests de replay con fixtures de event logs reales.

**Por qué no entró:** es la pieza más alto-valor del roadmap durable engine, pero también la más arriesgada. Requiere un plan de migración + un período de doble-write antes de cortar.

---

### 🔴 ADR 0004: consolidar dual executor system

**Estado:** ADR existe, dos jerarquías paralelas (`backend/src/runbook/executors/` con 10 native + `backend/src/editor/nodes/` con 13 legacy). El `EditorExecutorAdapter` es un bridge táctico que difiere la consolidación real.

**Scope:** ~3500 LOC across 23 files. Mover los 13 editor executors al runbook registry, reescribir 3 (transform, condition, storeGet/Set), borrar el adapter + el `EditorNodeExecutor` interface, aplanar el dispatcher en `NodeExecutor`.

**Lift estimado:** 2-3 semanas. Riesgo medio — el socket emit al frontend pasa por la rama editor; un cambio mal hecho rompe el live log streaming.

**Por qué no entró:** half-done es worse-than-nothing. La rama intermedia (mover archivos sin consolidar) confunde más que ayuda.

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
