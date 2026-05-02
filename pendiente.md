# Pendiente

Items que no entraron en las sesiones de implementación. Se ordenan por scope estimado, no por prioridad.

Última actualización: 2026-05-02 (continuación). **20 commits locales sin pushear** (los 9 anteriores + 11 nuevos hoy): dry-run adapter fix, credentials cookie, node visual V2, kubectl native + 5 promociones legacy, hydration fix, edge Tier A/B/C/D (disabled propagation + `+` insert + last-run overlay + branch badge + approval-gated + retry stitch + cross-env + bundle counter), dashboard tenant-scope fix. **Push bloqueado en credenciales** (`gh auth login` desde la terminal).

---

## Código pendiente

### 🟡 Schema diagram: features descartados a propósito

Inspirado por chartdb pero NO implementado, en orden de probabilidad de pedido:

- **DBML import** (parsear DBML → diagrama). Hoy solo exportamos. Útil si un usuario quiere bocetar un schema antes de conectar la DB. Necesita `@dbml/parse` o un parser propio. ~2-3 días.
- **Multi-DB introspection** (MySQL / SQL Server / SQLite / Oracle / ClickHouse). El frontend ya es DB-agnostic; falta extender `/api/sql/metadata` y agregar el connector backend. ~1 semana por motor.
- **DDL paste import**. chartdb tiene 2247 LOC de parser PG; nuestro flow asume DB conectada en vivo, así que es de bajo valor.
- **Index visualizer panel**. El endpoint ya devuelve indexes (btree/gin/etc); falta una UI que los liste por tabla con su `unique`/`isPrimary`/`columns`. ~1 día.
- **Custom-types panel** (PG ENUMs + composite). Endpoint los devuelve, falta UI. ~1 día.
- **Runbook diff view**. `RunbookVersion` model ya existe; falta un visualizer que compare dos versiones lado a lado, similar al schema diff. ~3-4 días.
- **Comments on runbook nodes**. Modelo Prisma + auth + UI = sprint propio. ~1 semana.
- **Cross-dialect SQL DDL export con AI**. Requiere OPENAI_API_KEY y nuestro use case no es migración entre motores. ~2 días si decidimos hacerlo.

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

### 🟠 Plugin tenant-scoped install: endpoint UX

**Estado:** runtime listo (commit `f3697a7` + ADR 0006). Filesystem layout funciona: drop a `OPERARI_PLUGINS_DIR/tenants/<tenant-id>/<plugin>/`. **Falta:** UX para que un admin de tenant suba un plugin desde el browser.

**Diseño pendiente:**

1. `POST /api/tenants/plugins/install` admin-only, multipart tarball upload
2. Backend extrae el tarball, valida `operari.json`, escribe a `OPERARI_PLUGINS_DIR/tenants/<tenant-id>/<plugin-slug>/`
3. Hot-reload: el loader actual es sync-at-boot, hay que llamarlo otra vez después del extract
4. UI en Settings: lista de plugins instalados por tenant + botón "Install plugin" + DELETE

**Lift estimado:** 4-6 días. El runtime ya valida cross-tenant; sólo falta UX + hot reload.

**Por qué no entró:** scope grande para una sesión + decisión sobre tarball vs git URL + estrategia de hot-reload.

---

### 🟠 Plugin loader: opción A (worker pool) escape hatch

**Estado:** documentado en ADR 0006 como future path bajo `OPERARI_PLUGIN_ISOLATION=worker`. El interfaz `StepExecutor` ya soporta `tenantId`, sólo falta el dispatcher worker-pool real.

**Cuándo lo necesitamos:** cloud beta multi-tenant donde plugins son untrusted. Antes de eso (self-host single-tenant), opción B (in-process filter, ya shipped) es suficiente.

**Lift estimado:** ~1 semana. Spawn pool de procesos Node-side por tenant, IPC sobre stdio con framing JSON, supervisor para restart, lifecycle hooks en tenant create/delete.

**Por qué no entró:** runner isolation (Fly Machines) es la pieza más urgente del aislamiento real. Cuando esa madure, hay que re-decidir si plugin-level isolation sigue siendo necesario sobre run-level isolation.

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

### 🟡 Python SDK: paridad operativa con TS

**Estado:** v0.2 shipped. Cliente + step authoring + IPC bridge + loader Node-side end-to-end + ejemplo + 18 tests del SDK + 4 tests integration en backend.

**Pending para paridad operativa:**

- Pydantic-based config schemas como camino recomendado en docs (~1 hora — ejemplo + sección README)
- Async execute (`asyncio`) para plugins que hacen I/O concurrente (~2-3 días — el bridge ya soporta async via su naturaleza subprocess; falta pulir el surface en `define_step`)
- Publicación a PyPI (paquete actualmente sólo se instala desde repo) (~1 día — pyproject ya está, falta el workflow de release + sign keys)
- Streaming logs durante ejecuciones largas (hoy emite live via stdout pero el ejemplo solo emite al final del execute) (~1 día — patrón `context.emit()` repetido en docs)
- `properties_from_pydantic` helper espejo de `propertiesFromZod` del TS SDK (commit `84a192e`) (~3-5 horas)

**Lift estimado restante:** 1 semana para los 5 items.

**Por qué no entró:** los 5 son operativos / docs, no bloquean ningún feature. Decidir prioridad y atacarlos individualmente cuando haga falta.

---

## Operativos / no-código (afuera del repo)

| Item                                            | Estado                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Public demo instance                            | None                                                                                    |
| Loom 90s walkthrough                            | None                                                                                    |
| Dominio + trademark `Operari`                   | El repo está en `Hvelizgr/NanoFlow`, dominios `.dev/.io/.com` no asegurados             |
| 5 design partners en producción                 | Zero                                                                                    |
| 30 discovery interviews con platform engineers  | Zero                                                                                    |
| Show HN draft + post                            | None                                                                                    |
| Hosted free tier deploy                         | Código listo (Stripe + WorkOS), falta el deploy real                                    |
| WorkOS organization + creds reales              | Adapter listo (commit `8c784b8`), falta la cuenta WorkOS y un dominio verificado        |
| Grafana dashboard import en un instance real    | JSON listo en `deploy/grafana/`, falta probarlo contra Prometheus en vivo               |
| Push de los 9 commits locales                   | Bloqueado en credenciales — `git push origin main` desde tu terminal o `gh auth login`  |

---

## Lo que NO va al roadmap (decisión deliberada)

Del README, copia textual:

> No marketplace, no real-time collab, no MCP server, no service catalog. If a customer asks for them, they go on the list. Until then, they don't exist.

Si un usuario pide algo de esto, agregalo arriba con un estimado.

---

## Lo que se cerró desde la última actualización del pendiente

### Sesión 2026-05-02

- ✅ **Dry-run en legacy editor executors** (commit `225f7e0`) — `EditorExecutorAdapter` short-circuita en `context.dryRun` con un payload sintético. Cubre los 15 legacy executors a la vez (Email/HTTP/StoreSet/Condition/...) que antes ejecutaban side effects reales durante "Simulación". 2 tests nuevos en `dry-run.test.ts` pinean la regresión.
- ✅ **Credentials cookie en useWorkflowExecution** (commit `a5bfd18`) — `fetch(...)` faltaba `credentials: 'include'` en los 3 entry points (executeWorkflow, executeFromNode, replayNode). El JWT cookie se caía y algunos browsers dejaban la promesa pending eternamente, freezando el toolbar en "Launching…". Test que itera los 3 + asserta `credentials === 'include'`.
- ✅ **Node visual personalization V2 + SRE signals** (commit `106e705`) — tres bundles combinados:
  1. **Bundle 1 — quick wins:** trigger silhouette (pill izq en `data-category="triggers"`), halt-point stripe (4px ámbar en approval/wait/Suspend), branch labels en multi-output handles (n8n parity), disabled polish (dashed + opacity-60).
  2. **Bundle 2 — nodeShape + nodeDensityV2 user-configurable:** 5 shapes (rounded-rect/pill/hex/circle/rectangle) + 3 densities (comfortable/compact/dense) en Settings → Apariencia → Nodos. Pipeline completo (types → defaults → context → dom → CSS → strings EN+ES → NodesTab → presets).
  3. **Bundle 3 — SRE-tailored signals:** `NODE_VISUAL_METADATA` per-type con `blastRadius` (readonly/writes/destructive), `idempotent`, `touchesSecrets`. Outline verde/ámbar/rojo, badges key + repeat en header, sparkline bars proporcionales a `durationMs`, status pill "last failed" bajo el nodo.
- ✅ **kubectl native + 5 promociones legacy → palette** (commit `73e85f6`) — `KubectlExecutor` (~150 LOC + 9 tests) materializa kubeconfig YAML a tempdir mode 0o600 + KUBECONFIG env + cleanup en `finally` (sobrevive runner throw). Email, Switch, StoreGet, StoreSet, Transform agregados al seed + catalog con visual metadata. Restauradas categorías `flow` e `integrations` al CATEGORIES list.
- ✅ **Hydration mismatch en staggerChildVariants** (commit `7b2912b`) — framer-motion serializa la variant inicial como CSS string en SSR (`opacity: "0"`, sin transform) vs object en client. `staggerChildInitialStyle` exportado de `lib/motion.ts` y aplicado en DashboardPage / ApprovalInbox / MonitorsPage como `style` prop explícito. SSR HTML matchea client; framer anima encima sin warning.
- ✅ **Edge research + 4 tiers de mejoras visuales** (commits `0e867dc` `f9c1127` `31aa67a` `3f4c8eb`) — disabled-source propagation + mid-edge `+` insert button + last-run overlay + branch-taken badge + approval-gated edge + retry stitch + cross-env labels + bundle counter chip. n8n parity + diferenciadores SRE que ningún competidor tiene. Tier D #10 (click-edge inspector con payload diff) deferido.
- ✅ **Cascading hang del backend tras hit a `/api/dashboard/overview`** (commit `497ed73`) — `dashboard.routes.ts:214` y `:227` tenían 2 `prisma.execution.findMany()` filtrando solo por `runbookId`, sin `tenantId`. El runtime tenant-scope guard rechazaba la query, throw inside Prisma `$use`, Promise.all surface el reject, Express deja la response colgada, connection pool envenenado → toda request siguiente cuelga eternamente, incluyendo `/api/templates`. Síntoma manifestado como "no inician las simulaciones" — el backend no podía contestar nada después del primer dashboard render. Fix: agregar `tenantId` explícito a ambas queries (mismo patrón que `runbook.routes.ts:230` que ya documentaba el gotcha en un comentario). En prod el guard hace soft-fail (logea + sigue), en dev throws hard — por eso solo aparece local.

### Sesión anterior (2026-04-30)

- ✅ **SQL editor schema diagram** — `/api/sql/metadata` rich PG introspection + `SchemaDiagram` canvas con TableNode + RelationshipEdge (React Flow), schema filter, PNG/SVG/DBML/JSON export, schema diff entre dos snapshots con coloring per-tabla y per-columna. Capability-gated por provider (`postgres`/`mysql` only). Inspirado por chartdb (AGPL), implementación nueva — ver `docs/research/chartdb-research.md`.
- ✅ **Runbook lineage page** (`/lineage`) — backend agrega `runbook` step refs + `onErrorRunbookId` en un solo grafo, frontend lo renderiza con depth-based layout. Tenant-scoped via Prisma. Linkeable desde sidebar y command palette (`G L`).
- ✅ **YAML diff-apply en runbook editor** — `reconcileWorkflow` + `reconcileFromWorkflow` action. Editar el YAML ya no hace snap-back de positions/selección; nodos sobrevivientes mantienen su layout, solo el body cambia.
- ✅ **Step-stats per-step overlay** (Commit L) — `/api/runbooks/:id/step-stats` con p50/p95/failureRate por nodeId. Toggle "Show stats" en toolbar pinta run-history strip + heat-tint en BaseStepNode.
- ✅ **Connected-account capabilities table** — `packages/shared/src/types/connected-account-capabilities.ts` declara qué soporta cada provider (`canQuery`, `canIntrospectSchema`, `usesOAuth`, etc). Frontend deshabilita la pestaña Diagram para providers non-SQL; backend rechaza `/api/sql/*` para non-SQL providers con 400 + `capability_unsupported`.
- ✅ **DBML export determinístico** — `frontend/lib/sql/dbml-export.ts`, sin AI, diff-friendly, output estable byte-a-byte.
- ✅ **Plugin manifest auto-form para built-ins** (commit `b7cab40`) — `Property[]` en el seed para 11 step types built-in. El editor renderiza form real en lugar de JSON textarea.
- ✅ **Plugin metadata bridge SDK → DB** (commit `98b0251`) — `defineStep` extiende `PluginStepMetadata`, loader extrae visual + form metadata, upsert async al boot.
- ✅ **Plugin tenant-scoped schema** (commit `f33efd4`) — composite unique `(type, tenantId)` + partial unique en `(type) WHERE tenantId IS NULL`.
- ✅ **WorkOS SSO callback** (commit `8c784b8`) — `/api/auth/workos` + `/callback` + frontend button + 9 tests con mocked exchange. El adapter ya estaba.
- ✅ **Python SDK v0.1** (commit `cb07e2d`) — `define_step` + `PluginContext` + `PluginResult` + IPC bridge + ejemplo + 18 tests pytest.
- ✅ **propertiesFromZod helper** (commit `84a192e`) — derivar `PluginStepProperty[]` desde un schema zod, peer dep opcional, 12 tests.
- ✅ **Python plugin loader bridge** (commit `448eafc`) — `python-bridge.ts` con spawn + EMIT/RESULT parsing live + stderr capture + timeout. Loader lee `operari.json` standalone para Python plugins. 4 tests integration.
- ✅ **Plugin tenant-scoped runtime** (commit `f3697a7` + ADR 0006) — registry composite-keyed, dispatcher tenant-scoped routing, cross-tenant rejection, escape hatch documentado para opción A worker pool.
- ❌ **Schedule defaultEnv loose end** — era ruido mío, no existe tal comentario en el código actual.

---

## Tests baseline al cierre de la sesión 2026-05-02

- Backend: **1330+** passing (+9 kubectl tests, +2 dry-run adapter tests sobre los 1321+ de la sesión anterior)
- Frontend: **287+** passing (+2 credentials-cookie tests, +35 canvas/visualization tests sin regresión)
- Python SDK: **18 / 18** passing
- tsc clean ambos lados (TS)
- 14 commits locales sin pushear sobre `feat/editor-reactflow-rebuild`.

## Tests baseline al cierre de la sesión 2026-04-30

- Backend: **1321+ / 1321+** passing (+3 lineage tests, +5 metadata tests, +3 capability-gate tests, +4 step-stats tests)
- Frontend: **285 / 285** passing (+24 desde 261: capabilities, dbml-export, sql-diff, sql-metadata, reconcile)
- Python SDK: **18 / 18** passing
- tsc clean ambos lados (TS)
- Bundle: `/sql-editor` 10.8 kB / 126 kB · `/lineage` (nueva) 1.41 kB / 104 kB · `/editor` 119 kB / 307 kB
- Aún sin commitear: feat/editor-reactflow-rebuild branch tiene 30+ archivos modificados pendientes de split en commits temáticos.
