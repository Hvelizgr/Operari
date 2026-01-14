
import React from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

interface Property {
    name: string;
    displayName: string;
    type: 'string' | 'boolean' | 'options' | 'number';
    default?: any;
    description?: string;
    options?: { name: string; value: string }[];
    typeOptions?: { rows?: number; expression?: boolean };
}

interface DynamicNodeFormProps {
    properties: Property[];
    values: Record<string, any>;
    onChange: (key: string, value: any) => void;
}

export default function DynamicNodeForm({ properties, values, onChange }: DynamicNodeFormProps) {
    if (!properties || properties.length === 0) {
        return <div className="text-slate-500 text-xs italic p-4">No configurable properties for this node.</div>;
    }

    return (
        <div className="space-y-5">
            {properties.map((prop) => {
                const value = values[prop.name] !== undefined ? values[prop.name] : prop.default;

                return (
                    <div key={prop.name} className="group">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="text-xs font-semibold text-slate-300">
                                {prop.displayName}
                            </label>
                            {prop.description && (
                                <div className="text-slate-500 hover:text-slate-300 cursor-help" title={prop.description}>
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
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 hover:border-slate-600 transition-colors font-mono"
                                        rows={prop.typeOptions.rows}
                                    />
                                    {prop.typeOptions.expression && (
                                        <div className="absolute top-2 right-2 text-[10px] bg-slate-800 text-blue-400 px-1.5 py-0.5 rounded border border-slate-700">
                                            Expression
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={value || ''}
                                    onChange={(e) => onChange(prop.name, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 hover:border-slate-600 transition-colors"
                                />
                            )
                        )}

                        {prop.type === 'options' && (
                            <div className="relative">
                                <select
                                    value={value || ''}
                                    onChange={(e) => onChange(prop.name, e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 appearance-none focus:outline-none focus:border-blue-500 hover:border-slate-600 transition-colors pr-8"
                                >
                                    {prop.options?.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
                            </div>
                        )}

                        {prop.type === 'boolean' && (
                            <label className="flex items-center cursor-pointer gap-3">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={!!value}
                                        onChange={(e) => onChange(prop.name, e.target.checked)}
                                    />
                                    <div className={`w-10 h-5 rounded-full shadow-inner transition-colors ${value ? 'bg-blue-600' : 'bg-slate-700'}`}></div>
                                    <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                                <span className="text-xs text-slate-400 select-none group-hover:text-slate-300 transition-colors">
                                    {value ? 'On' : 'Off'}
                                </span>
                            </label>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
