// frontend/components/Common/ShortcutsGuide.tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { GitBranch, Keyboard, MousePointerClick, Terminal, X, Zap } from 'lucide-react';

interface ShortcutsGuideProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
}

export default function ShortcutsGuide({ isOpen, onClose, lang }: ShortcutsGuideProps) {
  const text = {
    en: {
      title: 'Editor Shortcuts & Features',
      sections: {
        general: 'General Actions',
        nodeManagement: 'Node Management',
        connections: 'Connections (Soldering)',
        navigation: 'Navigation & View',
        testing: 'Testing & Debugging',
        documentation: 'Documentation',
      },
      general: [
        { key: 'Ctrl/Cmd + Z', description: 'Undo last action' },
        { key: 'Ctrl/Cmd + Y / Ctrl/Cmd + Shift + Z', description: 'Redo last action' },
        { key: 'Delete / Backspace', description: 'Delete selected nodes/connections' },
        { key: 'Escape', description: 'Deselect all nodes/connections' },
        { key: 'Click', description: 'Select a single node/connection' },
        { key: 'Shift + Click', description: 'Add/remove node from selection' },
      ],
      nodeManagement: [
        { key: 'Ctrl/Cmd + C', description: 'Copy selected nodes' },
        { key: 'Ctrl/Cmd + X', description: 'Cut selected nodes' },
        { key: 'Ctrl/Cmd + V', description: 'Paste nodes from clipboard (offset position)' },
        { key: 'Ctrl/Cmd + E', description: 'Toggle enable/disable selected nodes' },
        { key: 'Arrow Keys', description: 'Nudge selected nodes by 1px' },
        { key: 'Shift + Arrow Keys', description: 'Nudge selected nodes by 10px' },
        { key: 'Double Click Node', description: 'Open node configuration panel' },
        {
          key: 'Right Click Node',
          description: 'Open node context menu (Duplicate, Delete, Toggle Enable)',
        },
      ],
      connections: [
        { key: 'Drag from Node Port', description: 'Start drawing a connection (solder)' },
        { key: 'Drop on Node Port', description: 'Complete connection to another node' },
        {
          key: 'Drop on Empty Canvas',
          description: 'Pause soldering, open node search to create & connect a new node',
        },
        { key: 'Escape (during solder)', description: 'Cancel current soldering operation' },
      ],
      navigation: [
        { key: 'Mouse Wheel', description: 'Zoom In/Out' },
        { key: 'Drag Empty Canvas', description: 'Pan the editor view' },
        {
          key: 'Toolbar Buttons',
          description: 'Zoom In (+), Zoom Out (-), Fit View, Reset Zoom (Home)',
        },
        { key: 'Search Bar', description: 'Search for existing nodes or add new ones' },
      ],
      testing: [
        {
          key: 'Run Button (Toolbar)',
          description: 'Open Advanced Run Dialog to execute workflow with custom input',
        },
        { key: 'Terminal Panel', description: 'View live execution logs and node statuses' },
      ],
      documentation: [
        {
          key: 'Note Node',
          description: 'Add customizable sticky notes directly on the canvas for documentation',
        },
      ],
      close: 'Close',
    },
    es: {
      title: 'Atajos y Funcionalidades del Editor',
      sections: {
        general: 'Acciones Generales',
        nodeManagement: 'Gestión de Nodos',
        connections: 'Conexiones (Soldadura)',
        navigation: 'Navegación y Vista',
        testing: 'Pruebas y Depuración',
        documentation: 'Documentación',
      },
      general: [
        { key: 'Ctrl/Cmd + Z', description: 'Deshacer última acción' },
        { key: 'Ctrl/Cmd + Y / Ctrl/Cmd + Shift + Z', description: 'Rehacer última acción' },
        { key: 'Suprimir / Backspace', description: 'Eliminar nodos/conexiones seleccionados' },
        { key: 'Escape', description: 'Deseleccionar todos los nodos/conexiones' },
        { key: 'Clic', description: 'Seleccionar un nodo/conexión' },
        { key: 'Shift + Clic', description: 'Añadir/quitar nodo de la selección' },
      ],
      nodeManagement: [
        { key: 'Ctrl/Cmd + C', description: 'Copiar nodos seleccionados' },
        { key: 'Ctrl/Cmd + X', description: 'Cortar nodos seleccionados' },
        { key: 'Ctrl/Cmd + V', description: 'Pegar nodos del portapapeles (posición desplazada)' },
        { key: 'Ctrl/Cmd + E', description: 'Alternar activar/desactivar nodos seleccionados' },
        { key: 'Teclas de Flecha', description: 'Mover nodos seleccionados 1px' },
        { key: 'Shift + Teclas de Flecha', description: 'Mover nodos seleccionados 10px' },
        { key: 'Doble Clic en Nodo', description: 'Abrir panel de configuración del nodo' },
        {
          key: 'Clic Derecho en Nodo',
          description: 'Abrir menú contextual del nodo (Duplicar, Eliminar, Activar/Desactivar)',
        },
      ],
      connections: [
        {
          key: 'Arrastrar desde Puerto de Nodo',
          description: 'Iniciar la creación de una conexión (soldadura)',
        },
        { key: 'Soltar en Puerto de Nodo', description: 'Completar conexión a otro nodo' },
        {
          key: 'Soltar en Lienzo Vacío',
          description: 'Pausar soldadura, abrir búsqueda para crear y conectar un nuevo nodo',
        },
        {
          key: 'Escape (durante soldadura)',
          description: 'Cancelar operación de soldadura actual',
        },
      ],
      navigation: [
        { key: 'Rueda del Ratón', description: 'Acercar/Alejar (Zoom In/Out)' },
        { key: 'Arrastrar Lienzo Vacío', description: 'Panear la vista del editor' },
        {
          key: 'Botones de la Barra',
          description: 'Acercar (+), Alejar (-), Ajustar Vista, Reiniciar Zoom (Home)',
        },
        { key: 'Barra de Búsqueda', description: 'Buscar nodos existentes o añadir nuevos' },
      ],
      testing: [
        {
          key: 'Botón Ejecutar (Barra)',
          description:
            'Abrir Diálogo de Ejecución Avanzada para probar workflow con entrada personalizada',
        },
        {
          key: 'Panel de Terminal',
          description: 'Ver registros de ejecución en vivo y estados de los nodos',
        },
      ],
      documentation: [
        {
          key: 'Nodo de Nota',
          description:
            'Añadir notas adhesivas personalizables directamente en el lienzo para documentación',
        },
      ],
      close: 'Cerrar',
    },
  }[lang];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: -20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: -20 }}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 shadow-2xl lg:max-w-3xl xl:max-w-4xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-700 bg-slate-800 p-6">
              <h2 className="flex items-center gap-3 text-xl font-semibold text-slate-100">
                <Keyboard size={24} className="text-primary/70" /> {text.title}
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 transition-colors hover:text-slate-200"
              >
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 text-slate-300 md:grid-cols-2">
              {/* General Actions */}
              <div>
                <h3 className="text-primary/70 mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Zap size={18} /> {text.sections.general}
                </h3>
                <ul className="space-y-2">
                  {text.general.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-3 flex-shrink-0 rounded-md bg-slate-700 px-2 py-1 font-mono text-xs text-slate-100">
                        {item.key}
                      </span>
                      <span className="text-sm">{item.description}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Node Management */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-green-400">
                  <MousePointerClick size={18} /> {text.sections.nodeManagement}
                </h3>
                <ul className="space-y-2">
                  {text.nodeManagement.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-3 flex-shrink-0 rounded-md bg-slate-700 px-2 py-1 font-mono text-xs text-slate-100">
                        {item.key}
                      </span>
                      <span className="text-sm">{item.description}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Connections (Soldering) */}
              <div>
                <h3 className="text-primary/70 mb-3 flex items-center gap-2 text-lg font-semibold">
                  <GitBranch size={18} /> {text.sections.connections}
                </h3>
                <ul className="space-y-2">
                  {text.connections.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-3 flex-shrink-0 rounded-md bg-slate-700 px-2 py-1 font-mono text-xs text-slate-100">
                        {item.key}
                      </span>
                      <span className="text-sm">{item.description}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Navigation & View */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-yellow-400">
                  <MousePointerClick size={18} /> {text.sections.navigation}
                </h3>
                <ul className="space-y-2">
                  {text.navigation.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-3 flex-shrink-0 rounded-md bg-slate-700 px-2 py-1 font-mono text-xs text-slate-100">
                        {item.key}
                      </span>
                      <span className="text-sm">{item.description}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Testing & Debugging */}
              <div>
                <h3 className="text-primary/70 mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Terminal size={18} /> {text.sections.testing}
                </h3>
                <ul className="space-y-2">
                  {text.testing.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-3 flex-shrink-0 rounded-md bg-slate-700 px-2 py-1 font-mono text-xs text-slate-100">
                        {item.key}
                      </span>
                      <span className="text-sm">{item.description}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Documentation */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-teal-400">
                  <Keyboard size={18} /> {text.sections.documentation}
                </h3>
                <ul className="space-y-2">
                  {text.documentation.map((item, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-3 flex-shrink-0 rounded-md bg-slate-700 px-2 py-1 font-mono text-xs text-slate-100">
                        {item.key}
                      </span>
                      <span className="text-sm">{item.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
