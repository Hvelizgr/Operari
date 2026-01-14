'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { WorkflowNode } from './EditorNode';
import { NODE_TYPES, NodeType } from './NodePalette';
import DynamicNodeForm from './DynamicNodeForm';

interface NodeConfigPanelProps {
    node: WorkflowNode | null;
    nodeTypeDefinition?: NodeType;
    onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => void;
    onClose: () => void;
    lang: 'en' | 'es';
}

export default function NodeConfigPanel({ node, nodeTypeDefinition, onUpdate, onClose, lang }: NodeConfigPanelProps) {
    const [localTitle, setLocalTitle] = useState('');
    const [localConfig, setLocalConfig] = useState<Record<string, any>>({});

    // Get node type info for description
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
            title: 'Node Configuration',
            nodeName: 'Node Name',
            nodeType: 'Node Type',
            settings: 'Settings',
            url: 'URL',
            urlDesc: 'The endpoint URL where the request will be sent',
            method: 'HTTP Method',
            methodDesc: 'The HTTP method to use (GET, POST, etc.)',
            headers: 'Headers',
            body: 'Body',
            emailTo: 'To',
            emailToDesc: 'Recipient email address',
            emailSubject: 'Subject',
            subjectDesc: 'Subject line of the email',
            emailBody: 'Message',
            bodyDesc: 'Content of the email message',
            condition: 'Condition',
            conditionDesc: 'Expression that evaluates to true or false',
            query: 'SQL Query',
            queryDesc: 'SQL query to execute against the database',
            database: 'Database',
            transformation: 'Transformation',
            transformDesc: 'JavaScript code to transform the input data',
            workflowId: 'Workflow ID',
            waitForCompletion: 'Wait for completion',
            timeout: 'Timeout (ms)',
            close: 'Close',
            genericParams: 'Parameters (JSON)',
            genericParamsDesc: 'Raw configuration for this node type',
        },
        es: {
            title: 'Configuración de Nodo',
            nodeName: 'Nombre del Nodo',
            nodeType: 'Tipo de Nodo',
            settings: 'Configuración',
            url: 'URL',
            urlDesc: 'La URL del endpoint donde se enviará la petición',
            method: 'Método HTTP',
            methodDesc: 'El método HTTP a utilizar (GET, POST, etc.)',
            headers: 'Encabezados',
            body: 'Cuerpo',
            emailTo: 'Para',
            emailToDesc: 'Dirección de correo del destinatario',
            emailSubject: 'Asunto',
            subjectDesc: 'Asunto del correo electrónico',
            emailBody: 'Mensaje',
            bodyDesc: 'Contenido del mensaje de correo',
            condition: 'Condición',
            conditionDesc: 'Expresión que evalúa a verdadero o falso',
            query: 'Consulta SQL',
            queryDesc: 'Consulta SQL para ejecutar en la base de datos',
            database: 'Base de Datos',
            transformation: 'Transformación',
            transformDesc: 'Código JavaScript para transformar los datos de entrada',
            workflowId: 'ID del Workflow',
            waitForCompletion: 'Esperar finalización',
            timeout: 'Tiempo de espera (ms)',
            close: 'Cerrar',
            genericParams: 'Parámetros (JSON)',
            genericParamsDesc: 'Configuración del nodo en formato JSON',
        },
    };

    const text = content[lang] || content['en'];

    const handleTitleChange = (newTitle: string) => {
        setLocalTitle(newTitle);
        if (node) {
            onUpdate(node.id, { title: newTitle });
        }
    };

    const handleConfigChange = (key: string, value: any) => {
        const newConfig = { ...localConfig, [key]: value };
        setLocalConfig(newConfig);
        if (node) {
            onUpdate(node.id, { config: newConfig });
        }
    };

    // Helper component for fields with description
    const ConfigField = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
        <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">{label}</label>
            {children}
            {description && <p className="text-[11px] text-slate-500 leading-tight">{description}</p>}
        </div>
    );

    const renderTypeSpecificSettings = () => {
        if (!node) return null;

        // 1. Dynamic Form (DB Driven) - HIGHEST PRIORITY
        if (nodeTypeDefinition?.properties && nodeTypeDefinition.properties.length > 0) {
            return (
                <DynamicNodeForm
                    properties={nodeTypeDefinition.properties}
                    values={localConfig}
                    onChange={(key, val) => {
                        const newConfig = { ...localConfig, [key]: val };
                        setLocalConfig(newConfig);
                        if (node) onUpdate(node.id, { config: newConfig });
                    }}
                />
            );
        }

        if (node?.type === 'n8n-nodes-base.httpRequest') {
            return (
                <div className="space-y-5">
                    <ConfigField label={text.url} description={text.urlDesc}>
                        <input
                            type="text"
                            value={localConfig.url || ''}
                            onChange={(e) => handleConfigChange('url', e.target.value)}
                            placeholder="https://api.example.com"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                    </ConfigField>
                    <ConfigField label="Method" description="HTTP Method">
                        <select
                            value={localConfig.method || 'GET'}
                            onChange={(e) => handleConfigChange('method', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        >
                            <option>GET</option>
                            <option>POST</option>
                            <option>PUT</option>
                            <option>DELETE</option>
                        </select>
                    </ConfigField>
                </div>
            );
        }

        // Simplify matching for n8n standard nodes (e.g. 'n8n-nodes-base.webhook' -> 'Webhook')
        const typeStart = node.type.split('.').pop() || node.type;
        const normalizedType = typeStart.charAt(0).toUpperCase() + typeStart.slice(1).toLowerCase();

        // Check explicit types or fallback
        if (node.type.includes('Webhook') || normalizedType === 'Webhook') {
            return (
                <div className="space-y-5">
                    <ConfigField label={text.url} description={text.urlDesc}>
                        <input
                            type="text"
                            value={localConfig.url || ''}
                            onChange={(e) => handleConfigChange('url', e.target.value)}
                            placeholder="https://api.example.com/webhook"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                        />
                    </ConfigField>
                    <ConfigField label={text.method} description={text.methodDesc}>
                        <select
                            value={localConfig.method || 'POST'}
                            onChange={(e) => handleConfigChange('method', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-all"
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </ConfigField>
                </div>
            );
        }

        if (node.type.includes('Email') || normalizedType === 'Email') {
            return (
                <div className="space-y-5">
                    <ConfigField label={text.emailTo} description={text.emailToDesc}>
                        <input
                            type="email"
                            value={localConfig.emailTo || ''}
                            onChange={(e) => handleConfigChange('emailTo', e.target.value)}
                            placeholder="user@example.com"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                    </ConfigField>
                    <ConfigField label={text.emailSubject} description={text.subjectDesc}>
                        <input
                            type="text"
                            value={localConfig.emailSubject || ''}
                            onChange={(e) => handleConfigChange('emailSubject', e.target.value)}
                            placeholder="Subject..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                    </ConfigField>
                    <ConfigField label={text.emailBody} description={text.bodyDesc}>
                        <textarea
                            value={localConfig.emailBody || ''}
                            onChange={(e) => handleConfigChange('emailBody', e.target.value)}
                            placeholder="Message..."
                            rows={4}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 resize-none focus:outline-none focus:border-blue-500"
                        />
                    </ConfigField>
                </div>
            );
        }

        if (node.type.includes('Transform') || normalizedType === 'Transform' || node.type.includes('Code') || node.type.includes('Function')) {
            return (
                <div className="space-y-5">
                    <ConfigField label={text.transformation} description={text.transformDesc}>
                        <textarea
                            value={localConfig.transformation || ''}
                            onChange={(e) => handleConfigChange('transformation', e.target.value)}
                            placeholder="// JavaScript code..."
                            rows={10}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 resize-none focus:outline-none focus:border-blue-500"
                        />
                    </ConfigField>
                </div>
            );
        }

        // Default Generic Handler (JSON)
        return (
            <div className="space-y-5">
                <ConfigField label={text.genericParams} description={text.genericParamsDesc}>
                    <textarea
                        value={JSON.stringify(localConfig, null, 2)}
                        onChange={(e) => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                setLocalConfig(parsed);
                                if (node) onUpdate(node.id, { config: parsed });
                            } catch (err) {
                                // Allow typing invalid JSON temporarily
                            }
                        }}
                        rows={12}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 resize-y focus:outline-none focus:border-blue-500"
                    />
                </ConfigField>
            </div>
        );
    };

    if (!node) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="absolute right-0 top-0 h-full w-96 bg-slate-800 border-l border-slate-700 shadow-2xl z-40 overflow-y-auto"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                /* Stop propagation to prevent canvas interaction/zoom while using panel */
                onWheel={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        <Settings size={18} className="text-blue-500" />
                        <h2 className="text-lg font-semibold text-slate-100">{text.title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 space-y-6">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2">{text.nodeName}</label>
                        <input
                            type="text"
                            value={localTitle}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2">{text.nodeType}</label>
                        <div className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400 select-all">
                            {node.type}
                        </div>
                        {nodeDescription && (
                            <p className="mt-2 text-xs text-slate-500 italic">
                                {nodeDescription}
                            </p>
                        )}
                    </div>

                    <div className="pt-2 border-t border-slate-700/50">
                        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                            {text.settings}
                        </h3>
                        {renderTypeSpecificSettings()}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
