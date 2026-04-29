'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export interface RequestPayload {
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

const METHOD_TINT: Record<HttpMethod, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-blue-400',
  PATCH: 'text-sky-400',
  DELETE: 'text-rose-400',
  HEAD: 'text-zinc-400',
};

interface Props {
  payload: RequestPayload;
  onChange: (next: RequestPayload) => void;
  lang: 'en' | 'es';
}

type Tab = 'headers' | 'body';

export default function RequestForm({ payload, onChange, lang }: Props) {
  const [tab, setTab] = useState<Tab>('headers');
  const t =
    lang === 'es'
      ? {
          urlPlaceholder: 'https://api.ejemplo.com/recursos/123',
          headers: 'Headers',
          body: 'Body',
          headerName: 'Nombre',
          headerValue: 'Valor',
          add: 'Agregar header',
          remove: 'Eliminar',
          bodyPlaceholder: 'Body de la solicitud (JSON, texto, …)',
          bodyHint: 'Ignorado para GET y HEAD',
        }
      : {
          urlPlaceholder: 'https://api.example.com/resources/123',
          headers: 'Headers',
          body: 'Body',
          headerName: 'Name',
          headerValue: 'Value',
          add: 'Add header',
          remove: 'Remove',
          bodyPlaceholder: 'Request body (JSON, text, …)',
          bodyHint: 'Ignored for GET and HEAD',
        };

  const updateHeader = (idx: number, key: string, value: string) => {
    const next = payload.headers.slice();
    next[idx] = { key, value };
    onChange({ ...payload, headers: next });
  };

  const addHeader = () => {
    onChange({ ...payload, headers: [...payload.headers, { key: '', value: '' }] });
  };

  const removeHeader = (idx: number) => {
    onChange({ ...payload, headers: payload.headers.filter((_, i) => i !== idx) });
  };

  const bodyDisabled = payload.method === 'GET' || payload.method === 'HEAD';

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-stretch gap-2">
        <select
          value={payload.method}
          onChange={e => onChange({ ...payload, method: e.target.value as HttpMethod })}
          className={`focus:border-primary rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-xs font-bold focus:outline-none ${METHOD_TINT[payload.method]}`}
          aria-label="HTTP method"
        >
          {METHODS.map(m => (
            <option key={m} value={m} className="text-zinc-200">
              {m}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={payload.url}
          onChange={e => onChange({ ...payload, url: e.target.value })}
          placeholder={t.urlPlaceholder}
          className="focus:border-primary min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <div className="flex border-b border-zinc-800">
        <TabButton active={tab === 'headers'} onClick={() => setTab('headers')}>
          {t.headers}
          {payload.headers.length > 0 && (
            <span className="ml-1.5 rounded bg-zinc-700 px-1 text-[9px] text-zinc-300">
              {payload.headers.length}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === 'body'} onClick={() => setTab('body')}>
          {t.body}
          {bodyDisabled && <span className="ml-1.5 text-[9px] text-zinc-600">— {t.bodyHint}</span>}
        </TabButton>
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'headers' ? (
          <div className="space-y-1.5">
            {payload.headers.map((h, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={h.key}
                  onChange={e => updateHeader(idx, e.target.value, h.value)}
                  placeholder={t.headerName}
                  className="focus:border-primary w-1/3 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
                  spellCheck={false}
                />
                <input
                  type="text"
                  value={h.value}
                  onChange={e => updateHeader(idx, h.key, e.target.value)}
                  placeholder={t.headerValue}
                  className="focus:border-primary flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
                  spellCheck={false}
                />
                <button
                  onClick={() => removeHeader(idx)}
                  className="p-1 text-zinc-600 transition-colors hover:text-rose-400"
                  aria-label={t.remove}
                  type="button"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              onClick={addHeader}
              type="button"
              className="flex items-center gap-1.5 rounded border border-dashed border-zinc-700 px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
            >
              <Plus size={11} />
              {t.add}
            </button>
          </div>
        ) : (
          <textarea
            value={payload.body}
            onChange={e => onChange({ ...payload, body: e.target.value })}
            placeholder={t.bodyPlaceholder}
            disabled={bodyDisabled}
            spellCheck={false}
            className="focus:border-primary h-full min-h-[160px] w-full resize-none rounded border border-zinc-800 bg-zinc-900 p-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-700 focus:outline-none disabled:opacity-40"
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors ${
        active
          ? 'border-emerald-500 text-emerald-300'
          : 'border-transparent text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  );
}
