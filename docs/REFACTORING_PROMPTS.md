# NanoFlow - Guía de Refactorización Paso a Paso

Este documento contiene prompts detallados para Claude Code que te ayudarán a refactorizar y reorganizar el proyecto NanoFlow de manera ordenada.

---

## Índice

1. [Fase 1: Refactorizar EditorCanvas.tsx](#fase-1-refactorizar-editorcanvastsx)
2. [Fase 2: Crear estructura de carpetas Frontend/Backend](#fase-2-crear-estructura-de-carpetas-frontendbackend)
3. [Fase 3: Limpiar código duplicado y archivos innecesarios](#fase-3-limpiar-código-duplicado-y-archivos-innecesarios)
4. [Fase 4: Mejorar organización de componentes](#fase-4-mejorar-organización-de-componentes)
5. [Fase 5: Configurar monorepo (opcional)](#fase-5-configurar-monorepo-opcional)

---

## Fase 1: Refactorizar EditorCanvas.tsx

El archivo `components/EditorCanvas.tsx` tiene **1,264 líneas** y mezcla múltiples responsabilidades. Vamos a dividirlo en partes más manejables.

### Prompt 1.1: Extraer tipos e interfaces

```
Extrae todas las interfaces y tipos del archivo components/EditorCanvas.tsx a un nuevo archivo types/editor.types.ts

Debe incluir:
- ViewportState
- Cualquier otro tipo/interface definido en el archivo
- Re-exportar tipos de otros componentes que se usen frecuentemente (WorkflowNode, Connection, etc.)

Actualiza EditorCanvas.tsx para importar desde el nuevo archivo.
```

### Prompt 1.2: Extraer constantes iniciales

```
Extrae las constantes INITIAL_NODES e INITIAL_CONNECTIONS del archivo components/EditorCanvas.tsx a un nuevo archivo constants/editor.constants.ts

Estas constantes están en las líneas 37-74 aproximadamente.

Actualiza EditorCanvas.tsx para importar desde el nuevo archivo.
```

### Prompt 1.3: Crear hook useEditorViewport

```
Crea un nuevo hook hooks/useEditorViewport.ts que extraiga toda la lógica de viewport de EditorCanvas.tsx.

Debe incluir:
- Estado viewport (x, y, zoom)
- handleWheel (zoom con scroll)
- handleZoomIn, handleZoomOut
- handleFitView
- handleResetZoom
- handleViewportChange

El hook debe recibir como parámetros:
- nodes: WorkflowNode[]
- windowSize: { width: number, height: number }
- canvasRef: RefObject<HTMLDivElement>

Debe retornar:
- viewport
- setViewport
- handleWheel
- handleZoomIn
- handleZoomOut
- handleFitView
- handleResetZoom
- handleViewportChange

Actualiza EditorCanvas.tsx para usar este nuevo hook.
```

### Prompt 1.4: Crear hook useEditorPanning

```
Crea un nuevo hook hooks/useEditorPanning.ts que extraiga la lógica de panning (arrastrar canvas) de EditorCanvas.tsx.

Debe incluir:
- Estado isPanning
- Estado panStart
- handleMouseDown (inicio de panning)
- handleMouseMove (durante panning)
- handleMouseUp (fin de panning)

El hook debe recibir:
- viewport: ViewportState
- setViewport: función
- canvasRef: RefObject<HTMLDivElement>

Debe retornar:
- isPanning
- handlePanStart
- handlePanMove
- handlePanEnd

Actualiza EditorCanvas.tsx para usar este nuevo hook.
```

### Prompt 1.5: Crear hook useEditorNodes

```
Crea un nuevo hook hooks/useEditorNodes.ts que extraiga la lógica de manejo de nodos de EditorCanvas.tsx.

Debe incluir:
- Estado nodes
- Estado selectedNodes
- Estado draggingNode
- Estado highlightedNodes
- handleNodeDragStart
- handleNodeDrag
- handleNodeDragEnd
- handleNodeSelect
- handleNodeUpdate
- handleNodeMove
- handleNodeDelete
- handleNodeOpenSettings
- Lógica de duplicar nodo

El hook debe usar executeCommand del hook useAdvancedUndoRedo para operaciones con undo/redo.

Actualiza EditorCanvas.tsx para usar este nuevo hook.
```

### Prompt 1.6: Crear hook useEditorConnections

```
Crea un nuevo hook hooks/useEditorConnections.ts que extraiga la lógica de conexiones de EditorCanvas.tsx.

Debe incluir:
- Estado connections
- Estado creatingConnection
- Estado hoveredInputNode
- Estado selectedConnection
- Estado cyclicConnections
- Estado cycleError
- handlePortDragStart
- handlePortDragEnd
- handleConnectionSelect
- handleConfirmDeleteConnection
- Lógica de detección de ciclos (useEffect)

Actualiza EditorCanvas.tsx para usar este nuevo hook.
```

### Prompt 1.7: Crear hook useEditorSelection

```
Crea un nuevo hook hooks/useEditorSelection.ts que extraiga la lógica de selección múltiple (selection box) de EditorCanvas.tsx.

Debe incluir:
- Estado selectionBox
- Lógica de dibujar el rectángulo de selección
- Lógica de detectar qué nodos están dentro del rectángulo
- Integración con el estado selectedNodes

Actualiza EditorCanvas.tsx para usar este nuevo hook.
```

### Prompt 1.8: Crear hook useEditorKeyboard

```
Crea un nuevo hook hooks/useEditorKeyboard.ts que extraiga todos los event listeners de teclado de EditorCanvas.tsx.

Debe incluir:
- Undo/Redo (Ctrl+Z, Ctrl+Y)
- Navegación con Tab entre nodos
- Navegación con flechas
- Selección con Enter
- Deselección con Escape
- Eliminación con Delete/Backspace

El hook debe recibir:
- nodes, selectedNodes, focusedNodeIndex
- undo, redo, canUndo, canRedo
- setSelectedNodes, setFocusedNodeIndex
- setDeleteConfirm, setDeleteConnectionConfirm
- announceMessage (accesibilidad)

Actualiza EditorCanvas.tsx para usar este nuevo hook.
```

### Prompt 1.9: Extraer componente SaveStatusIndicator

```
Extrae el componente SaveStatusIndicator que está definido dentro de EditorCanvas.tsx (líneas 874-916) a un nuevo archivo components/SaveStatusIndicator.tsx.

Debe ser un componente independiente que reciba:
- saveStatus: SaveStatus
- lang: 'en' | 'es'

Actualiza EditorCanvas.tsx para importar y usar este componente.
```

### Prompt 1.10: Extraer componente EditorToolbar

```
Crea un nuevo componente components/EditorToolbar.tsx que agrupe los botones de la barra superior de EditorCanvas.

Debe incluir:
- SaveStatusIndicator
- Botón de autosave toggle
- ThemeToggle
- Botones Undo/Redo

Recibe como props:
- saveStatus, enableAutosave, setEnableAutosave
- undo, redo, canUndo, canRedo
- lang

Actualiza EditorCanvas.tsx para usar este componente.
```

### Prompt 1.11: Verificar y limpiar EditorCanvas

```
Revisa el archivo components/EditorCanvas.tsx después de todas las extracciones.

1. Verifica que todos los imports estén correctos
2. Elimina código comentado o no usado
3. Verifica que el componente funcione correctamente
4. El archivo debería tener ahora entre 300-400 líneas máximo

Si hay errores de TypeScript, corrígelos.
```

---

## Fase 2: Crear estructura de carpetas Frontend/Backend

### Prompt 2.1: Analizar estructura actual

```
Analiza la estructura actual del proyecto NanoFlow y lista:

1. Qué archivos/carpetas pertenecen al frontend (Next.js)
2. Qué archivos/carpetas pertenecen al backend (api/)
3. Qué archivos son compartidos o de configuración raíz
4. Qué hacer con la carpeta web/ que parece estar vacía o duplicada

No hagas cambios aún, solo analiza y reporta.
```

### Prompt 2.2: Crear estructura frontend/

```
Crea la nueva estructura de carpetas para el frontend.

1. Crea la carpeta frontend/ en la raíz del proyecto
2. Mueve las siguientes carpetas/archivos a frontend/:
   - app/
   - components/
   - hooks/
   - context/
   - utils/
   - styles/
   - public/
   - __tests__/ (tests del frontend)
   - e2e/

3. Mueve los archivos de configuración de Next.js:
   - next.config.ts
   - tailwind.config.ts
   - postcss.config.js
   - tsconfig.json (crea uno nuevo para frontend)

4. Crea un package.json nuevo para frontend con las dependencias de Next.js

No ejecutes aún, solo muéstrame los comandos que usarías.
```

### Prompt 2.3: Reorganizar backend/

```
Reorganiza la carpeta api/ como backend/.

1. Renombra api/ a backend/
2. Verifica que la estructura interna esté correcta:
   - backend/src/routes/
   - backend/src/services/
   - backend/src/types/
   - backend/src/middleware/
   - backend/src/config/
   - backend/prisma/

3. Actualiza las rutas en los archivos de configuración si es necesario

No ejecutes aún, solo muéstrame el plan.
```

### Prompt 2.4: Crear configuración raíz del monorepo

```
Crea la configuración raíz para el monorepo:

1. Crea/actualiza package.json raíz con:
   - Workspaces para frontend y backend
   - Scripts para correr ambos proyectos
   - Scripts para build, test, lint de todo

2. Crea tsconfig.json raíz con references a frontend y backend

3. Crea un README.md actualizado con la nueva estructura

4. Actualiza .gitignore si es necesario
```

### Prompt 2.5: Actualizar imports y referencias

```
Después de mover las carpetas, actualiza todos los imports y referencias:

1. Busca todos los imports relativos que necesiten actualizarse
2. Actualiza las rutas en archivos de configuración
3. Actualiza el Dockerfile si existe
4. Actualiza docker-compose.yml si existe
5. Verifica que no haya rutas hardcodeadas rotas

Haz una lista de todos los archivos que necesitan cambios antes de ejecutar.
```

### Prompt 2.6: Verificar funcionamiento

```
Verifica que el proyecto funcione después de la reorganización:

1. Ejecuta npm install en la raíz
2. Ejecuta el build del frontend: npm run build -w frontend
3. Ejecuta el build del backend: npm run build -w backend
4. Ejecuta los tests: npm test
5. Verifica que el servidor de desarrollo funcione

Reporta cualquier error encontrado.
```

---

## Fase 3: Limpiar código duplicado y archivos innecesarios

### Prompt 3.1: Identificar archivos no usados

```
Analiza el proyecto y encuentra:

1. Archivos que no están siendo importados por nadie
2. Exports que no se usan
3. Dependencias en package.json que no se usan
4. Archivos en la carpeta dist/ o build/ que no deberían estar en git

No elimines nada aún, solo reporta.
```

### Prompt 3.2: Limpiar carpeta web/

```
Analiza la carpeta web/ en la raíz del proyecto:

1. ¿Qué contiene?
2. ¿Está siendo usada?
3. ¿Es código duplicado del frontend principal?
4. ¿Se debería eliminar o integrar?

Recomienda qué hacer con esta carpeta.
```

### Prompt 3.3: Eliminar código comentado

```
Busca y elimina código comentado en los siguientes archivos:

1. components/EditorCanvas.tsx
2. api/src/services/node-executor.service.ts
3. Cualquier otro archivo con bloques grandes de código comentado

El código comentado con TODO o FIXME debe mantenerse.
El código que simplemente está "deshabilitado" debe eliminarse.
```

### Prompt 3.4: Limpiar archivos dist/

```
Los archivos compilados en api/dist/ no deberían estar en git.

1. Añade api/dist/ al .gitignore si no está
2. Elimina los archivos dist/ del tracking de git:
   git rm -r --cached api/dist/
3. Verifica que el .gitignore tenga todas las carpetas de build correctas
```

---

## Fase 4: Mejorar organización de componentes

### Prompt 4.1: Organizar componentes por feature

```
Reorganiza la carpeta components/ agrupando por funcionalidad:

Estructura propuesta:
components/
├── Editor/
│   ├── EditorCanvas.tsx
│   ├── EditorConnection.tsx
│   ├── EditorNode.tsx
│   ├── EditorToolbar.tsx
│   └── index.ts (re-exports)
├── Node/
│   ├── NodePalette.tsx
│   ├── NodeConfigPanel.tsx
│   ├── DynamicNodeForm.tsx
│   └── index.ts
├── Workflow/
│   ├── WorkflowRunner.tsx
│   ├── SaveLoadMenu.tsx
│   ├── TemplateGallery.tsx
│   └── index.ts
├── Navigation/
│   ├── MiniMap.tsx
│   ├── ZoomControls.tsx
│   ├── SearchBar.tsx
│   └── index.ts
├── Common/
│   ├── ContextMenu.tsx
│   ├── ConfirmDialog.tsx
│   ├── ThemeToggle.tsx
│   ├── Onboarding.tsx
│   └── index.ts
├── Dashboard/
│   ├── MetricsDashboard.tsx
│   └── index.ts
├── sections/ (mantener como está)
└── ui/ (mantener como está)

Mueve los archivos y actualiza los imports.
```

### Prompt 4.2: Crear archivos index.ts

```
Crea archivos index.ts en cada subcarpeta de components/ para facilitar imports:

Ejemplo para components/Editor/index.ts:
export { default as EditorCanvas } from './EditorCanvas';
export { default as EditorConnection } from './EditorConnection';
export { default as EditorNode } from './EditorNode';
export * from './EditorConnection'; // para tipos como Connection

Repite para todas las subcarpetas.
```

### Prompt 4.3: Actualizar imports en app/

```
Actualiza todos los imports en la carpeta app/ para usar los nuevos paths:

Antes:
import EditorCanvas from '@/components/EditorCanvas';

Después:
import { EditorCanvas } from '@/components/Editor';

Haz esto para todos los archivos en app/.
```

---

## Fase 5: Configurar monorepo (opcional)

### Prompt 5.1: Configurar npm workspaces

```
Configura npm workspaces para manejar frontend y backend:

1. Actualiza package.json raíz:
{
  "name": "nanoflow",
  "private": true,
  "workspaces": [
    "frontend",
    "backend"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev -w frontend\" \"npm run dev -w backend\"",
    "build": "npm run build -w frontend && npm run build -w backend",
    "test": "npm run test -w frontend && npm run test -w backend",
    "lint": "npm run lint -w frontend && npm run lint -w backend"
  }
}

2. Instala concurrently como devDependency raíz
3. Verifica que npm install funcione desde la raíz
```

### Prompt 5.2: Crear paquete compartido (opcional)

```
Si hay tipos o utilidades compartidas entre frontend y backend, crea un paquete shared:

1. Crea carpeta packages/shared/
2. Inicializa con package.json
3. Mueve tipos compartidos (ej: WorkflowNode, Connection)
4. Configura tsconfig para compilar
5. Actualiza workspaces para incluir packages/*
6. Actualiza imports en frontend y backend
```

### Prompt 5.3: Configurar Docker para monorepo

```
Actualiza la configuración de Docker para el monorepo:

1. Crea Dockerfile para frontend
2. Actualiza Dockerfile para backend
3. Actualiza docker-compose.yml para:
   - Servicio frontend (Next.js)
   - Servicio backend (Express)
   - Servicio database (si aplica)
   - Configurar networking entre servicios
```

---

## Orden recomendado de ejecución

1. **Fase 1 completa** - Refactorizar EditorCanvas primero (más urgente por las 1000+ líneas)
2. **Fase 3** - Limpiar código antes de mover cosas
3. **Fase 4** - Organizar componentes
4. **Fase 2** - Separar frontend/backend
5. **Fase 5** - Configurar monorepo (si lo deseas)

---

## Notas importantes

- **Haz commits frecuentes**: Después de cada prompt completado, haz un commit
- **Prueba después de cada cambio**: Verifica que el proyecto compile y funcione
- **No hagas todo de una vez**: Es mejor hacer cambios pequeños e incrementales
- **Mantén un backup**: Antes de empezar, asegúrate de tener un backup o que todo esté en git

---

## Comandos útiles para verificar

```bash
# Verificar que TypeScript compile sin errores
npm run build

# Verificar que los tests pasen
npm test

# Verificar que el linter no reporte errores
npm run lint

# Iniciar en modo desarrollo para probar
npm run dev
```
