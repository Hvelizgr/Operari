'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { WorkflowNode } from '@nanoflow/shared';
import { NODE_TYPES, NodeType } from './NodePalette';
import DynamicNodeForm from './DynamicNodeForm';
import RetryPolicyEditor from './RetryPolicyEditor';

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

    // ... existing initialization ...
    const nodeTypeInfo = node ? NODE_TYPES.find(t => t.type === node.type) : null;
    const nodeDescription = nodeTypeInfo?.description?.[lang];

    useEffect(() => {
        if (node) {
            setLocalTitle(node.title);
            setLocalConfig(node.config || {});
        }
    }, [node]);

    // ... existing content object ...

    const content = {
        en: {
            title: 'Configuration',
            nodeName: 'Label',
            nodeType: 'Type',
            settings: 'Properties',
            close: 'Close',
        },
        es: {
            title: 'Configuración',
            nodeName: 'Etiqueta',
            nodeType: 'Tipo',
            settings: 'Propiedades',
            close: 'Cerrar',
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
                    </div>

                    {/* Dynamic Settings */}
                    <div>
                        <h3 className="text-[12px] font-bold uppercase text-[var(--highlight-color)] mb-3 flex items-center gap-2">
                            <span className="w-1 h-3 bg-[var(--highlight-color)] rounded-full inline-block"></span>
                            {text.settings}
                        </h3>

                        <div className="space-y-4">
                            <SettingsResolver
                                node={node}
                                localConfig={localConfig}
                                setLocalConfig={setLocalConfig}
                                onUpdate={onUpdate}
                                nodeTypeDefinition={nodeTypeDefinition || NODE_TYPES.find(t => t.type === node?.type)}
                                lang={lang}
                                nodes={nodes}
                                connections={[]}
                            />
                        </div>
                    </div>

                    {/* Retry policy — cross-cutting, applies to every step type */}
                    <div className="mt-6 pt-6 border-t border-[var(--border-color)]">
                        <RetryPolicyEditor
                            lang={lang}
                            value={localConfig._retry}
                            onChange={(retry) => {
                                const newConfig = { ...localConfig };
                                if (retry) {
                                    newConfig._retry = retry;
                                } else {
                                    delete newConfig._retry;
                                }
                                setLocalConfig(newConfig);
                                onUpdate(node.id, { config: newConfig });
                            }}
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
