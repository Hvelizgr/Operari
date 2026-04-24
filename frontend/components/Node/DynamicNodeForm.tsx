import { Connection, WorkflowNode } from '@cairn/shared';
import { ChevronDown, Database, HelpCircle } from 'lucide-react';
import React, { lazy, Suspense, useState } from 'react';

import ExpressionBuilder from './ExpressionBuilder';
import SecretPicker from './SecretPicker';

const SQLCodeEditor = lazy(() => import('../SQLEditor/SQLCodeEditor'));

export interface Property {
  name: string;
  displayName: string;
  type: 'string' | 'boolean' | 'options' | 'number' | 'secret' | 'sql' | 'color';
  default?: unknown;
  description?: string;
  options?: { name: string; value: string }[];
  typeOptions?: { rows?: number; expression?: boolean; provider?: string };
}

interface DynamicNodeFormProps {
  properties: Property[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  nodes: WorkflowNode[];
  connections: Connection[];
  lang?: 'en' | 'es'; // Make optional to avoid breaking existing calls immediately
}

export default function DynamicNodeForm({
  properties,
  values,
  onChange,
  nodes,
  connections,
  lang = 'en',
}: DynamicNodeFormProps) {
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
    return (
      <div className="p-4 text-xs italic text-[var(--descriptor-color)]">
        No configurable properties for this node.
      </div>
    );
  }

  const inputClass =
    'w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors';
  const labelClass = 'text-[11px] font-bold uppercase text-[var(--descriptor-color)]';

  return (
    <div className="space-y-4">
      {properties.map(prop => {
        const rawValue = values[prop.name] !== undefined ? values[prop.name] : prop.default;
        const stringValue = typeof rawValue === 'string' ? rawValue : '';
        const numberValue = typeof rawValue === 'number' ? rawValue : Number(stringValue) || 0;
        const booleanValue = typeof rawValue === 'boolean' ? rawValue : false;

        return (
          <div key={prop.name} className="group">
            <div className="mb-1 flex items-center gap-2">
              <label className={labelClass}>{prop.displayName}</label>
              {prop.description && (
                <div
                  className="cursor-help text-[var(--descriptor-color)] opacity-70 hover:opacity-100"
                  title={prop.description}
                >
                  <HelpCircle size={12} />
                </div>
              )}
            </div>

            {/* RENDER INPUT BASED ON TYPE */}
            {prop.type === 'string' &&
              (prop.typeOptions?.rows ? (
                <div className="relative">
                  <textarea
                    value={stringValue}
                    onChange={e => onChange(prop.name, e.target.value)}
                    className={`${inputClass} font-mono`}
                    rows={prop.typeOptions.rows}
                  />
                  {prop.typeOptions.expression && (
                    <div
                      className="absolute right-2 top-2 cursor-pointer rounded p-1 text-[var(--icon-color)] opacity-50 transition-all hover:bg-white/10 hover:opacity-100"
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
                    value={stringValue}
                    onChange={e => onChange(prop.name, e.target.value)}
                    className={`${inputClass} ${prop.typeOptions?.expression ? 'pr-8' : ''}`}
                  />
                  {prop.typeOptions?.expression && (
                    <div
                      className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-[var(--icon-color)] opacity-50 transition-all hover:bg-white/10 hover:opacity-100"
                      title="Open Expression Builder"
                      onClick={() => handleOpenBuilder(prop.name)}
                    >
                      <Database size={14} />
                    </div>
                  )}
                </div>
              ))}

            {prop.type === 'secret' && (
              <SecretPicker
                lang={lang}
                value={stringValue}
                onChange={next => onChange(prop.name, next)}
                provider={prop.typeOptions?.provider}
                label={prop.displayName}
              />
            )}

            {prop.type === 'sql' && (
              <Suspense
                fallback={
                  <textarea
                    value={stringValue}
                    onChange={e => onChange(prop.name, e.target.value)}
                    className={`${inputClass} font-mono`}
                    rows={prop.typeOptions?.rows ?? 4}
                    placeholder="SELECT ..."
                  />
                }
              >
                <SQLCodeEditor
                  value={stringValue}
                  onChange={v => onChange(prop.name, v)}
                  minHeight={`${(prop.typeOptions?.rows ?? 4) * 24}px`}
                  placeholder="SELECT * FROM ..."
                />
              </Suspense>
            )}

            {prop.type === 'number' && (
              <input
                type="number"
                value={numberValue}
                onChange={e => onChange(prop.name, Number(e.target.value))}
                className={inputClass}
              />
            )}

            {prop.type === 'options' && (
              <div className="relative">
                <select
                  value={stringValue}
                  onChange={e => onChange(prop.name, e.target.value)}
                  className={`${inputClass} appearance-none pr-8`}
                >
                  {prop.options?.map(opt => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      className="bg-[var(--box-background-color)] text-[var(--body-text-color)]"
                    >
                      {opt.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--icon-color)]"
                  size={14}
                />
              </div>
            )}

            {prop.type === 'boolean' && (
              <label className="flex cursor-pointer items-center gap-3 pt-1">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={booleanValue}
                    onChange={e => onChange(prop.name, e.target.checked)}
                  />
                  <div
                    className={`h-5 w-9 rounded-full shadow-inner transition-colors ${booleanValue ? 'bg-[var(--theme-color)]' : 'bg-[rgba(0,0,0,0.3)]'}`}
                  ></div>
                  <div
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${booleanValue ? 'translate-x-4' : 'translate-x-0'}`}
                  ></div>
                </div>
                <span className="select-none text-xs text-[var(--body-text-color)]">
                  {booleanValue ? 'Active' : 'Inactive'}
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
