'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Palette, Sparkles, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { WorkflowNode } from '@nanoflow/shared';
import { NodeType } from './NodePalette';
import { useNodeTypes } from '@/hooks/useNodeTypes';
import DynamicNodeForm from './DynamicNodeForm';
import { apiFetch } from '@/utils/api';
import NodeComments from './NodeComments';

interface NodeConfigPanelProps {
    node: WorkflowNode | null;
    nodeTypeDefinition?: NodeType;
    onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    onClose: () => void;
    lang: 'en' | 'es';
    nodes: WorkflowNode[];
}

export default function NodeConfigPanel({ node, nodeTypeDefinition, onUpdate, onClose, lang, nodes }: NodeConfigPanelProps) {
    const [localTitle, setLocalTitle] = useState('');
    const [localConfig, setLocalConfig] = useState<Record<string, any>>({});
    const [localColor, setLocalColor] = useState<string | undefined>(undefined);
    const [isSuggesting, setIsSuggesting] = useState(false);

    const { nodeTypes: allNodeTypes } = useNodeTypes();
    const nodeTypeInfo = node ? allNodeTypes.find(t => t.type === node.type) : null;
    const nodeDescription = nodeTypeInfo?.description?.[lang];
    const defaultColor = nodeTypeInfo?.color || '#3b82f6';

    useEffect(() => {
        if (node) {
            setLocalTitle(node.title);
            setLocalConfig(node.config || {});
            setLocalColor(node.color);
        }
    }, [node]);

    const handleAISuggest = async () => {
        if (!node || isSuggesting) return;

        setIsSuggesting(true);
        try {
            const workflowContext = {
                nodes: nodes,
                connections: [], // We could pass connections if needed, but for now nodes are enough
            };

            const result = await apiFetch('/api/ai/suggest-config', {
                method: 'POST',
                body: JSON.stringify({
                    node,
                    workflowContext,
                    lang
                })
            });

            if (result.config) {
                setLocalConfig(result.config);
                onUpdate(node.id, { config: result.config });
            }
        } catch (error) {
            console.error('Failed to get AI suggestion:', error);
        } finally {
            setIsSuggesting(false);
        }
    };

    const content = {
        en: {
            title: 'Configuration',
            nodeName: 'Label',
            nodeType: 'Type',
            settings: 'Properties',
            close: 'Close',
            aiSuggest: 'AI Auto-complete'
        },
        es: {
            title: 'Configuración',
            nodeName: 'Etiqueta',
            nodeType: 'Tipo',
            settings: 'Propiedades',
            close: 'Cerrar',
            aiSuggest: 'Auto-completar con IA'
        },
    };


    const text = content[lang] || content['en'];

    if (!node) return null;

    return (
        <AnimatePresence>
            <motion.div
                // ... styles ...
                className="absolute right-4 top-4 bottom-4 w-[400px] shadow-[0_0_30px_rgba(0,0,0,0.5)] z-40 flex flex-col"
                initial={{ x: '120%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '120%', opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{
                    background: 'var(--box-background-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                } as any}
                onWheel={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header matching RunDialog style */}
                <div
                    className="dialog_title"
                    style={{
                        background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)',
                        borderBottom: '1px solid var(--border-color)',
                        height: '40px',
                        minHeight: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: '10px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: 'var(--highlight-color)',
                        userSelect: 'none'
                    }}
                >
                    <span className="mr-2"><Settings size={16} /></span>
                    {text.title}
                    <div className="flex-1" />
                    <div className="button icon" style={{ margin: '5px' }} onClick={onClose}>
                        <X size={16} />
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                    {/* Node Info Block */}
                    <div className="mb-6 pb-4 border-b border-[var(--border-color)]">
                        <div className="mb-4">
                            <label className="block text-[11px] font-bold uppercase text-[var(--descriptor-color)] mb-1">{text.nodeName}</label>
                            <input
                                type="text"
                                value={localTitle}
                                onChange={(e) => {
                                    setLocalTitle(e.target.value);
                                    if (node) onUpdate(node.id, { title: e.target.value });
                                }}
                                className="w-full bg-black/20 border border-[var(--border-color)] rounded p-2 text-sm text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase text-[var(--descriptor-color)] mb-1">{text.nodeType}</label>
                            <div className="text-xs text-[var(--body-text-color)] opacity-70 font-mono">
                                {node.type}
                            </div>
                            {nodeDescription && (
                                <p className="mt-2 text-[11px] text-[var(--descriptor-color)] italic leading-tight">
                                    {nodeDescription}
                                </p>
                            )}
                        </div>

                        {/* Appearance / Color */}
                        <div className="mt-4">
                            <label className="block text-[11px] font-bold uppercase text-[var(--descriptor-color)] mb-1 flex items-center gap-1">
                                <Palette size={12} />
                                {lang === 'es' ? 'Color' : 'Color'}
                            </label>
                            <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={localColor || defaultColor}
                                onChange={(e) => {
                                    setLocalColor(e.target.value);
                                    if (node) onUpdate(node.id, { color: e.target.value });
                                }}
                                className="w-10 h-8 rounded border border-[var(--border-color)] cursor-pointer bg-transparent"
                            />
                                <input
                                    type="text"
                                    value={localColor || defaultColor}
                                    onChange={(e) => {
                                        setLocalColor(e.target.value);
                                        if (node) onUpdate(node.id, { color: e.target.value });
                                    }}
                                    placeholder="#hex"
                                    className="flex-1 bg-black/20 border border-[var(--border-color)] rounded p-2 text-xs text-[var(--body-text-color)] font-mono focus:outline-none focus:border-[var(--highlight-color)]"
                                />
                                <button
                                    onClick={() => {
                                        setLocalColor(undefined);
                                        if (node) onUpdate(node.id, { color: undefined });
                                    }}
                                    className="text-[10px] text-[var(--descriptor-color)] hover:text-[var(--highlight-color)] px-2"
                                    title={lang === 'es' ? 'Usar color por defecto' : 'Use default color'}
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Settings */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-[12px] font-bold uppercase text-[var(--highlight-color)] flex items-center gap-2">
                                <span className="w-1 h-3 bg-[var(--highlight-color)] rounded-full inline-block"></span>
                                {text.settings}
                            </h3>
                            <button
                                onClick={handleAISuggest}
                                disabled={isSuggesting}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                                    isSuggesting 
                                    ? 'bg-purple-500/20 text-purple-300 cursor-not-allowed' 
                                    : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30'
                                }`}
                                title={text.aiSuggest}
                            >
                                {isSuggesting ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : (
                                    <Sparkles size={12} />
                                )}
                                {text.aiSuggest}
                            </button>
                        </div>

                        <div className="space-y-4">
                            <SettingsResolver
                                node={node}
                                localConfig={localConfig}
                                setLocalConfig={setLocalConfig}
                                onUpdate={onUpdate}
                                nodeTypeDefinition={nodeTypeDefinition || allNodeTypes.find(t => t.type === node?.type)}
                                lang={lang}
                                nodes={nodes}
                                connections={[]}
                            />
                        </div>
                    </div>

                    {/* Node Comments */}
                    <div className="mt-8 pt-6 border-t border-[var(--border-color)]">
                        <NodeComments 
                            workflowId="current-workflow" 
                            nodeId={node.id} 
                            lang={lang} 
                        />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

// Helper to keep main component clean
function SettingsResolver({ node, localConfig, setLocalConfig, onUpdate, nodeTypeDefinition, lang, nodes, connections }: any) {
    const handleConfigChange = (key: string, value: any) => {
        const newConfig = { ...localConfig, [key]: value };
        setLocalConfig(newConfig);
        if (node) {
            onUpdate(node.id, { config: newConfig });
        }
    };

    // ConfigField Helper
    const ConfigField = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
        <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase text-[var(--descriptor-color)]">{label}</label>
            {children}
            {description && <p className="text-[10px] text-[var(--descriptor-color)] opacity-70 leading-tight">{description}</p>}
        </div>
    );

    // Input Style
    const inputClass = "w-full bg-black/20 border border-[var(--border-color)] rounded p-2 text-sm text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors font-mono";

    // 1. Dynamic Form
    if (nodeTypeDefinition?.properties && nodeTypeDefinition.properties.length > 0) {
        return (
            <DynamicNodeForm
                properties={nodeTypeDefinition.properties}
                values={localConfig}
                onChange={(key, val) => handleConfigChange(key, val)}
                nodes={nodes}
                connections={connections}
                lang={lang}
            />
        );
    }

    // 2. Specific Fallbacks
    if (node?.type === 'n8n-nodes-base.httpRequest') {
        return (
            <div className="space-y-4">
                <ConfigField label="URL" description="Endpoint URL">
                    <input type="text" value={localConfig.url || ''} onChange={(e) => handleConfigChange('url', e.target.value)} className={inputClass} placeholder="https://..." />
                </ConfigField>
                <ConfigField label="Method" description="HTTP Verb">
                    <select value={localConfig.method || 'GET'} onChange={(e) => handleConfigChange('method', e.target.value)} className={inputClass}>
                        {['GET', 'POST', 'PUT', 'DELETE'].map(m => <option key={m}>{m}</option>)}
                    </select>
                </ConfigField>
            </div>
        );
    }

    // Default JSON editor for unknown types
    return (
        <ConfigField label="Raw Configuration (JSON)" description="Edit properties directly">
            <textarea
                value={JSON.stringify(localConfig, null, 2)}
                onChange={(e) => {
                    try {
                        const parsed = JSON.parse(e.target.value);
                        setLocalConfig(parsed);
                        onUpdate(node.id, { config: parsed });
                    } catch { }
                }}
                rows={15}
                className={inputClass}
            />
        </ConfigField>
    );

}
