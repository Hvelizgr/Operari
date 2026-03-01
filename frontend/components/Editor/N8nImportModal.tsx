'use client';

import { useState, useEffect } from 'react';
import { X, Download, Search, RefreshCw, AlertCircle, Check, Loader2 } from 'lucide-react';
import { apiFetch } from '../../utils/api';

interface N8nWorkflow {
    id: string;
    name: string;
    active: boolean;
    nodes: any[];
    connections: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
}

interface N8nImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (nodes: any[], connections: any) => void;
    lang: 'en' | 'es';
}

const translations = {
    en: {
        title: 'Import from n8n',
        subtitle: 'Select a workflow from your n8n instance',
        search: 'Search workflows...',
        refresh: 'Refresh',
        noWorkflows: 'No workflows found',
        loading: 'Loading workflows...',
        error: 'Error loading workflows',
        import: 'Import',
        cancel: 'Cancel',
        active: 'Active',
        inactive: 'Inactive',
        nodes: 'nodes',
        lastUpdated: 'Last updated',
        connectionError: 'Could not connect to n8n. Check your configuration.',
        importing: 'Importing...',
        importSuccess: 'Workflow imported successfully!',
    },
    es: {
        title: 'Importar desde n8n',
        subtitle: 'Selecciona un workflow de tu instancia n8n',
        search: 'Buscar workflows...',
        refresh: 'Actualizar',
        noWorkflows: 'No se encontraron workflows',
        loading: 'Cargando workflows...',
        error: 'Error al cargar workflows',
        import: 'Importar',
        cancel: 'Cancelar',
        active: 'Activo',
        inactive: 'Inactivo',
        nodes: 'nodos',
        lastUpdated: 'Última actualización',
        connectionError: 'No se pudo conectar a n8n. Verifica tu configuración.',
        importing: 'Importando...',
        importSuccess: '¡Workflow importado exitosamente!',
    },
};

export default function N8nImportModal({ isOpen, onClose, onImport, lang }: N8nImportModalProps) {
    const t = translations[lang];
    const [workflows, setWorkflows] = useState<N8nWorkflow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedWorkflow, setSelectedWorkflow] = useState<N8nWorkflow | null>(null);
    const [importing, setImporting] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchWorkflows();
        } else {
            setSelectedWorkflow(null);
            setImportSuccess(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const fetchWorkflows = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiFetch('/api/n8n/workflows');
            if (response.ok) {
                const data = await response.json();
                setWorkflows(data.data || data || []);
            } else {
                setError(t.connectionError);
            }
        } catch (err) {
            setError(t.connectionError);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        if (!selectedWorkflow) return;

        setImporting(true);
        try {
            const response = await apiFetch(`/api/n8n/workflows/${selectedWorkflow.id}`);
            if (response.ok) {
                const workflow = await response.json();
                onImport(workflow.nodes || [], workflow.connections || {});
                setImportSuccess(true);
                setTimeout(() => {
                    onClose();
                }, 1000);
            } else {
                setError(t.error);
            }
        } catch (err) {
            setError(t.error);
        } finally {
            setImporting(false);
        }
    };

    const filteredWorkflows = workflows.filter((w) =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Download className="w-5 h-5 text-orange-500" />
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

                <div className="p-4 border-b border-slate-700">
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder={t.search}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>
                        <button
                            onClick={fetchWorkflows}
                            disabled={loading}
                            className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {t.refresh}
                        </button>
                    </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                            <span className="ml-3 text-slate-400">{t.loading}</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                            <p className="text-red-400">{error}</p>
                            <button
                                onClick={fetchWorkflows}
                                className="mt-4 px-4 py-2 bg-slate-800 rounded-lg text-slate-300 hover:bg-slate-700"
                            >
                                {t.refresh}
                            </button>
                        </div>
                    ) : filteredWorkflows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <p className="text-slate-400">{t.noWorkflows}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-700">
                            {filteredWorkflows.map((workflow) => (
                                <button
                                    key={workflow.id}
                                    onClick={() => setSelectedWorkflow(workflow)}
                                    className={`w-full p-4 text-left hover:bg-slate-800/50 transition-colors ${
                                        selectedWorkflow?.id === workflow.id
                                            ? 'bg-orange-500/10 border-l-4 border-orange-500'
                                            : ''
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-medium text-white">{workflow.name}</h3>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-xs ${
                                                        workflow.active
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : 'bg-slate-700 text-slate-400'
                                                    }`}
                                                >
                                                    {workflow.active ? t.active : t.inactive}
                                                </span>
                                                <span>
                                                    {workflow.nodes?.length || 0} {t.nodes}
                                                </span>
                                                {workflow.updatedAt && (
                                                    <span>
                                                        {t.lastUpdated}:{' '}
                                                        {new Date(workflow.updatedAt).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {selectedWorkflow?.id === workflow.id && (
                                            <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
                    {importSuccess ? (
                        <div className="flex items-center gap-2 text-green-400">
                            <Check className="w-5 h-5" />
                            {t.importSuccess}
                        </div>
                    ) : (
                        <div />
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                        >
                            {t.cancel}
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!selectedWorkflow || importing}
                            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {importing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t.importing}
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    {t.import}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
