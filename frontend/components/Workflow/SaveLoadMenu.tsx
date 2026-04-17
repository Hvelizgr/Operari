'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Save, FolderOpen, Download, Upload, X } from 'lucide-react';
import { useState, useRef } from 'react';
import type { WorkflowNode, Connection } from '@cairn/shared';

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
        localStorage.setItem('nanoflow-workflow', JSON.stringify(workflow));
    };

    const handleLoad = () => {
        const saved = localStorage.getItem('nanoflow-workflow');
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
            reader.onload = (event) => {
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
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-40">
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-lg border border-slate-700"
                    title={text.save}
                >
                    <Save size={16} />
                    {text.save}
                </button>

                <button
                    onClick={handleLoad}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-lg border border-slate-700"
                    title={text.load}
                >
                    <FolderOpen size={16} />
                    {text.load}
                </button>

                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-lg border border-slate-700"
                    title={text.export}
                >
                    <Download size={16} />
                    {text.export}
                </button>

                <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors shadow-lg border border-slate-700"
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
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowImportModal(false)} />

                        <motion.div
                            className="relative bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-6 max-w-2xl w-full mx-4"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-100">{text.importTitle}</h3>
                                <button
                                    onClick={() => setShowImportModal(false)}
                                    className="text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                placeholder={text.importPlaceholder}
                                className="w-full h-64 bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-200 text-sm font-mono resize-none focus:outline-none focus:border-primary"
                            />

                            <div className="flex items-center justify-end gap-3 mt-4">
                                <button
                                    onClick={() => setShowImportModal(false)}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition-colors"
                                >
                                    {text.cancel}
                                </button>
                                <button
                                    onClick={handleImportText}
                                    className="px-4 py-2 bg-primary hover:bg-primary text-white rounded-lg font-medium transition-colors"
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
