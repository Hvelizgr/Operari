'use client';

import type { Connection, WorkflowNode } from '@operari/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, FolderOpen, Save, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { storageRead, storageWrite } from '../../lib/storage-compat';

interface SaveLoadMenuProps {
  nodes: WorkflowNode[];
  connections: Connection[];
  onLoad: (nodes: WorkflowNode[], connections: Connection[]) => void;
  lang: 'en' | 'es';
}

export default function SaveLoadMenu({ nodes, connections, onLoad, lang }: SaveLoadMenuProps) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const content = {
    en: {
      save: 'Save',
      load: 'Load',
      export: 'Export JSON',
      import: 'Import',
      importTitle: 'Import Workflow',
      importPlaceholder: 'Paste JSON here...',
      importButton: 'Import',
      cancel: 'Cancel',
      saved: 'Saved!',
    },
    es: {
      save: 'Guardar',
      load: 'Cargar',
      export: 'Exportar JSON',
      import: 'Importar',
      importTitle: 'Importar Flujo',
      importPlaceholder: 'Pega JSON aquí...',
      importButton: 'Importar',
      cancel: 'Cancelar',
      saved: '¡Guardado!',
    },
  };

  const text = content[lang] || content['en'];

  const handleSave = () => {
    const workflow = {
      nodes,
      connections,
      version: '1.0',
      timestamp: Date.now(),
    };
    storageWrite('operari-workflow', JSON.stringify(workflow));
  };

  const handleLoad = () => {
    const saved = storageRead('operari-workflow');
    if (saved) {
      try {
        const workflow = JSON.parse(saved);
        onLoad(workflow.nodes || [], workflow.connections || []);
      } catch (e) {
        console.error('Failed to load workflow:', e);
      }
    }
  };

  const handleExport = () => {
    const workflow = {
      nodes,
      connections,
      version: '1.0',
      timestamp: Date.now(),
    };
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const workflow = JSON.parse(event.target?.result as string);
          onLoad(workflow.nodes || [], workflow.connections || []);
        } catch (e) {
          console.error('Failed to import workflow:', e);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImportText = () => {
    try {
      const workflow = JSON.parse(importText);
      onLoad(workflow.nodes || [], workflow.connections || []);
      setShowImportModal(false);
      setImportText('');
    } catch (e) {
      console.error('Failed to import workflow:', e);
    }
  };

  return (
    <>
      <div className="absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 shadow-lg transition-colors hover:bg-slate-700"
          title={text.save}
        >
          <Save size={16} />
          {text.save}
        </button>

        <button
          onClick={handleLoad}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 shadow-lg transition-colors hover:bg-slate-700"
          title={text.load}
        >
          <FolderOpen size={16} />
          {text.load}
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 shadow-lg transition-colors hover:bg-slate-700"
          title={text.export}
        >
          <Download size={16} />
          {text.export}
        </button>

        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 shadow-lg transition-colors hover:bg-slate-700"
          title={text.import}
        >
          <Upload size={16} />
          {text.import}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>

      <AnimatePresence>
        {showImportModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowImportModal(false)}
            />

            <motion.div
              className="relative mx-4 w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-800 p-6 shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">{text.importTitle}</h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-slate-400 transition-colors hover:text-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder={text.importPlaceholder}
                className="focus:border-primary h-64 w-full resize-none rounded-lg border border-slate-700 bg-slate-900 p-4 font-mono text-sm text-slate-200 focus:outline-none"
              />

              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="rounded-lg bg-slate-700 px-4 py-2 font-medium text-slate-200 transition-colors hover:bg-slate-600"
                >
                  {text.cancel}
                </button>
                <button
                  onClick={handleImportText}
                  className="bg-primary hover:bg-primary rounded-lg px-4 py-2 font-medium text-white transition-colors"
                >
                  {text.importButton}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
