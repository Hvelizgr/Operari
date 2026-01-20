
import React, { useState, useMemo } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, Database, Settings2 } from 'lucide-react';
import { WorkflowNode, Connection } from '@nanoflow/shared';
import ExpressionBuilder from './ExpressionBuilder';

interface DisplayOptions {
    show?: Record<string, string[]>;
    hide?: Record<string, string[]>;
}

interface Property {
    name: string;
    displayName: string;
    type: 'string' | 'boolean' | 'options' | 'number' | 'collection' | 'fixedCollection' | 'json';
    default?: any;
    description?: string;
    required?: boolean;
    options?: { name: string; value: string; description?: string }[];
    typeOptions?: { rows?: number; expression?: boolean };
    displayOptions?: DisplayOptions;
}

function shouldShowProperty(prop: Property, values: Record<string, any>): boolean {
    if (!prop.displayOptions) return true;
    const { show, hide } = prop.displayOptions;
    if (show) {
        for (const [fieldName, allowedValues] of Object.entries(show)) {
            const currentValue = values[fieldName];
            if (!allowedValues.includes(currentValue)) return false;
        }
    }
    if (hide) {
        for (const [fieldName, hideValues] of Object.entries(hide)) {
            const currentValue = values[fieldName];
            if (hideValues.includes(currentValue)) return false;
        }
    }
    return true;
}

function isPrimaryProperty(prop: Property): boolean {
    if (prop.required) return true;
    const primaryNames = ['method', 'url', 'operation', 'resource', 'model', 'prompt', 'query', 'text', 'message', 'content', 'name', 'authentication'];
    return primaryNames.includes(prop.name.toLowerCase());
}

interface DynamicNodeFormProps {
    properties: Property[];
    values: Record<string, any>;
    onChange: (key: string, value: any) => void;
    nodes: WorkflowNode[];
    connections: Connection[];
    lang?: 'en' | 'es';
    nodeOutputs?: Record<string, any>;
}

function PropertyInput({ 
    prop, 
    value, 
    onChange, 
    onOpenBuilder,
    inputClass,
    labelClass 
}: { 
    prop: Property; 
    value: any; 
    onChange: (key: string, value: any) => void;
    onOpenBuilder: (field: string) => void;
    inputClass: string;
    labelClass: string;
}) {
    return (
        <div className="group">
            <div className="flex items-center gap-2 mb-1">
                <label className={labelClass}>
                    {prop.displayName}
                    {prop.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {prop.description && (
                    <div className="text-[var(--descriptor-color)] opacity-70 hover:opacity-100 cursor-help" title={prop.description}>
                        <HelpCircle size={12} />
                    </div>
                )}
            </div>

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
                                onClick={() => onOpenBuilder(prop.name)}
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
                                onClick={() => onOpenBuilder(prop.name)}
                            >
                                <Database size={14} />
                            </div>
                        )}
                    </div>
                )
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
}

export default function DynamicNodeForm({ properties, values, onChange, nodes, connections, lang = 'en', nodeOutputs }: DynamicNodeFormProps) {
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [activeField, setActiveField] = useState<string | null>(null);
    const [optionsExpanded, setOptionsExpanded] = useState(false);

    const effectiveValues = useMemo(() => {
        const result: Record<string, any> = { ...values };
        for (const prop of properties) {
            if (result[prop.name] === undefined && prop.default !== undefined) {
                result[prop.name] = prop.default;
            }
        }
        return result;
    }, [properties, values]);

    const visibleProperties = useMemo(() => {
        return properties.filter(prop => shouldShowProperty(prop, effectiveValues));
    }, [properties, effectiveValues]);

    const { primaryProps, optionalProps } = useMemo(() => {
        const primary: Property[] = [];
        const optional: Property[] = [];
        for (const prop of visibleProperties) {
            if (isPrimaryProperty(prop)) {
                primary.push(prop);
            } else {
                optional.push(prop);
            }
        }
        return { primaryProps: primary, optionalProps: optional };
    }, [visibleProperties]);

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
            {primaryProps.map((prop) => (
                <PropertyInput
                    key={prop.name}
                    prop={prop}
                    value={effectiveValues[prop.name]}
                    onChange={onChange}
                    onOpenBuilder={handleOpenBuilder}
                    inputClass={inputClass}
                    labelClass={labelClass}
                />
            ))}

            {optionalProps.length > 0 && (
                <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setOptionsExpanded(!optionsExpanded)}
                        className="w-full flex items-center justify-between p-3 bg-[rgba(0,0,0,0.15)] hover:bg-[rgba(0,0,0,0.25)] transition-colors text-left"
                    >
                        <div className="flex items-center gap-2">
                            <Settings2 size={14} className="text-[var(--icon-color)]" />
                            <span className="text-xs font-semibold text-[var(--descriptor-color)] uppercase">
                                Options
                            </span>
                            <span className="text-[10px] text-[var(--descriptor-color)] opacity-60">
                                ({optionalProps.length} {optionalProps.length === 1 ? 'field' : 'fields'})
                            </span>
                        </div>
                        {optionsExpanded ? (
                            <ChevronDown size={14} className="text-[var(--icon-color)]" />
                        ) : (
                            <ChevronRight size={14} className="text-[var(--icon-color)]" />
                        )}
                    </button>
                    
                    {optionsExpanded && (
                        <div className="p-3 space-y-4 bg-[rgba(0,0,0,0.05)]">
                            {optionalProps.map((prop) => (
                                <PropertyInput
                                    key={prop.name}
                                    prop={prop}
                                    value={effectiveValues[prop.name]}
                                    onChange={onChange}
                                    onOpenBuilder={handleOpenBuilder}
                                    inputClass={inputClass}
                                    labelClass={labelClass}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            <ExpressionBuilder
                isOpen={isBuilderOpen}
                onClose={() => setIsBuilderOpen(false)}
                nodes={nodes}
                connections={connections}
                onInsert={handleInsertExpression}
                lang={lang}
                nodeOutputs={nodeOutputs}
            />
        </div>
    );
}
