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

### 🔴 Python SDK: paridad completa con TS

**Estado:** v0.2 shipped. Cliente + step authoring + IPC bridge + ejemplo + 18 tests del SDK + **loader Node-side end-to-end** (commit pending).

**Pending para paridad:**

- ~~Loader Node-side que reconozca `language: python` en el manifest y haga `spawn('python', [entry])` con stdin/stdout JSON~~ — shipped (`backend/src/runbook/plugins/python-bridge.ts` + `loader.ts` reads `operari.json`)
- ~~Test de integración end-to-end que arranque un plugin Python via el loader real~~ — shipped (`python-bridge.test.ts` spawns `examples/hello_world/hello_step.py` real)
- Pydantic-based config schemas como camino recomendado en docs (1 hora — ejemplo + sección README)
- Async execute (`asyncio`) para plugins que hacen I/O concurrente (~2-3 días — el bridge ya soporta async via su naturaleza subprocess; falta pulir el surface en `define_step`)
- Publicación a PyPI (paquete actualmente sólo se instala desde repo) (~1 día — pyproject ya está, falta el workflow de release)
- Streaming logs durante ejecuciones largas (hoy emite live via stdout pero el ejemplo solo emite al final del execute) (~1 día — patrón `context.emit()` repetido en docs)

**Lift estimado restante:** 1 semana para los 4 items operativos arriba.

---

### 🟡 Editor canvas: cierre de la migración a React Flow

**Estado:** migración hecha (sin commit todavía). El canvas de `/editor` se renderiza con `@xyflow/react` 12 desde `frontend/components/Editor/flow/`: nodos con `<Handle>`, aristas `ConditionEdge` con las prefs de Apariencia, `<Background>`, `NodeResizer` en frames, viewport propiedad de React Flow (espejo en React vía `onMove`). Se borró el canvas viejo (`NodesLayer`, `ConnectionsLayer`, `ConnectionBubblesLayer`, `GridLayer`, `EditorConnection`, `useCanvasRenderer`, `useEditorSelection`, `utils/canvas/{drawing,geometry,debug}`, `nodePortUtils`, `portAnchor`). Probado en headless Chromium con un fixture (frame + approval multi-salida + controller + nota): drag, undo, frame arrastra hijos, resize, conectar, rechazo de duplicados, zoom/fit view, menú contextual de nodo.

**Pendiente:**

- ~~Probarlo contra el backend real~~ — hecho 2026-10-29 contra el stack Docker (runbook demo + plantilla `db-migration-prisma`): carga, fit view, drag, autosave, recarga. Salieron y se arreglaron: falso "Conflict" del autosave tras el primer guardado, autosave YAML que no actualizaba la columna JSON (que leen el loader y el engine), sin fit view al abrir `?id=`, warning 015 de React Flow (`measured` no se pasaba a los nodos), seed del runbook demo con forma inválida, nodos de YAML sin posición superpuestos (espaciado 200 < ancho 260)
- Runbooks demo ya sembrados en tenants existentes siguen con la forma vieja (`type: 'note'`, `data.label`, sin `title`): el autosave les da 400. Hace falta migración de datos o normalizar en el loader (~medio día)
- ~~Borrar la cuenta de prueba `rf-canvas-test@example.com` (tenant `rf-canvas-test`)~~ — borrada 2026-10-29
- Conectar nodos contra el backend real: no se llegó a probar (sí en la prueba local con fixture); usa el mismo autosave que el drag
- Commit de la migración + del arreglo de `ajv` (overrides anidados en `package.json` raíz y entradas del lockfile regeneradas; backup del lockfile anterior en el scratchpad de la sesión)
- Minimapa propio (`components/Navigation/MiniMap.tsx`) → reemplazar por `<MiniMap>` de React Flow; hoy mueve el canvas vía `handleViewportChangeAdapter` → `useReactFlow().setViewport` (~medio día)
- `ZoomControls`: el botón "Fit View" queda tapado por el botón flotante de la terminal (`Toggle Terminal`, bottom-right) — preexistente (~1 hora)
- `ContextMenu` no se cierra con Escape — preexistente (~1 hora)
- Notas (`custom.note`): la caja es del mismo color que el fondo del canvas, solo se ve el texto — preexistente, revisar `.wf_note` en `WorkflowNode.css` (~1 hora)
- Fondo `lines` (rayado horizontal): emulado con `BackgroundVariant.Lines` y gap horizontal gigante; si molesta, pattern SVG propio como hijo de `<ReactFlow>` (~1 hora)
- Estilos de flujo `orbs`/`comet`/`particles` reimplementados con `<animateMotion>` SVG y `gradient` como barrido de guiones: comparar a ojo contra el canvas 2D viejo y ajustar velocidades (~medio día)
- Tests de los handlers nuevos de `useEditorCanvas` (`handleFlowNodesChange`: frame arrastra hijos, resize con un solo undo; `handleFlowNodeDragStop`: reasignación de `parentId`) — hoy solo cubiertos por la prueba manual en navegador (~1 día)
- Migrar `.eslintrc.json` a flat config (`eslint.config.js`): ESLint 9 solo corre con `ESLINT_USE_FLAT_CONFIG=false` o vía `next lint`, y v10 lo elimina (~medio día)

**Lift estimado restante:** 3-4 días.

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

- Backend: **1294/1301** passing (2026-10-29). Las 6 fallas también ocurren en `HEAD` sin cambios: `sdk-integration` (falta `packages/sdk/dist`, hay que buildear el SDK), `admin.overview` (403), `local.runner` (timeouts) y `seed-nodes.catalog`
- Frontend: **237/237** passing (2026-10-29, tras la migración a React Flow + test de regresión del autosave)
- Python SDK: **18/18** passing
- tsc clean ambos lados (TS)
