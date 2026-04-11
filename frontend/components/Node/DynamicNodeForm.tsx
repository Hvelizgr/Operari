
import React, { useState, lazy, Suspense } from 'react';
import { HelpCircle, ChevronDown, Database } from 'lucide-react';
import { WorkflowNode, Connection } from '@nanoflow/shared';
import ExpressionBuilder from './ExpressionBuilder';
import SecretPicker from './SecretPicker';

const SQLCodeEditor = lazy(() => import('../SQLEditor/SQLCodeEditor'));

interface Property {
    name: string;
    displayName: string;
    type: 'string' | 'boolean' | 'options' | 'number' | 'secret' | 'sql';
    default?: any;
    description?: string;
    options?: { name: string; value: string }[];
    typeOptions?: { rows?: number; expression?: boolean; provider?: string };
}

interface DynamicNodeFormProps {
    properties: Property[];
    values: Record<string, any>;
    onChange: (key: string, value: any) => void;
    nodes: WorkflowNode[];
    connections: Connection[];
    lang?: 'en' | 'es'; // Make optional to avoid breaking existing calls immediately
}

export default function DynamicNodeForm({ properties, values, onChange, nodes, connections, lang = 'en' }: DynamicNodeFormProps) {
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [activeField, setActiveField] = useState<string | null>(null);

    const handleOpenBuilder = (fieldName: string) => {
        setActiveField(fieldName);
        setIsBuilderOpen(true);
    };

    const handleInsertExpression = (expression: string) => {
        if (activeField) {
            const currentValue = values[activeField] || '';
            onChange(activeField, currentValue + expression);
        }
    };

    if (!properties || properties.length === 0) {
        return <div className="text-[var(--descriptor-color)] text-xs italic p-4">No configurable properties for this node.</div>;
    }

    const inputClass = "w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors";
    const labelClass = "text-[11px] font-bold uppercase text-[var(--descriptor-color)]";

    return (
        <div className="space-y-4">
            {properties.map((prop) => {
                const value = values[prop.name] !== undefined ? values[prop.name] : prop.default;

                return (
                    <div key={prop.name} className="group">
                        <div className="flex items-center gap-2 mb-1">
                            <label className={labelClass}>
                                {prop.displayName}
                            </label>
                            {prop.description && (
                                <div className="text-[var(--descriptor-color)] opacity-70 hover:opacity-100 cursor-help" title={prop.description}>
                                    <HelpCircle size={12} />
                                </div>
                            )}
                        </div>

                        {/* RENDER INPUT BASED ON TYPE */}
                        {prop.type === 'string' && (
                            prop.typeOptions?.rows ? (
                                <div className="relative">
                                    <textarea
                                        value={value || ''}
                                        onChange={(e) => onChange(prop.name, e.target.value)}
                                        className={`${inputClass} font-mono`}
                                        rows={prop.typeOptions.rows}
                                    />
                                    {prop.typeOptions.expression && (
                                        <div
                                            className="absolute top-2 right-2 text-[var(--icon-color)] opacity-50 hover:opacity-100 cursor-pointer p-1 rounded hover:bg-white/10 transition-all"
                                            title="Open Expression Builder"
                                            onClick={() => handleOpenBuilder(prop.name)}
                                        >
                                            <Database size={14} />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={value || ''}
                                        onChange={(e) => onChange(prop.name, e.target.value)}
                                        className={`${inputClass} ${prop.typeOptions?.expression ? 'pr-8' : ''}`}
                                    />
                                    {prop.typeOptions?.expression && (
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 right-2 text-[var(--icon-color)] opacity-50 hover:opacity-100 cursor-pointer p-1 rounded hover:bg-white/10 transition-all"
                                            title="Open Expression Builder"
                                            onClick={() => handleOpenBuilder(prop.name)}
                                        >
                                            <Database size={14} />
                                        </div>
                                    )}
                                </div>
                            )
                        )}

                        {prop.type === 'secret' && (
                            <SecretPicker
                                lang={lang}
                                value={value || ''}
                                onChange={(next) => onChange(prop.name, next)}
                                provider={prop.typeOptions?.provider}
                                label={prop.displayName}
                            />
                        )}

                        {prop.type === 'sql' && (
                            <Suspense fallback={
                                <textarea
                                    value={value || ''}
                                    onChange={(e) => onChange(prop.name, e.target.value)}
                                    className={`${inputClass} font-mono`}
                                    rows={prop.typeOptions?.rows ?? 4}
                                    placeholder="SELECT ..."
                                />
                            }>
                                <SQLCodeEditor
                                    value={value || ''}
                                    onChange={(v) => onChange(prop.name, v)}
                                    minHeight={`${(prop.typeOptions?.rows ?? 4) * 24}px`}
                                    placeholder="SELECT * FROM ..."
                                />
                            </Suspense>
                        )}

                        {prop.type === 'number' && (
                            <input
                                type="number"
                                value={value}
                                onChange={(e) => onChange(prop.name, Number(e.target.value))}
                                className={inputClass}
                            />
                        )}

                        {prop.type === 'options' && (
                            <div className="relative">
                                <select
                                    value={value || ''}
                                    onChange={(e) => onChange(prop.name, e.target.value)}
                                    className={`${inputClass} appearance-none pr-8`}
                                >
                                    {prop.options?.map((opt) => (
                                        <option key={opt.value} value={opt.value} className="bg-[var(--box-background-color)] text-[var(--body-text-color)]">
                                            {opt.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--icon-color)] pointer-events-none" size={14} />
                            </div>
                        )}

                        {prop.type === 'boolean' && (
                            <label className="flex items-center cursor-pointer gap-3 pt-1">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={!!value}
                                        onChange={(e) => onChange(prop.name, e.target.checked)}
                                    />
                                    <div className={`w-9 h-5 rounded-full shadow-inner transition-colors ${value ? 'bg-[var(--theme-color)]' : 'bg-[rgba(0,0,0,0.3)]'}`}></div>
                                    <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </div>
                                <span className="text-xs text-[var(--body-text-color)] select-none">
                                    {value ? 'Active' : 'Inactive'}
                                </span>
                            </label>
                        )}
                    </div>
                );
            })}

            <ExpressionBuilder
                isOpen={isBuilderOpen}
                onClose={() => setIsBuilderOpen(false)}
                nodes={nodes}
                connections={connections}
                onInsert={handleInsertExpression}
                lang={lang}
            />
        </div>
    );
}
