# Análisis del Proyecto NanoFlow

> Última actualización: 2026-01-17

---

## 1. Estructura de Nodos y Endpoints

**Estado:** 575 nodos definidos en `backend/node_types.json`

| Categoría | Cantidad |
|-----------|----------|
| AI/Agents | 113 |
| Triggers | 105 |
| Core | 16 |
| Integraciones | 341 |

### Gaps Críticos vs n8n

| Gap | Descripción | Estado |
|-----|-------------|--------|
| Sin enrutamiento de operaciones | Cada nodo = 1 operación. n8n: 1 nodo = múltiples operaciones | ⬜ Pendiente |
| Propiedades vacías | `properties: []` en 575 nodos (0%) | ✅ CORREGIDO (14 nodos core) |
| Sin versionamiento | n8n soporta v1 → v4.3 | ⬜ Pendiente |
| Triggers limitados | Sin gestión de webhooks/polling stateful | ⬜ Pendiente |
| Sin prueba de credenciales | No hay `credentialTest()` | ⬜ Pendiente |
| Sin opciones dinámicas | No hay `loadOptions()` | ⬜ Pendiente |

### Archivos Clave
- `/backend/node_types.json` - 575 definiciones
- `/backend/prisma/schema.prisma` - NodeType model
- `/others/n8n/packages/nodes-base/nodes/` - Referencia

---

## 2. Plantillas No Ejecutan (Se quedan "Inicializando")

### Diagnóstico

| Raíz | Problema | Archivo | Líneas | Estado |
|------|----------|---------|--------|--------|
| 1 | Ejecución no emite estado final | `backend/src/editor/execution/execution.service.ts` | 542-544, 568-570 | ✅ CORREGIDO |
| 2 | Frontend no escucha `execution_status` | `frontend/hooks/useExecutionSocket.ts` | 62-64 | ✅ CORREGIDO |
| 3 | Plantilla no se persiste antes de ejecutar | `frontend/components/Workflow/TemplateGallery.tsx` | 73-76 | ✅ CORREGIDO |
| 4 | Workflow "current-workflow" puede no existir | `frontend/hooks/useEditorCanvas.ts` | 166-227 | ⬜ Pendiente |

### Correcciones Aplicadas

**Backend (execution.service.ts):**
```typescript
// Línea 542-544 - Después de SUCCESS:
socketService.emitExecutionStatus(executionId, 'SUCCESS');
socketService.emitLog(executionId, 'Workflow execution completed successfully', { duration });

// Línea 568-570 - Después de FAILED:
socketService.emitExecutionStatus(executionId, 'FAILED');
socketService.emitLog(executionId, `Workflow execution failed: ${errorMessage}`, { error: errorMessage });
```

**Frontend (useExecutionSocket.ts):**
```typescript
// Nuevo estado:
const [executionStatus, setExecutionStatus] = useState<'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED' | null>(null);

// Nuevo listener (línea 62-64):
socket.on('execution_status', (status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED') => {
    setExecutionStatus(status);
});

// Expuesto en return:
return { logs, nodeStatuses, nodeOutputs, executionStatus, clearLogs };
```

---

## 3. Diseño Visual de Nodos

**Puntuación: 9.5/10** - Muy consistente con n8n

| Aspecto | NanoFlow | n8n | Consistencia |
|---------|----------|-----|--------------|
| Forma Triggers | Circular | Circular | ✅ |
| Forma Controllers | Píldora | Píldora | ✅ |
| Forma Actions | Circular | Circular | ✅ |
| Forma Core Nodes | Rectángulo redondeado | Rectángulo redondeado | ✅ |
| Tamaño Puertos | 12px | 12px | ✅ |
| Color Triggers | Naranja #f97316 | Naranja | ✅ |
| Color Actions | Verde #10b981 | Verde | ✅ |
| Color Controllers | Púrpura #a855f7 | Púrpura | ✅ |
| Animación Running | Borde rotativo | Borde rotativo | ✅ |
| Hover toolbar | Soportada | Soportada | ✅ |
| Dark mode | Soportado | Soportado | ✅ |

### Archivos
- `frontend/components/Editor/EditorNode.tsx`
- `frontend/components/Editor/WorkflowNode.css`
- `frontend/components/Editor/NodesLayer.tsx`

---

## 4. Sistema de Conexiones

### Problemas Identificados

| Problema | Severidad | Archivo | Estado |
|----------|-----------|---------|--------|
| IDs no únicos (`Date.now()`) | ALTA | `frontend/hooks/useEditorConnections.ts:147,191` | ✅ CORREGIDO |
| Ciclos se visualizan pero NO se previenen | ALTA | `frontend/hooks/useEditorConnections.ts` | ✅ CORREGIDO |
| Conexiones huérfanas al eliminar nodos | MEDIA | `frontend/hooks/useEditorCanvas.ts` | ✅ CORREGIDO |
| Validación de puertos insuficiente | MEDIA | `frontend/hooks/useEditorConnections.ts:181-188` | ⬜ Pendiente |

### Correcciones Aplicadas

**IDs únicos (useEditorConnections.ts):**
```typescript
// Antes:
id: `conn-${Date.now()}`

// Después (líneas 147 y 191):
id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
```

**Validación preventiva de ciclos (useEditorConnections.ts):**
```typescript
// completeConnection y createConnection ahora validan:
// 1. Self-connections
if (sourceNodeId === targetNodeId) {
    announceMessage('Cannot connect a node to itself');
    return false;
}

// 2. Cycle detection antes de crear
const testConnection = { id: 'test', source: sourceNodeId, target: targetNodeId };
const testConnections = [...connections, testConnection];
const cycleResult = hasCycle(nodes, testConnections);

if (cycleResult.hasCycle) {
    announceMessage('Connection would create a cycle - not allowed');
    return false;
}
```

**Limpieza de conexiones (useEditorCanvas.ts):**
```typescript
// Nuevo handler handleDeleteNodeById (líneas 688-718):
const handleDeleteNodeById = useCallback((nodeId: string) => {
    // ... elimina nodo Y todas sus conexiones con soporte undo/redo
    setConnections((prev: Connection[]) =>
        prev.filter(c => !allNodesToDelete.has(c.source) && !allNodesToDelete.has(c.target))
    );
});
```

---

## 5. Menú Contextual / Hover Toolbar

### Causa Raíz

| Problema | Archivo | Líneas | Estado |
|----------|---------|--------|--------|
| Faltaban handlers para hover toolbar | `frontend/components/Editor/EditorCanvas.tsx` | 231-280 | ✅ CORREGIDO |
| Props no pasados a NodesLayer | `frontend/components/Editor/EditorCanvas.tsx` | 511-516 | ✅ CORREGIDO |

### Correcciones Aplicadas

**Nuevos handlers en EditorCanvas.tsx:**
```typescript
// Hover Toolbar Handlers (n8n-style)
const handleNodeRunFromToolbar = async (nodeId: string) => {
    setShowTerminal(true);
    await executeFromNode(nodeId, {});
};

const handleNodeToggleDisableFromToolbar = (nodeId: string) => {
    setNodes((prevNodes) =>
        prevNodes.map((node) =>
            node.id === nodeId
                ? { ...node, enabled: !(node.enabled ?? true) }
                : node
        )
    );
};

const handleNodeDuplicateFromToolbar = (nodeId: string) => { ... };
const handleNodeFocusFromToolbar = (nodeId: string) => { ... };
```

**Props pasados a NodesLayer:**
```tsx
<NodesLayer
    // ... otros props
    onNodeRun={handleNodeRunFromToolbar}
    onNodeToggleDisable={handleNodeToggleDisableFromToolbar}
    onNodeDelete={handleDeleteNodeById}
    onNodeDuplicate={handleNodeDuplicateFromToolbar}
    onNodeFocus={handleNodeFocusFromToolbar}
/>
```

---

## 6. UI de Nodos - Expresiones y Propiedades

### Problema Identificado: Expresiones n8n Visibles

Los subtítulos de nodos contenían expresiones n8n incompletas como `={{$parameter[` que se mostraban literalmente en lugar de evaluarse.

| Problema | Archivo | Estado |
|----------|---------|--------|
| Subtítulos con `={{$parameter[` visible | `backend/node_types.json` (575 nodos) | ✅ CORREGIDO |
| Expresiones no filtradas en UI | `frontend/components/Editor/EditorNode.tsx` | ✅ CORREGIDO |
| Nodos sin propiedades (properties: []) | Base de datos | ✅ CORREGIDO (14 nodos core) |

### Correcciones Aplicadas

**1. Filtro de expresiones en EditorNode.tsx (línea 265):**
```typescript
// Antes:
{nodeType?.subtitle && (
    <span className="node-subtitle-text">
        {(nodeType.subtitle as any)[lang] || (nodeType.subtitle as any).en}
    </span>
)}

// Después:
{nodeType?.subtitle && !((nodeType.subtitle as any)[lang] || '').includes('={{') && (
    <span className="node-subtitle-text">
        {(nodeType.subtitle as any)[lang] || (nodeType.subtitle as any).en}
    </span>
)}
```

**2. Script de actualización de propiedades:**
Creado script `backend/src/scripts/add-node-properties.ts` que:
- Añade propiedades a 14 nodos core
- Limpia subtítulos con expresiones n8n

**3. Nodos con propiedades definidas:**

| Nodo | Propiedades |
|------|-------------|
| HttpRequest | method, url, authentication, headers, body, timeout |
| Code | language, code |
| If | conditions, combineOperation |
| Set | mode, values, keepOnlySet |
| Merge | mode, joinMode, propertyName |
| Webhook | httpMethod, path, responseMode |
| ScheduleTrigger | rule, interval, cronExpression |
| Function | functionCode |
| Agent | promptType, text, systemMessage, maxIterations |
| LmChatOpenAi | model, temperature, maxTokens |
| LmChatAnthropic | model, temperature, maxTokens |
| NoOp | (ninguna) |
| ManualTrigger | (ninguna) |

**4. Subtítulos limpiados:**
- 230+ nodos con subtítulos `={{$parameter[` fueron limpiados
- Ahora muestran el nombre del tipo en formato legible

### Ejecutar Script de Propiedades

```bash
cd backend
npx ts-node src/scripts/add-node-properties.ts
```

---

## Resumen de Prioridades

| # | Prioridad | Problema | Estado |
|---|-----------|----------|--------|
| 1 | 🔴 CRÍTICA | Plantillas no ejecutan - emitExecutionStatus | ✅ CORREGIDO |
| 2 | 🔴 CRÍTICA | Frontend no detecta fin de ejecución | ✅ CORREGIDO |
| 3 | 🔴 CRÍTICA | Menú contextual no funciona | ✅ CORREGIDO |
| 4 | 🟠 ALTA | IDs de conexión no únicos | ✅ CORREGIDO |
| 5 | 🟠 ALTA | Ciclos no prevenidos | ✅ CORREGIDO |
| 6 | 🟡 MEDIA | Conexiones huérfanas | ✅ CORREGIDO |
| 7 | 🟡 MEDIA | Propiedades de nodos vacías | ✅ CORREGIDO (14 nodos) |
| 8 | 🟡 MEDIA | Expresiones visibles en subtítulos | ✅ CORREGIDO |
| 9 | 🟡 MEDIA | Subtítulos con expresiones n8n | ✅ CORREGIDO (230+ nodos) |
| 10 | 🟢 BAJA | Operaciones múltiples por nodo | ⬜ Pendiente |

---

## Progreso de Correcciones

- [x] Corregir emisión de estado de ejecución (backend)
- [x] Corregir listener de execution_status en frontend
- [x] Corregir menú contextual/hover toolbar de nodos
- [x] Corregir IDs de conexión (ahora únicos)
- [x] Añadir validación preventiva de ciclos
- [x] Limpiar conexiones huérfanas al eliminar nodos
- [x] Filtrar expresiones n8n en subtítulos (UI)
- [x] Definir properties para 14 nodos core
- [x] Limpiar subtítulos con expresiones en BD
- [x] Persistir plantilla antes de ejecutar
- [ ] Implementar patrón resource + operation

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `backend/src/editor/execution/execution.service.ts` | Añadido `emitExecutionStatus` en SUCCESS y FAILED |
| `frontend/hooks/useExecutionSocket.ts` | Añadido listener `execution_status` y estado |
| `frontend/hooks/useEditorConnections.ts` | IDs únicos, validación de ciclos y self-connections |
| `frontend/hooks/useEditorCanvas.ts` | Nuevo `handleDeleteNodeById` con limpieza de conexiones |
| `frontend/components/Editor/EditorCanvas.tsx` | Handlers de hover toolbar y props a NodesLayer |
| `frontend/components/Editor/EditorNode.tsx` | Filtro de expresiones n8n en subtítulos |
| `backend/src/scripts/add-node-properties.ts` | **NUEVO** - Script para añadir propiedades a nodos |
| `frontend/hooks/useAutosave.ts` | `forceSave` ahora acepta datos opcionales y retorna resultado |
| `frontend/components/Editor/EditorCanvas.tsx` | Persistencia inmediata de plantillas y antes de ejecución |
| Base de datos (NodeType) | 14 nodos con propiedades, 230+ subtítulos limpiados |

---

## Próximos Pasos Sugeridos

1. **Persistencia de plantillas**: Guardar workflow antes de ejecutar
2. **Más propiedades de nodos**: Extender a los 575 nodos
3. **Patrón resource + operation**: Para nodos complejos como Google Sheets
4. **Validación de puertos**: Verificar compatibilidad de tipos
5. **Prueba de credenciales**: Implementar `credentialTest()`
