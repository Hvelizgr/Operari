# Pendiente

Items que no entraron en las sesiones de implementación. Se ordenan por scope estimado, no por prioridad.

Última actualización: 2026-04-30. Después de los 6 commits del último push (audit chain, webhook wizard, metrics, Grafana, plugin metadata bridge, plugin tenant-scoped schema, WorkOS, Python SDK).

---

## Código pendiente

### 🟡 Plugin loader: tenant-scoped runtime

**Estado:** schema listo (commit `f33efd4`), upsert acepta `tenantId`. **Falta:** la mitad del runtime — cómo carga + ejecuta un plugin que sólo debería existir para un tenant específico.

**Bloqueo de diseño** (no decidido):

- Opción A — worker pool per tenant: cada tenant tiene su propio proceso Node con su `OPERARI_PLUGINS_DIR/<tenant-id>/`. Aislamiento real, costo por tenant.
- Opción B — in-process registry filter: el dispatcher rechaza ejecutar un plugin si `webhook.tenantId !== executorRegistry[type].tenantId`. Sin aislamiento real, pero rápido de implementar.
- Opción C — VM2 / isolated-vm: plugins corren en un V8 isolate con un registry compartido. Aislamiento intermedio.

**Lift estimado tras decidir:** 1-2 semanas. Incluye endpoint `POST /api/tenants/plugins` (tarball o manifest), tests de aislamiento, UI de install en Settings.

**Por qué no entró:** sin runtime aislado, un endpoint de install sería UX falso — el catálogo mostraría el step pero el runtime fallaría. Mejor diferir hasta tener decisión de sandboxing.

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

- Backend: **1293/1293** passing
- Frontend: **243/243** passing
- Python SDK: **18/18** passing
- tsc clean ambos lados (TS)
- 6 commits locales pendientes de push (los del último push attempt fallido por falta de credenciales)
