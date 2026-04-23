'use client';

import { ChevronDown, ChevronUp, Clock, Filter, Hash, Shield, Zap } from 'lucide-react';
import { useState } from 'react';

export interface TriggerModifiers {
  // Rate Limiting
  rateLimitEnabled: boolean;
  rateLimitMax: number;
  rateLimitWindow: number; // in seconds
  rateLimitWindowUnit: 'seconds' | 'minutes' | 'hours';

  // Filtering
  filterEnabled: boolean;
  filterExpression: string;

  // Debouncing
  debounceEnabled: boolean;
  debounceDelay: number; // in milliseconds

  // Deduplication
  dedupeEnabled: boolean;
  dedupeKey: string; // Expression to calculate unique key
  dedupeTTL: number; // Time to live in seconds
}

export const DEFAULT_TRIGGER_MODIFIERS: TriggerModifiers = {
  rateLimitEnabled: false,
  rateLimitMax: 100,
  rateLimitWindow: 1,
  rateLimitWindowUnit: 'minutes',
  filterEnabled: false,
  filterExpression: '',
  debounceEnabled: false,
  debounceDelay: 500,
  dedupeEnabled: false,
  dedupeKey: '',
  dedupeTTL: 60,
};

interface TriggerModifiersSectionProps {
  modifiers: TriggerModifiers;
  onChange: (modifiers: TriggerModifiers) => void;
  lang: 'en' | 'es';
}

export default function TriggerModifiersSection({
  modifiers,
  onChange,
  lang,
}: TriggerModifiersSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (key: keyof TriggerModifiers, value: any) => {
    onChange({ ...modifiers, [key]: value });
  };

  const content = {
    en: {
      title: 'Trigger Modifiers',
      description: 'Control how triggers are processed',

      // Rate Limiting
      rateLimitTitle: 'Rate Limiting',
      rateLimitDescription: 'Limit execution frequency',
      rateLimitMax: 'Max Executions',
      rateLimitWindow: 'Time Window',
      rateLimitWindowUnit: 'Unit',

      // Filtering
      filterTitle: 'Filtering',
      filterDescription: 'Filter incoming triggers',
      filterExpression: 'Filter Expression',
      filterExpressionPlaceholder: '{{ $input.body.type === "important" }}',
      filterExpressionHelp: 'Expression must return true to accept trigger',

      // Debouncing
      debounceTitle: 'Debouncing',
      debounceDescription: 'Delay execution after last trigger',
      debounceDelay: 'Delay (ms)',

      // Deduplication
      dedupeTitle: 'Deduplication',
      dedupeDescription: 'Prevent duplicate triggers',
      dedupeKey: 'Unique Key Expression',
      dedupeKeyPlaceholder: '{{ $input.body.id }}',
      dedupeTTL: 'TTL (seconds)',
      dedupeTTLHelp: 'Time before allowing same key again',

      // Units
      seconds: 'Seconds',
      minutes: 'Minutes',
      hours: 'Hours',
    },
    es: {
      title: 'Modificadores de Trigger',
      description: 'Controla cómo se procesan los triggers',

      // Rate Limiting
      rateLimitTitle: 'Límite de Tasa',
      rateLimitDescription: 'Limitar frecuencia de ejecución',
      rateLimitMax: 'Máx. Ejecuciones',
      rateLimitWindow: 'Ventana de Tiempo',
      rateLimitWindowUnit: 'Unidad',

      // Filtering
      filterTitle: 'Filtrado',
      filterDescription: 'Filtrar triggers entrantes',
      filterExpression: 'Expresión de Filtro',
      filterExpressionPlaceholder: '{{ $input.body.type === "importante" }}',
      filterExpressionHelp: 'La expresión debe retornar true para aceptar',

      // Debouncing
      debounceTitle: 'Antirrebote',
      debounceDescription: 'Retrasar ejecución después del último trigger',
      debounceDelay: 'Retraso (ms)',

      // Deduplication
      dedupeTitle: 'Deduplicación',
      dedupeDescription: 'Prevenir triggers duplicados',
      dedupeKey: 'Expresión de Clave Única',
      dedupeKeyPlaceholder: '{{ $input.body.id }}',
      dedupeTTL: 'TTL (segundos)',
      dedupeTTLHelp: 'Tiempo antes de permitir la misma clave',

      // Units
      seconds: 'Segundos',
      minutes: 'Minutos',
      hours: 'Horas',
    },
  };

  const text = content[lang] || content['en'];

  const inputClass =
    'w-full bg-[rgba(0,0,0,0.2)] border border-[var(--border-color)] rounded p-2 text-sm text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors';
  const labelClass = 'text-[10px] font-bold uppercase text-slate-500 mb-1';

  const hasActiveModifiers =
    modifiers.rateLimitEnabled ||
    modifiers.filterEnabled ||
    modifiers.debounceEnabled ||
    modifiers.dedupeEnabled;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800/30">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-3 transition-colors hover:bg-slate-700/30"
      >
        <div className="flex items-center gap-2">
          <Shield size={14} className={hasActiveModifiers ? 'text-primary/70' : 'text-slate-500'} />
          <span className="text-sm font-medium text-slate-200">{text.title}</span>
          {hasActiveModifiers && (
            <span className="bg-primary/20 text-primary/70 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              Active
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={14} className="text-slate-400" />
        ) : (
          <ChevronDown size={14} className="text-slate-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="space-y-4 border-t border-slate-700 p-3 pt-0">
          <p className="mt-3 text-[10px] text-slate-500">{text.description}</p>

          {/* Rate Limiting */}
          <ModifierSection
            icon={<Zap size={12} />}
            title={text.rateLimitTitle}
            description={text.rateLimitDescription}
            enabled={modifiers.rateLimitEnabled}
            onToggle={enabled => handleChange('rateLimitEnabled', enabled)}
          >
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelClass}>{text.rateLimitMax}</label>
                <input
                  type="number"
                  value={modifiers.rateLimitMax}
                  onChange={e => handleChange('rateLimitMax', parseInt(e.target.value) || 1)}
                  className={`${inputClass} font-mono`}
                  min={1}
                />
              </div>
              <div>
                <label className={labelClass}>{text.rateLimitWindow}</label>
                <input
                  type="number"
                  value={modifiers.rateLimitWindow}
                  onChange={e => handleChange('rateLimitWindow', parseInt(e.target.value) || 1)}
                  className={`${inputClass} font-mono`}
                  min={1}
                />
              </div>
              <div>
                <label className={labelClass}>{text.rateLimitWindowUnit}</label>
                <select
                  value={modifiers.rateLimitWindowUnit}
                  onChange={e => handleChange('rateLimitWindowUnit', e.target.value)}
                  className={inputClass}
                >
                  <option value="seconds">{text.seconds}</option>
                  <option value="minutes">{text.minutes}</option>
                  <option value="hours">{text.hours}</option>
                </select>
              </div>
            </div>
          </ModifierSection>

          {/* Filtering */}
          <ModifierSection
            icon={<Filter size={12} />}
            title={text.filterTitle}
            description={text.filterDescription}
            enabled={modifiers.filterEnabled}
            onToggle={enabled => handleChange('filterEnabled', enabled)}
          >
            <div>
              <label className={labelClass}>{text.filterExpression}</label>
              <textarea
                value={modifiers.filterExpression}
                onChange={e => handleChange('filterExpression', e.target.value)}
                placeholder={text.filterExpressionPlaceholder}
                className={`${inputClass} font-mono`}
                rows={2}
              />
              <p className="mt-1 text-[9px] text-slate-500">{text.filterExpressionHelp}</p>
            </div>
          </ModifierSection>

          {/* Debouncing */}
          <ModifierSection
            icon={<Clock size={12} />}
            title={text.debounceTitle}
            description={text.debounceDescription}
            enabled={modifiers.debounceEnabled}
            onToggle={enabled => handleChange('debounceEnabled', enabled)}
          >
            <div>
              <label className={labelClass}>{text.debounceDelay}</label>
              <input
                type="number"
                value={modifiers.debounceDelay}
                onChange={e => handleChange('debounceDelay', parseInt(e.target.value) || 100)}
                className={`${inputClass} font-mono`}
                min={100}
                step={100}
              />
            </div>
          </ModifierSection>

          {/* Deduplication */}
          <ModifierSection
            icon={<Hash size={12} />}
            title={text.dedupeTitle}
            description={text.dedupeDescription}
            enabled={modifiers.dedupeEnabled}
            onToggle={enabled => handleChange('dedupeEnabled', enabled)}
          >
            <div className="space-y-3">
              <div>
                <label className={labelClass}>{text.dedupeKey}</label>
                <input
                  type="text"
                  value={modifiers.dedupeKey}
                  onChange={e => handleChange('dedupeKey', e.target.value)}
                  placeholder={text.dedupeKeyPlaceholder}
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className={labelClass}>{text.dedupeTTL}</label>
                <input
                  type="number"
                  value={modifiers.dedupeTTL}
                  onChange={e => handleChange('dedupeTTL', parseInt(e.target.value) || 60)}
                  className={`${inputClass} font-mono`}
                  min={1}
                />
                <p className="mt-1 text-[9px] text-slate-500">{text.dedupeTTLHelp}</p>
              </div>
            </div>
          </ModifierSection>
        </div>
      )}
    </div>
  );
}

// Helper component for each modifier section
function ModifierSection({
  icon,
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border transition-colors ${
        enabled ? 'border-primary/30 bg-primary/5' : 'border-slate-700 bg-slate-800/20'
      }`}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2">
          <span className={enabled ? 'text-primary/70' : 'text-slate-500'}>{icon}</span>
          <div>
            <div className="text-xs font-medium text-slate-300">{title}</div>
            <div className="text-[9px] text-slate-500">{description}</div>
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={enabled}
            onChange={e => onToggle(e.target.checked)}
          />
          <div className="peer-checked:bg-primary peer h-4 w-8 rounded-full bg-slate-700 after:absolute after:left-[2px] after:top-[2px] after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
        </label>
      </div>

      {/* Section Content */}
      {enabled && <div className="border-t border-slate-700/50 px-2 pb-2 pt-1">{children}</div>}
    </div>
  );
}
