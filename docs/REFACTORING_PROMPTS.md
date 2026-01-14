

### Prompt 3.4: Limpiar archivos dist/

```
Los archivos compilados en api/dist/ no deberían estar en git.

1. Añade api/dist/ al .gitignore si no está
2. Elimina los archivos dist/ del tracking de git:s
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

