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
import { useReactFlow } from '@xyflow/react';
import { Bug, GripVertical, X } from 'lucide-react';

import type { RfEdge, RfNode } from '@/lib/canvas/adapter';
import { useEditorStore } from '@/state/editorStore';

/**
 * Floating breakpoints index — shows the currently armed breakpoints
 * in a small panel anchored top-right of the canvas. Click a row to
 * fitView the step; the X removes the breakpoint. The list is
 * draggable via @dnd-kit so operators can reorder by likelihood /
 * importance when they're juggling several debug points.
 *
 * Reordering is cosmetic — the engine pauses at any armed breakpoint
 * regardless of position. The order surfaces the operator's mental
 * model ("the slow-query breakpoint matters more than the timeout
 * one"), nothing more.
 *
 * The panel hides itself when there are no breakpoints so an
 * unconfigured canvas stays clean.
 */

interface BreakpointsPanelProps {
  lang: 'en' | 'es';
}

export function BreakpointsPanel({ lang }: BreakpointsPanelProps) {
  const { fitView } = useReactFlow<RfNode, RfEdge>();
  const breakpoints = useEditorStore(s => s.breakpoints);
  const nodes = useEditorStore(s => s.nodes);
  const setBreakpoints = useEditorStore(s => s.setBreakpoints);
  const toggleBreakpoint = useEditorStore(s => s.toggleBreakpoint);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (breakpoints.length === 0) return null;

  const t =
    lang === 'es'
      ? { title: 'Breakpoints', empty: 'Sin breakpoints', remove: 'Quitar' }
      : { title: 'Breakpoints', empty: 'No breakpoints', remove: 'Remove' };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = breakpoints.indexOf(String(active.id));
    const newIdx = breakpoints.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    setBreakpoints(arrayMove(breakpoints, oldIdx, newIdx));
  };

  const jumpTo = (id: string) => {
    useEditorStore.setState(s => ({
      nodes: s.nodes.map(n =>
        n.id === id ? { ...n, selected: true } : n.selected ? { ...n, selected: false } : n
      ),
    }));
    fitView({ nodes: [{ id }], padding: 0.4, duration: 400 });
  };

  return (
    <div className="absolute right-4 top-4 z-30 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-rose-500/30 bg-[#1a1a2e]/95 text-white shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Bug size={13} className="text-rose-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-200">
            {t.title}
          </span>
          <span className="rounded bg-rose-500/20 px-1.5 font-mono text-[10px] text-rose-200">
            {breakpoints.length}
          </span>
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={breakpoints} strategy={verticalListSortingStrategy}>
          <ul className="max-h-72 overflow-y-auto py-1 text-xs">
            {breakpoints.map(id => {
              const node = nodes.find(n => n.id === id);
              const label = node?.data?.workflow?.title || node?.type || id;
              return (
                <BreakpointRow
                  key={id}
                  id={id}
                  label={String(label)}
                  removeLabel={t.remove}
                  onJump={() => jumpTo(id)}
                  onRemove={() => toggleBreakpoint(id)}
                />
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface BreakpointRowProps {
  id: string;
  label: string;
  removeLabel: string;
  onJump: () => void;
  onRemove: () => void;
}

function BreakpointRow({ id, label, removeLabel, onJump, onRemove }: BreakpointRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1.5 px-2 py-1.5 text-[color:var(--rb-node-text)] transition-colors hover:bg-white/5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reorder breakpoint"
        className="cursor-grab touch-none p-0.5 text-zinc-600 transition-colors hover:text-zinc-300 active:cursor-grabbing"
      >
        <GripVertical size={12} />
      </button>
      <button
        type="button"
        onClick={onJump}
        className="min-w-0 flex-1 truncate text-left transition-colors hover:text-white"
        title={`Jump to ${label}`}
      >
        <span className="truncate font-medium">{label}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="rounded p-0.5 text-zinc-600 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
      >
        <X size={12} />
      </button>
    </li>
  );
}
