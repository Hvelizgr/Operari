# Pendiente

Items que no entraron en las sesiones de implementación. Se ordenan por scope estimado, no por prioridad.

Última actualización: 2026-05-02 (sesión final 17:30+). **37 commits locales sin pushear** (9 anteriores + 28 nuevos hoy). Push bloqueado en credenciales (`gh auth login` desde la terminal).

Stack acumulado de la sesión, en orden cronológico:

1. **Dry-run adapter fix** (`225f7e0`) — short-circuit en EditorExecutorAdapter cubre los 15 legacy executors.
2. **Credentials cookie** (`a5bfd18`) — `credentials: 'include'` en useWorkflowExecution destrabó el "Launching…" eterno.
3. **Node visual V2** (`106e705`) — 3 bundles combinados: trigger silhouette + halt-point stripe + branch labels + nodeShape/nodeDensityV2 user-config + blast-radius outlines + secret/idempotent badges + sparkline bars + status pill.
4. **kubectl native + 5 promociones legacy** (`73e85f6`) — KubectlExecutor (~150 LOC + 9 tests) + Email/Switch/StoreGet/StoreSet/Transform al palette.
5. **Hydration fix** (`7b2912b`) — staggerChildVariants SSR mismatch resuelto via `staggerChildInitialStyle`.
6. **Edge Tier A/B/C/D** (`0e867dc` `f9c1127` `31aa67a` `3f4c8eb`) — disabled propagation + `+` insert + last-run overlay + branch-taken badge + approval-gated lock-bead + retry stitch + cross-env + bundle counter.
7. **Dashboard tenant-scope fix** (`497ed73`) — cascading hang resuelto.
8. **ExecutionError tenant-scope fix** (`1622c61`) — error real ya no enmascarado por guard violation.
9. **useExecutionSocket backfill** (`b4d9b98`) — runs cortos pintan estado final via GET `/api/runs/:id`.
10. **In-canvas run console** (`1ce814c` + `57904f2`) — terminal-style standalone, no requiere durable engine.
11. **Step-by-step replay** (`67cbc72`) — dry-runs animan a 600ms/step para ver el flujo.
12. **Property hygiene** (`989f3ef`) — shell/kubectl/approval missing fields + Transform `code` removed + Switch dedup + postgres→database rename + preview truncation.
13. **Sub-runbook en palette** (`05c3aba`) — entry agregada con runbookId/inputs/waitFor/timeoutSeconds.
14. **Templates con bucles/decisiones/preguntas** (`91f2aee`) — branch-on-environment, iterate-services-healthcheck, decision-then-approve.
15. **Dashboard React key fix** (`10d6080` + `1182d04`) — runbook id como key + fallback defensivo.
16. **Collapsed-by-default cards** (`277abda`) — title + footer + chevron por default; doble-click expande preview/tags.
17. **Field-name chips + secondary chip extension** (`65daa02`) — chips por property con filled/outlined state + operator/cases/items chips para if/Switch/Loop/notify/wait/kubectl/database.
18. **Louder run animations** (`4c83bf7`) — SUCCESS_BUMP scale 4→8% + glow brillante; FAIL_SHAKE 3→8px shake + scale + red glow; STEP_GAP 80→250ms; demo template `test-fail-animation`.
19. **RunDialog empty-state placeholder** (`d81275a`) — `{ "key": "value" }` literal movido a `placeholder` (gris) + parse vacío como `{}`.
20. **Debug button = post-hoc inspect bubbles** (`de60827`) — Option A del research debug. RfNodeData.output/error backfilleado, BaseStepNode renderea inspect panel cuando expandido. `?debug=1` URL auto-expande todos los nodos.
21. **Tier C edge data wiring (3/4)** — `runs.routes.ts` cuenta ExecutionError por `nodeLogId` y devuelve `retries` por step; `useExecutionSocket` propaga retries a edges entrantes y Loop `output.count` a edges salientes; `editorStore.setStepStats` patcha `p50DurationMs` (target.p50) en una sola pasada. `crossEnv` queda pending en pendiente — necesita `env` metadata en ConnectedAccount.

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
- ✅ **ExecutionError.findFirst tenant-scope** (commit `1622c61`) — mismo patrón que el dashboard pero en `ExecutionService` líneas 1408 y 1602. Cuando un step de alta severidad fallaba (real run con shell exit≠0), el catch path buscaba el ExecutionError persistido sin filtrar por tenantId, el guard throw, y el error real ("[ERR_3000] Command exited with code 2") quedaba enmascarado bajo "[ERR_1000] Tenant-scope guard" — confundiendo al SRE durante post-mortem.
- ✅ **useExecutionSocket backfill** (commit `b4d9b98`) — dry-runs completaban en 60ms, antes que el Socket.io client se conecte y se una a la execution room. Sin backfill el canvas quedaba idle aunque el run terminó. Fix: GET `/api/runs/:id` al mount aplica el estado final per-step antes de subscribir al socket. Síntoma "como si iniciara y al momento termina" cerrado.
- ✅ **In-canvas run console terminal** (commits `1ce814c` + `57904f2`) — drawer pinned al fondo del editor que muestra cada evento como console.log. Versión inicial wrapeaba `Runs/ExecutionEventLog` (V1-tied + requería `OPERARI_DURABLE_ENGINE=true`); rewrite standalone que subscribe a Socket.io directamente + backfill via `/api/runs/:id`. Sin durable engine dependency. Color-coded por nivel, auto-follow tail, captura wheel events para no panear el canvas.
- ✅ **Dry-run step-by-step replay** (commit `67cbc72`) — runs en 40ms hacían que todos los nodos pintaran verde de golpe, defeating the "watch how this runbook would work" purpose de Simulación. Replay con 600ms/step + 80ms gap en useExecutionSocket + EditorRunConsole. El backend completa rápido, el frontend "actúa" la ejecución secuencialmente. Solo aplica a dry-runs terminados (no a runs reales).
- ✅ **Property hygiene + canvas-bloat truncation** (commit `989f3ef`) — `shell` agregó `shell` binary + `failOnNonZeroExit`; `kubectl` agregó `kubeconfigSecret` + `failOnNonZeroExit`; `approval` agregó `timeoutSeconds`; `Transform` removió campo `code` (executor lo ignora post-pivot); `Switch` dedup (estaba en core+flow); seed renombró `operari.postgres` → `operari.database` (matchea registry). Preview truncation: `compactPreview()` cap a 60 chars + first-line only en nodeChrome; SSH `user@host` chip cap host a 24 chars.
- ✅ **Sub-runbook step en palette** (commit `05c3aba`) — `runbook` step type estaba registrado en runtime + seed + visual metadata pero faltaba en frontend NODE_TYPES. Operadores no podían draggearlo. Agregada entry con 4 properties (runbookId, inputs JSON, waitFor sync/async, timeoutSeconds).

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

## Tests baseline al cierre de la sesión 2026-05-02 (final)

- Backend: **1330+** passing — 91 backend executor tests verde (kubectl 9, dry-run adapter 7, otros 75) + sin regresiones en routes/services
- Frontend: **287+** passing — 72 tests en components/Editor + lib/canvas + context/visualization + hooks/credentials, todos verde
- Python SDK: **18 / 18** passing
- tsc clean ambos lados (TS)
- **28 commits locales sin pushear** sobre `feat/editor-reactflow-rebuild`.

### Pendientes para la próxima sesión

- **Verificar UI en browser** — todo testeable necesita ojo humano (canvas paint, edge animations, run console, property forms)
- **Push de los 28 commits** — `gh auth login` desde terminal del usuario
- **Decidir untrack de CLAUDE.md** — `git rm --cached CLAUDE.md` (gitignored pero sigue trackeado)
- **30+ archivos pre-existentes de la rama** — trabajo del usuario previo al inicio de mi sesión, sigue pendiente de split en commits temáticos
- **README desactualizado** — dice "9 step types" / "6 templates curados", actualmente son ~16 tipos en palette y 17 templates seeded
- **Tier C edge data wiring (parcial)** — `data.retries` (backfill desde `ExecutionError` por `nodeLogId`), `data.items` (Loop `output.count`), `data.p50DurationMs` (mirror del target step en `setStepStats`) wired en sesión post-2026-05-02. **Falta `data.crossEnv`** — necesita `env` metadata en `ConnectedAccount` (no existe en schema hoy) + derivación static-analysis al guardar runbook. Frontend ya renderiza el chip cuando los 4 vienen seteados.

## Tests baseline al cierre de la sesión 2026-04-30

- Backend: **1321+ / 1321+** passing (+3 lineage tests, +5 metadata tests, +3 capability-gate tests, +4 step-stats tests)
- Frontend: **285 / 285** passing (+24 desde 261: capabilities, dbml-export, sql-diff, sql-metadata, reconcile)
- Python SDK: **18 / 18** passing
- tsc clean ambos lados (TS)
- Bundle: `/sql-editor` 10.8 kB / 126 kB · `/lineage` (nueva) 1.41 kB / 104 kB · `/editor` 119 kB / 307 kB
- Aún sin commitear: feat/editor-reactflow-rebuild branch tiene 30+ archivos modificados pendientes de split en commits temáticos.
