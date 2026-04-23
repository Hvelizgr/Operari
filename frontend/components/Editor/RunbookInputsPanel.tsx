'use client';

import { useCallback } from 'react';
import { Plus, Trash2, GripVertical, Terminal } from 'lucide-react';

export type RunbookInputType = 'text' | 'number' | 'boolean' | 'select';

export interface RunbookInputDefinition {
  name: string;
  type: RunbookInputType;
  label?: string;
  description?: string;
  required?: boolean;
  default?: string | number | boolean;
  options?: string[];
}

interface RunbookInputsPanelProps {
  lang: 'en' | 'es';
  inputs: RunbookInputDefinition[];
  onChange: (inputs: RunbookInputDefinition[]) => void;
}

const STRINGS = {
  en: {
    heading: 'Inputs',
    subheading:
      'Declare typed inputs the user fills in before each run. Values land in {{vars.*}} and the Run dialog renders a form.',
    empty: 'No inputs declared — the Run dialog will show the raw JSON textarea.',
    add: 'Add input',
    name: 'Variable name',
    namePlaceholder: 'env',
    nameHint: 'Used in templates as {{vars.name}}',
    label: 'Label',
    labelPlaceholder: 'Environment',
    type: 'Type',
    types: {
      text: 'Text',
      number: 'Number',
      boolean: 'Boolean',
      select: 'Dropdown (select)',
    },
    required: 'Required',
    description: 'Help text',
    descriptionPlaceholder: 'Shown under the field in the Run dialog',
    default: 'Default value',
    options: 'Options (one per line)',
    optionsPlaceholder: 'prod\nstaging\ndev',
    delete: 'Delete input',
    nameInvalid:
      'Name must start with a letter or underscore and contain only letters, numbers, or underscores.',
  },
  es: {
    heading: 'Inputs',
    subheading:
      'Declará inputs tipados que el usuario completa antes de cada run. Los valores van a {{vars.*}} y el Run dialog muestra un form.',
    empty: 'Sin inputs declarados — el Run dialog mostrará el textarea JSON.',
    add: 'Agregar input',
    name: 'Nombre de variable',
    namePlaceholder: 'env',
    nameHint: 'Se usa en templates como {{vars.name}}',
    label: 'Etiqueta',
    labelPlaceholder: 'Entorno',
    type: 'Tipo',
    types: {
      text: 'Texto',
      number: 'Número',
      boolean: 'Booleano',
      select: 'Desplegable (select)',
    },
    required: 'Requerido',
    description: 'Ayuda',
    descriptionPlaceholder: 'Se muestra debajo del campo en el Run dialog',
    default: 'Valor por defecto',
    options: 'Opciones (una por línea)',
    optionsPlaceholder: 'prod\nstaging\ndev',
    delete: 'Eliminar input',
    nameInvalid:
      'El nombre debe empezar con letra o guión bajo y contener solo letras, números o guiones bajos.',
  },
} as const;

const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function coerceDefault(
  type: RunbookInputType,
  raw: string | undefined
): string | number | boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (type === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  if (type === 'boolean') {
    return raw === 'true';
  }
  return raw;
}

/**
 * Typed input declarations (Rundeck-style job options) for a runbook.
 *
 * The declarations are owned by the parent via `inputs` + `onChange` so
 * the parent can debounce a write to `PUT /api/runbooks/:id/inputs`
 * without this panel knowing about persistence.
 */
export default function RunbookInputsPanel({ lang, inputs, onChange }: RunbookInputsPanelProps) {
  const t = STRINGS[lang];

  const updateAt = useCallback(
    (idx: number, patch: Partial<RunbookInputDefinition>) => {
      const next = inputs.map((i, n) => (n === idx ? { ...i, ...patch } : i));
      onChange(next);
    },
    [inputs, onChange]
  );

  const addInput = () => {
    const next: RunbookInputDefinition = {
      name: uniqueName(inputs),
      type: 'text',
      required: false,
    };
    onChange([...inputs, next]);
  };

  const removeAt = (idx: number) => {
    onChange(inputs.filter((_, n) => n !== idx));
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <Terminal size={12} />
          {t.heading}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t.subheading}</p>
      </div>

      {inputs.length === 0 ? (
        <div className="rounded border border-dashed border-slate-700 bg-black/20 p-4 text-center text-xs text-slate-500">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {inputs.map((input, idx) => (
            <InputCard
              key={idx}
              input={input}
              idx={idx}
              t={t}
              onChange={patch => updateAt(idx, patch)}
              onRemove={() => removeAt(idx)}
            />
          ))}
        </div>
      )}

      <button
        onClick={addInput}
        className="hover:border-[var(--highlight-color)]/40 flex w-full items-center justify-center gap-2 rounded border border-dashed border-slate-700 bg-black/10 py-2 text-xs text-slate-400 transition-colors hover:bg-black/30 hover:text-white"
      >
        <Plus size={14} />
        {t.add}
      </button>
    </div>
  );
}

type InputsStrings = (typeof STRINGS)['en'] | (typeof STRINGS)['es'];

function InputCard({
  input,
  idx,
  t,
  onChange,
  onRemove,
}: {
  input: RunbookInputDefinition;
  idx: number;
  t: InputsStrings;
  onChange: (patch: Partial<RunbookInputDefinition>) => void;
  onRemove: () => void;
}) {
  const fieldCls =
    'w-full bg-black/30 border border-[var(--border-color)] rounded px-2 py-1.5 text-xs text-[var(--body-text-color)] focus:outline-none focus:border-[var(--highlight-color)] transition-colors';
  const labelCls = 'block text-[10px] font-bold uppercase text-slate-500 mb-1';
  const nameInvalid = input.name.length > 0 && !NAME_RE.test(input.name);

  return (
    <div className="space-y-2.5 rounded border border-slate-700 bg-slate-900/40 p-3">
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="mt-2 shrink-0 text-slate-600" />
        <div className="grid flex-1 grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>{t.name}</label>
            <input
              type="text"
              value={input.name}
              onChange={e => onChange({ name: e.target.value })}
              placeholder={t.namePlaceholder}
              className={`${fieldCls} font-mono ${nameInvalid ? 'border-red-500/50' : ''}`}
            />
          </div>
          <div>
            <label className={labelCls}>{t.type}</label>
            <select
              value={input.type}
              onChange={e => {
                const type = e.target.value as RunbookInputType;
                const patch: Partial<RunbookInputDefinition> = { type };
                if (type !== 'select') patch.options = undefined;
                if (type === 'boolean' && typeof input.default === 'string') {
                  patch.default = false;
                }
                onChange(patch);
              }}
              className={fieldCls}
            >
              <option value="text">{t.types.text}</option>
              <option value="number">{t.types.number}</option>
              <option value="boolean">{t.types.boolean}</option>
              <option value="select">{t.types.select}</option>
            </select>
          </div>
        </div>
        <button
          onClick={onRemove}
          aria-label={t.delete}
          title={t.delete}
          className="shrink-0 rounded p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {nameInvalid && <div className="text-[10px] leading-snug text-red-400">{t.nameInvalid}</div>}
      {!nameInvalid && (
        <div className="text-[10px] text-slate-500">
          {t.nameHint}{' '}
          <code className="text-[var(--highlight-color)]/70">
            {'{{vars.'}
            {input.name || 'name'}
            {'}}'}
          </code>
        </div>
      )}

      <div>
        <label className={labelCls}>{t.label}</label>
        <input
          type="text"
          value={input.label ?? ''}
          onChange={e => onChange({ label: e.target.value })}
          placeholder={t.labelPlaceholder}
          className={fieldCls}
        />
      </div>

      <div>
        <label className={labelCls}>{t.description}</label>
        <input
          type="text"
          value={input.description ?? ''}
          onChange={e => onChange({ description: e.target.value })}
          placeholder={t.descriptionPlaceholder}
          className={fieldCls}
        />
      </div>

      {input.type === 'select' && (
        <div>
          <label className={labelCls}>{t.options}</label>
          <textarea
            value={(input.options ?? []).join('\n')}
            onChange={e =>
              onChange({
                options: e.target.value
                  .split('\n')
                  .map(s => s.trim())
                  .filter(Boolean),
              })
            }
            rows={3}
            placeholder={t.optionsPlaceholder}
            className={`${fieldCls} resize-none font-mono`}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>{t.default}</label>
          {input.type === 'boolean' ? (
            <select
              value={input.default === true ? 'true' : 'false'}
              onChange={e => onChange({ default: e.target.value === 'true' })}
              className={fieldCls}
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          ) : input.type === 'select' ? (
            <select
              value={(input.default as string) ?? ''}
              onChange={e => onChange({ default: e.target.value || undefined })}
              className={fieldCls}
            >
              <option value="">—</option>
              {(input.options ?? []).map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={input.type === 'number' ? 'number' : 'text'}
              value={input.default === undefined ? '' : String(input.default)}
              onChange={e =>
                onChange({
                  default: coerceDefault(input.type, e.target.value),
                })
              }
              className={fieldCls}
            />
          )}
        </div>
        <div className="flex items-end">
          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={!!input.required}
              onChange={e => onChange({ required: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            {t.required}
          </label>
        </div>
      </div>
    </div>
  );
}

function uniqueName(existing: RunbookInputDefinition[]): string {
  const taken = new Set(existing.map(i => i.name));
  let i = 1;
  while (taken.has(`input_${i}`)) i++;
  return `input_${i}`;
}
