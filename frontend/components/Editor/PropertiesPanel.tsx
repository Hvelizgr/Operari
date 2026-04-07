'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { WorkflowNode, Connection } from '@nanoflow/shared';
import { NODE_TYPES, NodeType } from '../Node/NodePalette';
import DynamicNodeForm from '../Node/DynamicNodeForm';
import TriggerModifiersSection, { TriggerModifiers, DEFAULT_TRIGGER_MODIFIERS } from '../Node/TriggerModifiersSection';

// Helper to check if a node type is a trigger
const TRIGGER_TYPES = [
    'nanorun.webhook',
    'nanorun.scheduleTrigger',
    'nanorun.manualTrigger',
    'nanorun.cron',
    'Webhook',
    'Trigger',
    'Schedule',
];

function isTriggerNode(nodeType: string): boolean {
    return TRIGGER_TYPES.some(t =>
        nodeType.toLowerCase().includes(t.toLowerCase()) ||
        t.toLowerCase().includes(nodeType.toLowerCase())
    );
}

interface PropertiesPanelProps {
    node: WorkflowNode | null;
    nodeTypeDefinition?: NodeType;
    onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    onClose: () => void;
    lang: 'en' | 'es';
    nodes: WorkflowNode[];
    connections: Connection[];
}

export default function PropertiesPanel({ node, nodeTypeDefinition, onUpdate, onClose, lang, nodes, connections }: PropertiesPanelProps) {
    const [localTitle, setLocalTitle] = useState('');
    const [localConfig, setLocalConfig] = useState<Record<string, any>>({});

    const nodeTypeInfo = node ? NODE_TYPES.find(t => t.type === node.type) : null;
    const nodeDescription = nodeTypeInfo?.description?.[lang];

    useEffect(() => {
        if (node) {
            setLocalTitle(node.title);
            setLocalConfig(node.config || {});
        }
    }, [node]);

    const content = {
        en: {
            title: 'Properties',
            nodeName: 'Label',
            nodeType: 'Type',
            settings: 'Settings',
            close: 'Close',
        },
        es: {
            title: 'Propiedades',
            nodeName: 'Etiqueta',
            nodeType: 'Tipo',
            settings: 'Ajustes',
            close: 'Cerrar',
        },
    };

    const text = content[lang] || content['en'];

    if (!node) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="absolute right-0 top-0 bottom-0 w-80 shadow-2xl z-40 flex flex-col border-l border-slate-700 bg-slate-900"
                initial={{ x: '100%', opacity: 1 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 35 }}
                style={{
                    background: 'var(--box-background-color)',
                    borderLeft: '1px solid var(--border-color)',
                }}
                onWheel={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 h-12 border-b border-slate-700 bg-slate-800/50"
                >
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                        <Settings size={16} />
                        {text.title}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                    {/* Node Label */}
                    <div className="mb-6 space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">{text.nodeName}</label>
                            <input
                                type="text"
                                value={localTitle}
                                onChange={(e) => {
                                    setLocalTitle(e.target.value);
                                    if (node) onUpdate(node.id, { title: e.target.value });
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">{text.nodeType}</label>
                                <span className="text-xs text-slate-400 font-mono bg-slate-950 px-2 py-1 rounded inline-block">
                                    {node.type.split('.').pop()}
                                </span>
                            </div>
                        </div>

                        {nodeDescription && (
                            <p className="text-xs text-slate-500 italic leading-relaxed border-l-2 border-slate-700 pl-2">
                                {nodeDescription}
                            </p>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-slate-700 my-4" />

                    {/* Settings */}
                    <div>
                        <h3 className="text-xs font-bold uppercase text-blue-400 mb-4 flex items-center gap-2">
                            {text.settings}
                        </h3>

                        <SettingsResolver
                            node={node}
                            localConfig={localConfig}
                            setLocalConfig={setLocalConfig}
                            onUpdate={onUpdate}
                            nodeTypeDefinition={nodeTypeDefinition || NODE_TYPES.find(t => t.type === node?.type)}
                            lang={lang}
                            nodes={nodes}
                            connections={connections}
                        />
                    </div>

                    {/* Trigger Modifiers - Only show for trigger nodes */}
                    {isTriggerNode(node.type) && (
                        <>
                            <div className="h-px bg-slate-700 my-4" />
                            <TriggerModifiersSection
                                modifiers={localConfig.triggerModifiers || DEFAULT_TRIGGER_MODIFIERS}
                                onChange={(modifiers) => {
                                    const newConfig = { ...localConfig, triggerModifiers: modifiers };
                                    setLocalConfig(newConfig);
                                    onUpdate(node.id, { config: newConfig });
                                }}
                                lang={lang}
                            />
                        </>
                    )}
                </div>
            </motion.div>
        </AnimatePresence >
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
    if (node?.type === 'nanorun.httpRequest') {
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
