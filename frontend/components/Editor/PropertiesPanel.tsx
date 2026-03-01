'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Palette, Zap, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { WorkflowNode, Connection, NodeTest } from '@nanoflow/shared';
import { NodeType } from '../Node/NodePalette';
import { useNodeTypes } from '@/hooks/useNodeTypes';
import DynamicNodeForm from '../Node/DynamicNodeForm';
import TriggerModifiersSection, { TriggerModifiers, DEFAULT_TRIGGER_MODIFIERS } from '../Node/TriggerModifiersSection';

const TRIGGER_TYPES = [
    'n8n-nodes-base.webhook',
    'n8n-nodes-base.scheduleTrigger',
    'n8n-nodes-base.manualTrigger',
    'n8n-nodes-base.cron',
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

function getNodeTypeWithProperties(apiNodeType: NodeType | undefined, allNodeTypes: NodeType[], nodeType: string | undefined): NodeType | undefined {
    if (!nodeType) return apiNodeType;

    const hasApiProperties = apiNodeType?.properties && apiNodeType.properties.length > 0;

    if (hasApiProperties) {
        return apiNodeType;
    }

    const localNodeType = allNodeTypes.find(t => t.type === nodeType);
    const hasLocalProperties = localNodeType?.properties && localNodeType.properties.length > 0;

    if (hasLocalProperties) {
        if (apiNodeType) {
            return {
                ...apiNodeType,
                properties: localNodeType.properties
            };
        }
        return localNodeType;
    }

    return apiNodeType || localNodeType;
}

interface PropertiesPanelProps {
    node: WorkflowNode | null;
    nodeTypeDefinition?: NodeType;
    onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    onClose: () => void;
    lang: 'en' | 'es';
    nodes: WorkflowNode[];
    connections: Connection[];
    nodeOutputs?: Record<string, any>;
}

export default function PropertiesPanel({ node, nodeTypeDefinition, onUpdate, onClose, lang, nodes, connections, nodeOutputs }: PropertiesPanelProps) {
    const [localTitle, setLocalTitle] = useState('');
    const [localConfig, setLocalConfig] = useState<Record<string, any>>({});
    const [localColor, setLocalColor] = useState<string | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<'config' | 'tests'>('config');
    
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

    const content = {
        en: {
            title: 'Properties',
            nodeName: 'Label',
            nodeType: 'Type',
            settings: 'Settings',
            tests: 'Tests',
            close: 'Close',
        },
        es: {
            title: 'Propiedades',
            nodeName: 'Etiqueta',
            nodeType: 'Tipo',
            settings: 'Ajustes',
            tests: 'Pruebas',
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

                {/* Tabs */}
                <div className="flex border-b border-slate-700 bg-slate-800/30">
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'config' ? 'text-blue-400 bg-blue-400/5 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'}`}
                    >
                        <Settings size={12} />
                        {text.settings}
                    </button>
                    <button
                        onClick={() => setActiveTab('tests')}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'tests' ? 'text-orange-400 bg-orange-400/5 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'}`}
                    >
                        <Zap size={12} />
                        {text.tests}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {activeTab === 'config' ? (
                        <>
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

                                {/* Color Selector */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
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
                                            className="w-10 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                                        />
                                        <input
                                            type="text"
                                            value={localColor || defaultColor}
                                            onChange={(e) => {
                                                setLocalColor(e.target.value);
                                                if (node) onUpdate(node.id, { color: e.target.value });
                                            }}
                                            placeholder="#hex"
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                                        />
                                        <button
                                            onClick={() => {
                                                setLocalColor(undefined);
                                                if (node) onUpdate(node.id, { color: undefined });
                                            }}
                                            className="text-[10px] text-slate-500 hover:text-blue-400 px-2"
                                            title={lang === 'es' ? 'Usar color por defecto' : 'Use default color'}
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
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
                                    nodeTypeDefinition={getNodeTypeWithProperties(nodeTypeDefinition, allNodeTypes, node?.type)}
                                    lang={lang}
                                    nodes={nodes}
                                    connections={connections}
                                    nodeOutputs={nodeOutputs}
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
                        </>
                    ) : (
                        <TestsSection 
                            node={node}
                            onUpdate={onUpdate}
                            lang={lang}
                        />
                    )}
                </div>
            </motion.div>
        </AnimatePresence >
    );
}

// Helper to keep main component clean
function SettingsResolver({ node, localConfig, setLocalConfig, onUpdate, nodeTypeDefinition, lang, nodes, connections, nodeOutputs }: any) {
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
                nodeOutputs={nodeOutputs}
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

function TestsSection({ node, onUpdate, lang }: { node: WorkflowNode; onUpdate: any; lang: string }) {
    const tests = node.tests || [];

    const handleAddTest = () => {
        const newTest: NodeTest = {
            id: `test-${Date.now()}`,
            name: lang === 'es' ? 'Nueva Prueba' : 'New Test',
            condition: 'output.status === 200',
            severity: 'error',
        };
        onUpdate(node.id, { tests: [...tests, newTest] });
    };

    const handleUpdateTest = (id: string, updates: Partial<NodeTest>) => {
        const newTests = tests.map(t => t.id === id ? { ...t, ...updates } : t);
        onUpdate(node.id, { tests: newTests });
    };

    const handleDeleteTest = (id: string) => {
        const newTests = tests.filter(t => t.id !== id);
        onUpdate(node.id, { tests: newTests });
    };

    const t = {
        en: {
            add: 'Add Test',
            noTests: 'No tests defined for this node.',
            description: 'Define conditions to automatically validate node output after execution.',
            name: 'Test Name',
            condition: 'Condition (JEXL)',
            severity: 'Severity',
            error: 'Error (Stop)',
            warning: 'Warning (Notify)',
            conditionHint: 'Example: output.success == true',
        },
        es: {
            add: 'Añadir Prueba',
            noTests: 'No hay pruebas definidas para este nodo.',
            description: 'Define condiciones para validar automáticamente la salida del nodo tras la ejecución.',
            name: 'Nombre de la Prueba',
            condition: 'Condición (JEXL)',
            severity: 'Severidad',
            error: 'Error (Detener)',
            warning: 'Aviso (Notificar)',
            conditionHint: 'Ejemplo: output.status == 200',
        }
    }[lang as 'en' | 'es'] || {
        add: 'Add Test',
        noTests: 'No tests defined',
        description: 'Define conditions',
        name: 'Name',
        condition: 'Condition',
        severity: 'Severity',
        error: 'Error',
        warning: 'Warning',
        conditionHint: 'output.x == y',
    };

    return (
        <div className="space-y-6">
            <div className="bg-orange-500/5 border border-orange-500/20 rounded p-3">
                <p className="text-[11px] text-orange-200/70 leading-relaxed italic">
                    <AlertCircle className="w-3 h-3 inline mr-1 mb-0.5" />
                    {t.description}
                </p>
            </div>

            <div className="space-y-4">
                {tests.map((test) => (
                    <div key={test.id} className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
                            <div className="flex items-center gap-2">
                                <Zap className="w-3 h-3 text-orange-400" />
                                <input
                                    type="text"
                                    value={test.name}
                                    onChange={(e) => handleUpdateTest(test.id, { name: e.target.value })}
                                    className="bg-transparent border-none text-xs font-bold text-slate-200 focus:outline-none focus:ring-0 w-32"
                                    placeholder={t.name}
                                />
                            </div>
                            <button
                                onClick={() => handleDeleteTest(test.id)}
                                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <div className="p-3 space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">{t.condition}</label>
                                <input
                                    type="text"
                                    value={test.condition}
                                    onChange={(e) => handleUpdateTest(test.id, { condition: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-blue-300 font-mono focus:outline-none focus:border-blue-500"
                                    placeholder={t.conditionHint}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">{t.severity}</label>
                                <select
                                    value={test.severity}
                                    onChange={(e) => handleUpdateTest(test.id, { severity: e.target.value as any })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none"
                                >
                                    <option value="error">{t.error}</option>
                                    <option value="warning">{t.warning}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                ))}

                {tests.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-slate-800 rounded-xl">
                        <Zap className="w-8 h-8 text-slate-700 mx-auto mb-2 opacity-20" />
                        <p className="text-xs text-slate-600 uppercase font-bold tracking-widest">{t.noTests}</p>
                    </div>
                )}

                <button
                    onClick={handleAddTest}
                    className="w-full py-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                >
                    <Plus size={16} />
                    {t.add}
                </button>
            </div>
        </div>
    );
}
