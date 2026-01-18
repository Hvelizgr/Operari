# NanoFlow - Estado del Proyecto y Pendientes

> Última actualización: 2026-01-18

---

## 📊 Resumen Ejecutivo

NanoFlow es una plataforma de automatización de flujos de trabajo con un editor visual robusto. El proyecto integra las mejores prácticas de **n8n**, **xyOps** y **CodeFlow**.

**Estado actual:** Editor funcional y **estable**. El ciclo de carga (persistencia) y depuración básica ya funcionan correctamente. El foco actual es implementar nodos de infraestructura y cerrar la Fase 1.

---

## ✅ Funcionalidades Completadas

### Fase 1: Correcciones Críticas (✅ Resueltos 2026-01-18)

- [x] **Ciclo de Persistencia**: Implementada creación lazy de `current-workflow` en `GET /workflows/:id`. (Ya no carga lienzo vacío).
- [x] **Depuración Visual**: Implementado endpoint `POST /api/executions/:id/debug` con soporte para ejecución parcial (`startNodeId`).

### Editor y UX (xyOps + n8n)

- Sistema de Herramientas: Modos Dibujar (D) y Mover (M)
- Sistema de Soldadura: Conexiones click-to-connect y arrastre
- Copia Profunda y Duplicación (`Ctrl+C/V`, `Ctrl+D`)
- Deshacer/Rehacer Robusto (50 estados)
- Auto-guardado a localStorage y backend
- Nudge con Teclado (flechas, +Shift para 10px)
- Barra de Herramientas Flotante
- Compensación de Zoom

### Nodos y Conexiones

- Sticky Notes (Markdown, 7 colores, modo ancho)
- Frame Nodes (colapsar, colores, conteo)
- Puertos Dinámicos (Main, Data, Error, Config)
- Condiciones en Conexiones (Éxito, Error, Siempre, T/F)
- Triggers Interactivos
- Tamaño Dinámico de Nodos

### Inteligencia y Observabilidad (CodeFlow)

| Archivo                                        | Funcionalidad                                |
| ---------------------------------------------- | -------------------------------------------- |
| `blastRadius.ts` + `useBlastRadius.ts`         | Visualización de impacto upstream/downstream |
| `securityScanner.ts`                           | Detecta credenciales hardcodeadas            |
| `complexityScore.ts`                           | Puntuación de complejidad                    |
| `architectureLinter.ts`                        | Valida estructura de workflows               |
| `nodeReferenceParser.ts` + `useDataLineage.ts` | Data Lineage sin ejecutar                    |

### Backend - Nuevas Funcionalidades

| Archivo                              | Funcionalidad                                           |
| ------------------------------------ | ------------------------------------------------------- |
| `alert-condition-node.executor.ts`   | Alertas JEXL con deduplicación y cooldown               |
| `threshold-node.executor.ts`         | Evaluar umbrales (gt, lt, between, etc.)                |
| `compare-node.executor.ts`           | Comparar valores (eq, contains, matches)                |
| `credential.service.ts`              | Scopes: environment, allowedWorkflows, allowedTags      |
| `system-event.service.ts`            | Triggers internos (ALERT, WORKFLOW\_\*, CUSTOM)         |
| `infrastructure-monitor.executor.ts` | Nodos: DiskUsage, CpuMonitor, MemoryMonitor             |
| `network-monitor.executor.ts`        | Nodos: Ping, HttpHealthCheck                            |
| `node-executor.service.ts`           | Sandbox seguro (Proxy, Denylist, Shadowing)             |
| `node-loader.service.ts`             | Carga dinámica de nodos (Hot Reloading, .js files)      |
| `git.service.ts`                     | Git Sync completo (SSH keys, Import/Export, Push/Pull)  |
| `metric.service.ts`                  | Almacenamiento de métricas y estadísticas (Time-series) |

### Funcionalidades Base

- Paleta de Comandos (`Ctrl+K`)
- Terminal de Logs
- Snapshots/Versiones
- Auto-Layout
- Panel de Propiedades
- Galería de Plantillas
- Zoom, MiniMapa

---

## 📋 Pendientes por Dificultad

### 🟡 Media

### 🔴 Muy Alta

#### 5. Arquitectura de Colas

Nuevo módulo `backend/src/scaling/`:

- Redis + Bull Queue
- Workers separados
- Pub/Sub tiempo real
- Estado en Redis (stateless)

---

## 🗺️ Roadmap de Fases

### Fase 1: Cimientos de Producción

- [x] Arreglar ciclo de persistencia
- [x] Endpoint de debug
- [x] Gestor de Secretos (Vaults)
- [ ] Admin y RBAC
- [ ] Nodos Wait/Delay, Loop/Repeat, Branch/Switch

### Fase 2: Observabilidad (En Progreso)

- [x] **Dashboard Central:** Completado (nueva Tab System Monitor con gráficos en tiempo real).
- [x] **Backend de Métricas:** Completado (API `/api/metrics`, guardado automático desde nodos).
- [x] **Alertas UI:** Interfaz para ver historial de alertas y configurar notificaciones (Feed implementado).

### Fase 3: Avanzado

- [ ] Visual Debugger con breakpoints
- [ ] Colaboración en Tiempo Real
- [ ] Marketplace de Plantillas
- [ ] Asistente AI

---

## 🐳 Comandos Docker

```bash
# Iniciar entorno completo
docker-compose up -d

# Iniciar con rebuild
docker-compose up -d --build

# Detener
docker-compose down

# Ver logs
docker-compose logs -f
docker-compose logs -f backend  # Solo backend

# Estado
docker-compose ps

# Limpieza (¡BORRA DATOS!)
docker-compose down -v

# Desarrollo híbrido (recomendado)
docker-compose up -d postgres redis jaeger
npm run dev
```

**Puertos:**

- Postgres: `5433`
- Redis: `6379`
- Jaeger: `16686`

---

## 🗄️ Migraciones Prisma

```bash
cd backend
npx prisma generate  # Generar cliente
npx prisma db push   # Aplicar cambios a BD
npx prisma studio    # UI para explorar BD
```

---

## 📁 Archivos de Referencia

| Archivo                 | Contenido                                |
| ----------------------- | ---------------------------------------- |
| `shortcuts_guide.md`    | Atajos de teclado del editor             |
| `README.md`             | Descripción general                      |
| `ANALISIS_TECNICO_*.md` | Análisis originales (ya integrados aquí) |
