'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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

// Stable id generator for header rows. The persisted RequestPayload
// only stores `{ key, value }` so we mint client-side ids on the fly
// to feed @dnd-kit's SortableContext (which needs unique row keys).
const newRowId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function RequestForm({ payload, onChange, lang }: Props) {
  const [tab, setTab] = useState<Tab>('headers');
  // Auto-animate the headers list — adding / removing rows now slides
  // smoothly instead of snapping. Single ref on the container; the lib
  // detects child mount/unmount and applies the transition. Zero
  // per-row code change.
  const [headersListRef] = useAutoAnimate<HTMLDivElement>();

  // Parallel array of stable ids that mirrors payload.headers in
  // length + index. Resyncs whenever headers grow or shrink from
  // outside (e.g. snippet inserts from the help drawer pushing
  // multiple Authorization headers at once). Reorder mutates both
  // sides at once via setHeaders below.
  const headerIdsRef = useRef<string[]>([]);
  useEffect(() => {
    while (headerIdsRef.current.length < payload.headers.length) {
      headerIdsRef.current.push(newRowId());
    }
    if (headerIdsRef.current.length > payload.headers.length) {
      headerIdsRef.current = headerIdsRef.current.slice(0, payload.headers.length);
    }
  }, [payload.headers.length]);

  const sensors = useSensors(
    // 4-pixel activation distance so a click on the row's text inputs
    // doesn't get hijacked as a drag start. Matches the existing dnd
    // setups elsewhere in the editor.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
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
    headerIdsRef.current = [...headerIdsRef.current, newRowId()];
    onChange({ ...payload, headers: [...payload.headers, { key: '', value: '' }] });
  };

  const removeHeader = (idx: number) => {
    headerIdsRef.current = headerIdsRef.current.filter((_, i) => i !== idx);
    onChange({ ...payload, headers: payload.headers.filter((_, i) => i !== idx) });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = headerIdsRef.current;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    headerIdsRef.current = arrayMove(ids, oldIdx, newIdx);
    onChange({ ...payload, headers: arrayMove(payload.headers, oldIdx, newIdx) });
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={headerIdsRef.current} strategy={verticalListSortingStrategy}>
              <div ref={headersListRef} className="space-y-1.5">
                {payload.headers.map((h, idx) => {
                  const id = headerIdsRef.current[idx];
                  if (!id) return null;
                  return (
                    <SortableHeaderRow
                      key={id}
                      id={id}
                      header={h}
                      onUpdate={(key, value) => updateHeader(idx, key, value)}
                      onRemove={() => removeHeader(idx)}
                      labels={{
                        headerName: t.headerName,
                        headerValue: t.headerValue,
                        remove: t.remove,
                      }}
                    />
                  );
                })}
                <button
                  onClick={addHeader}
                  type="button"
                  className="flex items-center gap-1.5 rounded border border-dashed border-zinc-700 px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
                >
                  <Plus size={11} />
                  {t.add}
                </button>
              </div>
            </SortableContext>
          </DndContext>
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

interface SortableHeaderRowProps {
  id: string;
  header: { key: string; value: string };
  onUpdate: (key: string, value: string) => void;
  onRemove: () => void;
  labels: { headerName: string; headerValue: string; remove: string };
}

function SortableHeaderRow({ id, header, onUpdate, onRemove, labels }: SortableHeaderRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5">
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reorder header"
        className="cursor-grab touch-none p-1 text-zinc-700 transition-colors hover:text-zinc-300 active:cursor-grabbing"
      >
        <GripVertical size={12} />
      </button>
      <input
        type="text"
        value={header.key}
        onChange={e => onUpdate(e.target.value, header.value)}
        placeholder={labels.headerName}
        className="focus:border-primary w-1/3 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
        spellCheck={false}
      />
      <input
        type="text"
        value={header.value}
        onChange={e => onUpdate(header.key, e.target.value)}
        placeholder={labels.headerValue}
        className="focus:border-primary flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
        spellCheck={false}
      />
      <button
        onClick={onRemove}
        className="p-1 text-zinc-600 transition-colors hover:text-rose-400"
        aria-label={labels.remove}
        type="button"
      >
        <Trash2 size={13} />
      </button>
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
