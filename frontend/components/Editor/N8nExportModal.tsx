'use client';

import { useState } from 'react';
import { X, Upload, Copy, Check, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../utils/api';

interface N8nExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    nodes: any[];
    connections: any[];
    workflowName: string;
    lang: 'en' | 'es';
}

const translations = {
    en: {
        title: 'Export to n8n',
        subtitle: 'Push your workflow to n8n or copy as JSON',
        workflowName: 'Workflow Name',
        exportOptions: 'Export Options',
        pushToN8n: 'Push to n8n',
        pushDescription: 'Create this workflow directly in your n8n instance',
        copyJson: 'Copy JSON',
        copyDescription: 'Copy the n8n-compatible JSON to clipboard',
        downloadJson: 'Download JSON',
        downloadDescription: 'Save the workflow as a .json file',
        cancel: 'Cancel',
        exporting: 'Exporting...',
        exportSuccess: 'Workflow exported to n8n!',
        exportError: 'Export failed. Check n8n connection.',
        copied: 'Copied!',
        preview: 'Preview',
        nodesCount: 'nodes',
        connectionsCount: 'connections',
        openInN8n: 'Open in n8n',
        activate: 'Activate workflow',
    },
    es: {
        title: 'Exportar a n8n',
        subtitle: 'Envía tu workflow a n8n o copia como JSON',
        workflowName: 'Nombre del Workflow',
        exportOptions: 'Opciones de Exportación',
        pushToN8n: 'Enviar a n8n',
        pushDescription: 'Crear este workflow directamente en tu instancia n8n',
        copyJson: 'Copiar JSON',
        copyDescription: 'Copiar el JSON compatible con n8n al portapapeles',
        downloadJson: 'Descargar JSON',
        downloadDescription: 'Guardar el workflow como archivo .json',
        cancel: 'Cancelar',
        exporting: 'Exportando...',
        exportSuccess: '¡Workflow exportado a n8n!',
        exportError: 'Falló la exportación. Verifica la conexión a n8n.',
        copied: '¡Copiado!',
        preview: 'Vista Previa',
        nodesCount: 'nodos',
        connectionsCount: 'conexiones',
        openInN8n: 'Abrir en n8n',
        activate: 'Activar workflow',
    },
};

export default function N8nExportModal({
    isOpen,
    onClose,
    nodes,
    connections,
    workflowName,
    lang,
}: N8nExportModalProps) {
    const t = translations[lang];
    const [name, setName] = useState(workflowName);
    const [exporting, setExporting] = useState(false);
    const [exportedId, setExportedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [activateOnExport, setActivateOnExport] = useState(false);

    const convertToN8nFormat = () => {
        const n8nNodes = nodes.map((node: any, index: number) => ({
            id: node.id,
            name: node.title || `Node_${index}`,
            type: node.type?.startsWith('n8n-nodes-base.') ? node.type : `n8n-nodes-base.${node.type || 'noOp'}`,
            position: [node.position?.x || 100 + index * 200, node.position?.y || 300],
            parameters: node.config || node.parameters || {},
            typeVersion: 1,
        }));

        const n8nConnections: Record<string, any> = {};
        connections.forEach((conn: any) => {
            const sourceNode = nodes.find((n: any) => n.id === conn.source);
            if (sourceNode) {
                const sourceName = sourceNode.title || sourceNode.id;
                if (!n8nConnections[sourceName]) {
                    n8nConnections[sourceName] = { main: [[]] };
                }
                const targetNode = nodes.find((n: any) => n.id === conn.target);
                if (targetNode) {
                    n8nConnections[sourceName].main[0].push({
                        node: targetNode.title || targetNode.id,
                        type: 'main',
                        index: 0,
                    });
                }
            }
        });

        return {
            name: name || 'NanoFlow Export',
            nodes: n8nNodes,
            connections: n8nConnections,
            active: activateOnExport,
            settings: {
                saveExecutionProgress: true,
                saveManualExecutions: true,
            },
        };
    };

    const handlePushToN8n = async () => {
        setExporting(true);
        setError(null);
        try {
            const n8nWorkflow = convertToN8nFormat();
            const response = await apiFetch('/api/n8n/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(n8nWorkflow),
            });

            if (response.ok) {
                const data = await response.json();
                setExportedId(data.id);
            } else {
                const errorData = await response.json().catch(() => ({}));
                setError(errorData.message || t.exportError);
            }
        } catch (err) {
            setError(t.exportError);
        } finally {
            setExporting(false);
        }
    };

    const handleCopyJson = async () => {
        const n8nWorkflow = convertToN8nFormat();
        await navigator.clipboard.writeText(JSON.stringify(n8nWorkflow, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadJson = () => {
        const n8nWorkflow = convertToN8nFormat();
        const blob = new Blob([JSON.stringify(n8nWorkflow, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name || 'workflow'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl border border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Upload className="w-5 h-5 text-orange-500" />
                            {t.title}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">{t.subtitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            {t.workflowName}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>

                    <div className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex-1">
                            <span className="text-slate-300 text-sm">
                                {nodes.length} {t.nodesCount} • {connections.length} {t.connectionsCount}
                            </span>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={activateOnExport}
                                onChange={(e) => setActivateOnExport(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                            />
                            {t.activate}
                        </label>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {exportedId && (
                        <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <div className="flex items-center gap-2 text-green-400">
                                <Check className="w-5 h-5" />
                                <span className="text-sm">{t.exportSuccess}</span>
                            </div>
                            <a
                                href={`${process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:5678'}/workflow/${exportedId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300"
                            >
                                {t.openInN8n}
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    )}

                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
                            {t.exportOptions}
                        </h3>

                        <button
                            onClick={handlePushToN8n}
                            disabled={exporting || !name}
                            className="w-full flex items-center gap-4 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {exporting ? (
                                <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                            ) : (
                                <Upload className="w-6 h-6 text-orange-500" />
                            )}
                            <div className="text-left">
                                <div className="font-medium text-white">
                                    {exporting ? t.exporting : t.pushToN8n}
                                </div>
                                <div className="text-sm text-slate-400">{t.pushDescription}</div>
                            </div>
                        </button>

                        <button
                            onClick={handleCopyJson}
                            className="w-full flex items-center gap-4 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                        >
                            {copied ? (
                                <Check className="w-6 h-6 text-green-500" />
                            ) : (
                                <Copy className="w-6 h-6 text-blue-500" />
                            )}
                            <div className="text-left">
                                <div className="font-medium text-white">
                                    {copied ? t.copied : t.copyJson}
                                </div>
                                <div className="text-sm text-slate-400">{t.copyDescription}</div>
                            </div>
                        </button>

                        <button
                            onClick={handleDownloadJson}
                            className="w-full flex items-center gap-4 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                        >
                            <Upload className="w-6 h-6 text-purple-500 rotate-180" />
                            <div className="text-left">
                                <div className="font-medium text-white">{t.downloadJson}</div>
                                <div className="text-sm text-slate-400">{t.downloadDescription}</div>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="flex justify-end p-4 border-t border-slate-700 bg-slate-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                        {t.cancel}
                    </button>
                </div>
            </div>
        </div>
    );
}
