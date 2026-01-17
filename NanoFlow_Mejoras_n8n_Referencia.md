# NanoFlow: Mejoras Inspiradas en n8n

Este documento consolida las mejoras identificadas para NanoFlow, utilizando n8n como referencia principal de buenas prácticas en editores de flujos de trabajo.

---

## Parte 1: Mejoras del Editor Visual

### 1.1 Estados Visuales de Nodos (Prioridad Alta) - IMPLEMENTADO

| Funcionalidad | n8n | NanoFlow Actual | Estado |
|---------------|-----|-----------------|--------|
| **Borde Animado (Running)** | Usa `conic-gradient` + `@keyframes` para rotar borde cuando está ejecutando | **IMPLEMENTADO** - Clase `wf_running` con `conic-gradient` | COMPLETADO |
| **Estados de Ejecución** | Verde (éxito), Rojo (error), Amarillo (ejecutando) | **IMPLEMENTADO** - `wf_active`, `wf_completed`, `wf_error` | COMPLETADO |
| **Pinned Data Indicator** | Indicador visual de datos fijados | No existe | Pendiente |

**Implementación Realizada en `WorkflowNode.css`:**
```css
/* n8n-style rotating border animation */
@property --border-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
}

@keyframes wf_rotate_border {
    to { --border-angle: 360deg; }
}

.wf_node.wf_running::before {
    content: '';
    position: absolute;
    inset: -3px;
    z-index: -1;
    border-radius: inherit;
    background: conic-gradient(
        from var(--border-angle, 0deg),
        transparent 0%,
        var(--active-color, var(--theme-color)) 10%,
        var(--active-color, var(--theme-color)) 15%,
        transparent 25%
    );
    animation: wf_rotate_border 1.5s linear infinite;
}
```

### 1.2 Barra de Herramientas Flotante (Prioridad Alta) - IMPLEMENTADO

**n8n Implementation:**
- Al hacer hover sobre un nodo aparece toolbar con: Ejecutar, Desactivar, Borrar, Enfocar
- Posicionada encima del nodo con animación de fade-in

**Implementación Realizada:**
- Creado `NodeHoverToolbar.tsx` con botones: Run, Disable, Delete, Duplicate, Focus
- Integrado en `NodesLayer.tsx` con estado de hover
- Compensación de zoom incluida en el componente

**Archivos Modificados:**
- `frontend/components/Editor/NodeHoverToolbar.tsx` (NUEVO)
- `frontend/components/Editor/NodesLayer.tsx` (MODIFICADO)

### 1.3 Compensación de Zoom (Prioridad Media) - IMPLEMENTADO

**n8n Implementation:**
- Variable CSS `--canvas-zoom-compensation-factor`
- Escala iconos/botones para mantener legibilidad al alejar vista

**Implementación Realizada en `WorkflowNode.css`:**
```css
.wf_container {
    --viewport-zoom: 1;
    --zoom-compensation: calc(1 / var(--viewport-zoom, 1));
    --min-zoom-scale: 0.75;
    --max-zoom-scale: 1.5;
}

.zoom-compensated {
    --clamped-scale: clamp(var(--min-zoom-scale), var(--zoom-compensation), var(--max-zoom-scale));
    transform: scale(var(--clamped-scale));
}
```

### 1.4 Sistema de Conexiones Mejorado (Prioridad Alta) - IMPLEMENTADO

| Funcionalidad | n8n | NanoFlow Actual | Estado |
|---------------|-----|-----------------|--------|
| **Click-to-Connect** | Click inicio, click destino | Sistema Soldering existente | YA EXISTÍA |
| **Condiciones en Conexión** | Menú contextual: Éxito/Error/True/False | **IMPLEMENTADO** - `ConnectionCondition` type | COMPLETADO |
| **Colores por Tipo** | Verde (éxito), Rojo (error), Gris (siempre) | **IMPLEMENTADO** - `CONDITION_COLORS` | COMPLETADO |
| **Animación de Flujo** | Partículas viajando por la conexión | **YA EXISTÍA** - `isExecuting` animation | YA EXISTÍA |

**Implementación Realizada en `EditorConnection.tsx`:**
```typescript
export type ConnectionCondition = 'always' | 'success' | 'error' | 'true' | 'false';

const CONDITION_COLORS: Record<ConnectionCondition, string> = {
    always: '#475569',   // Slate-600
    success: '#22c55e',  // Green-500
    error: '#ef4444',    // Red-500
    true: '#3b82f6',     // Blue-500
    false: '#f59e0b',    // Amber-500
};
```
- Badge visual en punto medio de conexión para condiciones
- Líneas punteadas para conexiones de error
- Colores dinámicos según estado de ejecución

### 1.5 Disparadores Interactivos (Prioridad Media) - IMPLEMENTADO

**n8n Implementation:**
- Nodos Trigger tienen icono de "rayo" distintivo
- Al hover, desliza y revela botón "Ejecutar Flujo"
- Diferenciación visual clara vs nodos normales

**Implementación Realizada:**
- Clase CSS `wf_trigger_enhanced` con estilos mejorados
- Botón "Quick Run" que aparece en hover (`.trigger-quick-run`)
- Indicador de rayo (`.trigger-indicator`) en esquina superior izquierda
- Efecto glow en hover
- Borde rotativo animado durante ejecución

**Archivos Modificados:**
- `frontend/components/Editor/EditorNode.tsx` (MODIFICADO)
- `frontend/components/Editor/WorkflowNode.css` (MODIFICADO)

---

## Parte 2: Mejoras de Nodos

### 2.1 Tipos de Nodos Especiales (Prioridad Alta) - IMPLEMENTADO

#### Sticky Notes - IMPLEMENTADO
NanoFlow tiene `NoteNode.tsx`. Mejoras implementadas:
- **Soporte Markdown completo** - Headers, bold, italic, code, listas, checkboxes
- **Redimensionado libre** - Handle de resize en esquina inferior derecha
- **7 colores personalizables** - Yellow, green, blue, purple, pink, orange, gray
- **Modo "wide"** - Toggle para expandir a 550px de ancho
- **Toolbar en hover** - Selector de color y toggle de modo wide

**Archivos Modificados:**
- `frontend/components/Editor/NoteNode.tsx`

#### Frame Nodes - IMPLEMENTADO
NanoFlow tiene `FrameNode.tsx`. Mejoras implementadas:
- **Colapsar/expandir** - Botón chevron en title bar
- **7 colores personalizables** - Blue, green, purple, orange, pink, teal, gray
- **Bloqueo de frame** - Previene movimiento y resize
- **Badge de conteo** - Muestra cantidad de nodos contenidos
- **Selección de contenidos** - Click en badge selecciona todos los nodos

**Archivos Modificados:**
- `frontend/components/Editor/FrameNode.tsx`
- `frontend/components/Editor/WorkflowNode.css`

### 2.2 Sistema de Puertos Avanzado (Prioridad Media) - IMPLEMENTADO

**n8n Implementation:**
- Puertos "Main" (flujo principal) vs "Non-Main" (datos/config)
- Posicionamiento dinámico según cantidad
- Puertos de error separados

**Implementación Realizada:**
- Función `getDefaultPorts()` en `nodePortUtils.ts` que retorna puertos según tipo de nodo:
  - **Triggers**: Solo output (main) en dirección derecha
  - **Controllers/Conditions**: Input + 2 outputs (True/False)
  - **Actions**: Input + output de error (bottom)
  - **Transform**: Input main + input data (top) + output
  - **AI/LLM**: Input main + config (top) + output + error (bottom)
  - **Default**: Input + output estándar
- Colores de puertos por tipo via CSS (`.port-main`, `.port-data`, `.port-error`, `.port-config`)
- Posicionamiento dinámico de múltiples puertos en la misma dirección
- Labels de puertos visibles en hover
- Indicador visual de puertos requeridos (`*`)

**Archivos Modificados:**
- `frontend/utils/nodePortUtils.ts` - Funciones `getDefaultPorts()`, `calculatePortPosition()`
- `frontend/components/Editor/EditorNode.tsx` - Renderizado de puertos avanzados
- `frontend/components/Editor/WorkflowNode.css` - Estilos `.port-main`, `.port-data`, etc.

### 2.3 Tamaño Dinámico de Nodos (Prioridad Baja) - IMPLEMENTADO

**n8n Implementation:**
- Nodos se auto-ajustan según contenido
- Altura variable por cantidad de parámetros

**Implementación Realizada:**
- Clase CSS `auto-height` para altura automática según contenido
- Atributo `data-port-count` que ajusta la altura mínima según cantidad de puertos (1-5)
- Estilos para body del nodo (`.wf_body`, `.summary_grid`, `.info_label`, `.info_value`)
- Soporte para variantes de ancho (`size-compact`, `size-default`, `size-wide`)

**Archivos Modificados:**
- `frontend/components/Editor/WorkflowNode.css` - Estilos dinámicos
- `frontend/components/Editor/EditorNode.tsx` - Atributo `data-port-count`

### 2.4 Categorías de Nodos Sugeridas

Basado en n8n, organizar nodos en:

| Categoría | Ejemplos | Icono Sugerido |
|-----------|----------|----------------|
| **Triggers** | Webhook, Schedule, Manual | Zap/Lightning |
| **Actions** | HTTP Request, Database, API | Play |
| **Transform** | Set, Split, Merge, Filter | Shuffle |
| **Logic** | IF, Switch, Loop | GitBranch |
| **Utilities** | Wait, Code, Function | Tool |
| **AI** | LLM, Embedding, Vector | Brain |

---

## Parte 3: Mejoras de UX y Flujo de Trabajo

### 3.1 Copia Profunda y Duplicación (Prioridad Alta) - IMPLEMENTADO

**Implementación Existente:**
- `handleDuplicateNode` en `useEditorCanvas.ts` - Duplica nodos individuales
- Copy/Cut/Paste con `Ctrl+C/X/V` en `useEditorKeyboard.ts`
- **Ctrl+D** - Duplicación directa sin usar clipboard (NUEVO)
- Genera nuevos IDs únicos con `crypto.randomUUID()` (MEJORADO)
- Desplaza posición automáticamente (GRID.SIZE * 2)
- Selecciona nuevos nodos automáticamente

**Archivos:**
- `frontend/hooks/useEditorCanvas.ts` - líneas 704-718
- `frontend/hooks/useEditorKeyboard.ts` - líneas 60-128
- `frontend/components/Editor/NodeHoverToolbar.tsx` - Botón duplicar

### 3.2 Sistema de Deshacer/Rehacer Robusto (Prioridad Alta) - IMPLEMENTADO

**Implementación Existente:**
- Hook `useAdvancedUndoRedo` con patrón Command
- Buffer configurable (default 50 estados)
- Interfaz `Command` con `execute()` y `undo()`
- Estados `canUndo` / `canRedo`
- Shortcuts `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`

**Archivos:**
- `frontend/hooks/useAdvancedUndoRedo.ts`
- `frontend/hooks/useEditorKeyboard.ts` - líneas 129-143

### 3.3 Borradores Locales (Prioridad Alta) - IMPLEMENTADO

**Implementación Existente:**
- Hook `useAutosave` completo con:
  - Guardado a localStorage como respaldo inmediato
  - Guardado a backend con detección de conflictos
  - Debounce configurable (default 2 segundos)
  - Detección de estado offline/online
  - Preferencia de autosave persistida
  - Estados: `saving`, `saved`, `error`, `conflict`

**Archivos:**
- `frontend/hooks/useAutosave.ts`
- `frontend/components/Workflow/SaveStatusIndicator.tsx`

### 3.4 Nudge con Teclado (Prioridad Media) - IMPLEMENTADO

**Implementación Existente:**
- Flechas del teclado mueven nodos seleccionados
- Sin Shift: 1px por pulsación
- Con Shift: 10px por pulsación
- Navegación con Tab entre nodos
- Enter para seleccionar, Escape para deseleccionar

**Archivos:**
- `frontend/hooks/useEditorKeyboard.ts` - líneas 145-205

---

## Parte 4: Inteligencia de Workflow (Inspirado en CodeFlow)

### 4.1 "Workflow Doctor" - Linter de Flujos (Prioridad Alta) - IMPLEMENTADO

Hook `useWorkflowDoctor` que analiza workflows en tiempo real:

| Check | Descripción | Severidad | Estado |
|-------|-------------|----------|--------|
| **Secretos Hardcodeados** | Detecta API keys, passwords, tokens | Warning | IMPLEMENTADO |
| **Nodos Desconectados** | Nodos sin conexiones entrada/salida | Warning | IMPLEMENTADO |
| **Ciclos en el Workflow** | Detecta loops infinitos potenciales | Warning | IMPLEMENTADO |
| **IDs Duplicados** | Nodos con el mismo ID | Error | IMPLEMENTADO |
| **Triggers sin Output** | Triggers que no conectan a nada | Warning | IMPLEMENTADO |
| **Nodos sin Input** | Nodos no-trigger sin entrada | Info | IMPLEMENTADO |
| **Sin Trigger** | Workflow sin nodo de inicio | Info | IMPLEMENTADO |
| **Workflow Vacío** | Sin nodos | Info | IMPLEMENTADO |

**Archivos Creados:**
- `frontend/hooks/useWorkflowDoctor.ts` - Hook principal de validación
- `frontend/components/Editor/WorkflowDoctorPanel.tsx` - Panel UI para mostrar issues

**Patrones de Detección de Secretos:**
```typescript
// Nombres de campos sospechosos
const SECRET_PATTERNS = [
    /api[_-]?key/i, /secret[_-]?key/i, /password/i,
    /token/i, /bearer/i, /auth[_-]?key/i,
    /private[_-]?key/i, /credential/i,
    /access[_-]?key/i, /client[_-]?secret/i,
];

// Valores que parecen secretos reales
const SECRET_VALUE_PATTERNS = [
    /^sk-[a-zA-Z0-9]{20,}$/,        // OpenAI
    /^ghp_[a-zA-Z0-9]{36}$/,        // GitHub PAT
    /^AKIA[0-9A-Z]{16}$/,           // AWS Access Key
    /^eyJ[a-zA-Z0-9_-]*\.[...]/,    // JWT Token
];
```

### 4.2 Heatmap de Ejecución (Prioridad Media) - IMPLEMENTADO

Hook `useExecutionHeatmap` para visualizar frecuencia de ejecución:

| Heat Level | Color | Descripción |
|------------|-------|-------------|
| **cold** | Azul (20% opacity) | Raramente ejecutado |
| **warm** | Verde (30% opacity) | A veces ejecutado |
| **hot** | Naranja (40% opacity) | Frecuentemente ejecutado |
| **very-hot** | Rojo (50% opacity) | Muy frecuentemente ejecutado |

**Funcionalidades:**
- `recordExecution(nodeId, success, duration)` - Registra ejecución
- `getNodeHeatLevel(nodeId)` - Obtiene nivel de calor
- `getNodeHeatColor(nodeId)` - Obtiene color CSS
- `applyDecay()` - Reduce conteos antiguos (factor configurable)
- `clearStats()` - Limpia estadísticas

**Archivo Creado:**
- `frontend/hooks/useExecutionHeatmap.ts`

### 4.3 Data Lineage (Prioridad Baja)

Para flujos grandes, vista de matriz que muestre:
- Qué datos produce cada nodo
- Qué nodos consumen esos datos
- Trazabilidad completa input→output

---

## Parte 5: Resumen de Prioridades

### Prioridad Alta (Implementar Primero)
1. ~~Barra de herramientas flotante en hover~~ - **IMPLEMENTADO**
2. ~~Condiciones en conexiones (éxito/error)~~ - **IMPLEMENTADO**
3. ~~Sistema de deshacer/rehacer robusto~~ - **IMPLEMENTADO** (useAdvancedUndoRedo)
4. ~~Borradores locales automáticos~~ - **IMPLEMENTADO** (useAutosave)
5. ~~Workflow Doctor (linter básico)~~ - **IMPLEMENTADO** (useWorkflowDoctor)
6. ~~Detección de secretos al guardar~~ - **IMPLEMENTADO** (incluido en useWorkflowDoctor)

### Prioridad Media
1. ~~Compensación de zoom para UI elements~~ - **IMPLEMENTADO**
2. ~~Disparadores con acción rápida~~ - **IMPLEMENTADO**
3. ~~Sistema de puertos avanzado~~ - **IMPLEMENTADO**
4. ~~Nudge con teclado~~ - **IMPLEMENTADO** (useEditorKeyboard)
5. ~~Heatmap de ejecución~~ - **IMPLEMENTADO** (useExecutionHeatmap)

### Prioridad Baja (Polish)
1. ~~Animación de borde rotativo~~ - **IMPLEMENTADO**
2. ~~Tamaño dinámico de nodos~~ - **IMPLEMENTADO**
3. ~~Animación de flujo en conexiones~~ - **YA EXISTÍA**
4. Data lineage matrix - Pendiente
5. ~~Efectos de confetti/sparks~~ - **YA EXISTÍA**

---

## Resumen de Implementación de Parte 1

**Archivos Creados:**
- `frontend/components/Editor/NodeHoverToolbar.tsx`

**Archivos Modificados:**
- `frontend/components/Editor/WorkflowNode.css` - Estilos para animaciones, zoom compensation, triggers
- `frontend/components/Editor/EditorConnection.tsx` - Condiciones visuales en conexiones
- `frontend/components/Editor/EditorNode.tsx` - Mejoras en nodos Trigger
- `frontend/components/Editor/NodesLayer.tsx` - Integración de NodeHoverToolbar

---

## Parte 6: Funcionalidades Ya Implementadas en NanoFlow

Basado en el análisis del código, NanoFlow ya cuenta con:

- **Command Palette** (`Ctrl+K`) - `CommandPalette.tsx`
- **Sticky Notes** - `NoteNode.tsx`
- **Frame Nodes** - `FrameNode.tsx`
- **Sistema de Soldering** - `useEditorSoldering.ts`, `SolderingOverlay.tsx`
- **Confetti en éxito** - Integración con `canvas-confetti`
- **Terminal de logs** - `LogTerminal.tsx`
- **Snapshots/Versiones** - `useSnapshots.ts`, `SnapshotDialog.tsx`
- **Auto Layout** - `layoutUtils.ts`
- **Workflow Properties Panel** - `WorkflowPropertiesPanel.tsx`
- **Template Gallery** - `TemplateGallery.tsx`
- **Metrics Dashboard** - `MetricsDashboard.tsx`
- **Undo/Redo básico** - `useUndoRedo` hooks
- **Zoom Controls** - `ZoomControls.tsx`
- **MiniMap** - `MiniMap.tsx`
- **Search Bar** - `SearchBar.tsx`
- **Keyboard Shortcuts Modal** - `KeyboardShortcutsModal.tsx`
- **Onboarding** - `Onboarding.tsx`
- **Theme Toggle** - `ThemeToggle.tsx`
- **Accessibility Context** - `AccessibilityContext.tsx`

---

## Conclusión

NanoFlow tiene una base sólida y muchas características avanzadas ya implementadas. Las mejoras prioritarias deberían enfocarse en:

1. **Pulir la interacción**: Toolbar flotante, nudge, compensación de zoom
2. **Robustez**: Undo/redo mejorado, borradores locales
3. **Seguridad**: Workflow Doctor con detección de secretos
4. **Diferenciación visual**: Estados de conexión, triggers distintivos

Estas mejoras alinearán NanoFlow con las mejores prácticas de n8n mientras mantienen su identidad única y arquitectura React/TypeScript.
