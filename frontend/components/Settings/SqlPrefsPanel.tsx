'use client';

import { Database, Eye, FileText, Layout, Shield, Table2, Timer } from 'lucide-react';

import { useSqlPrefs } from '@/lib/userPrefs';

interface SqlPrefsPanelProps {
  lang: 'en' | 'es';
}

const STRINGS = {
  en: {
    title: 'SQL editor',
    subtitle: 'Defaults applied to every query you run from /sql-editor.',
    rowLimitLabel: 'Default row limit',
    rowLimitHint:
      'When the query has no LIMIT clause, the editor wraps it with LIMIT N before sending. Prevents pulling millions of rows by accident.',
    confirmDestructiveLabel: 'Confirm destructive queries',
    confirmDestructiveHint:
      'Show a modal before running DROP, TRUNCATE, or DELETE/UPDATE without WHERE.',
    timeoutLabel: 'Query timeout',
    timeoutHint:
      'Cancel the query if it runs longer than this. Backend caps at 60s regardless of this setting.',
    autoLoadSchemaLabel: 'Auto-load schema on connect',
    autoLoadSchemaHint:
      'Off if your DB has hundreds of tables and you prefer the manual refresh button.',
    showSystemSchemasLabel: 'Show system schemas',
    showSystemSchemasHint: 'Include pg_catalog and information_schema in the schema sidebar.',
    diagramDirLabel: 'Diagram layout direction',
    diagramDirHint: 'How tables flow when the schema diagram is auto-laid out.',
    dirRight: 'Left → Right',
    dirDown: 'Top → Bottom',
    diagramZoomLabel: 'Diagram default zoom',
    diagramZoomHint: 'Initial zoom when the diagram first opens.',
    zoomFit: 'Fit to view',
    zoomActual: '100%',
    tabSizeLabel: 'Tab size',
    tabSizeHint: 'Indent width in the SQL Monaco editor.',
    autoFormatLabel: 'Auto-format on Run',
    autoFormatHint: 'Pretty-print the SQL before sending it. Format = uppercased keywords.',
    showRowNumbersLabel: 'Show row numbers in results',
    showRowNumbersHint: 'Add a `#` column on the left of result tables.',
    on: 'On',
    off: 'Off',
  },
  es: {
    title: 'Editor SQL',
    subtitle: 'Defaults aplicados a cada query que ejecutás desde /sql-editor.',
    rowLimitLabel: 'Límite de filas por defecto',
    rowLimitHint:
      'Si la query no tiene LIMIT, el editor le agrega LIMIT N antes de enviarla. Evita traer millones de filas por error.',
    confirmDestructiveLabel: 'Confirmar queries destructivas',
    confirmDestructiveHint:
      'Modal de confirmación antes de DROP, TRUNCATE, o DELETE/UPDATE sin WHERE.',
    timeoutLabel: 'Timeout de query',
    timeoutHint:
      'Cancela la query si tarda más de esto. El backend tiene tope de 60s sin importar este valor.',
    autoLoadSchemaLabel: 'Cargar schema automático al conectar',
    autoLoadSchemaHint: 'Apagá si tu DB tiene cientos de tablas y preferís el refresh manual.',
    showSystemSchemasLabel: 'Mostrar schemas del sistema',
    showSystemSchemasHint: 'Incluir pg_catalog e information_schema en la barra lateral.',
    diagramDirLabel: 'Dirección del diagrama',
    diagramDirHint: 'Cómo fluyen las tablas en el auto-layout.',
    dirRight: 'Izq → Der',
    dirDown: 'Arriba → Abajo',
    diagramZoomLabel: 'Zoom inicial del diagrama',
    diagramZoomHint: 'Zoom al abrir el diagrama por primera vez.',
    zoomFit: 'Ajustar a vista',
    zoomActual: '100%',
    tabSizeLabel: 'Tamaño de tab',
    tabSizeHint: 'Ancho de indentación en el Monaco SQL.',
    autoFormatLabel: 'Auto-formato al ejecutar',
    autoFormatHint: 'Pretty-print del SQL antes de enviarlo. Mayúsculas en keywords.',
    showRowNumbersLabel: 'Numerar filas en resultados',
    showRowNumbersHint: 'Columna `#` a la izquierda de la tabla de resultados.',
    on: 'Encendido',
    off: 'Apagado',
  },
} as const;

export default function SqlPrefsPanel({ lang }: SqlPrefsPanelProps) {
  const t = STRINGS[lang];
  const [prefs, setPrefs] = useSqlPrefs();

  return (
    <section className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <header className="mb-3 flex items-center gap-2">
        <Database size={16} className="text-emerald-400" />
        <h2 className="text-sm font-semibold">{t.title}</h2>
      </header>
      <p className="mb-4 text-xs text-[var(--text-muted)]">{t.subtitle}</p>

      <div className="space-y-3">
        <NumberInput
          icon={<Table2 size={12} />}
          label={t.rowLimitLabel}
          hint={t.rowLimitHint}
          value={prefs.defaultRowLimit}
          min={10}
          max={100000}
          step={10}
          onChange={n => setPrefs({ defaultRowLimit: n })}
        />
        <Toggle
          icon={<Shield size={12} />}
          label={t.confirmDestructiveLabel}
          hint={t.confirmDestructiveHint}
          on={t.on}
          off={t.off}
          value={prefs.confirmDestructive}
          onChange={v => setPrefs({ confirmDestructive: v })}
        />
        <NumberInput
          icon={<Timer size={12} />}
          label={t.timeoutLabel}
          hint={t.timeoutHint}
          value={prefs.queryTimeoutMs}
          min={1000}
          max={60_000}
          step={1000}
          format={n => `${(n / 1000).toFixed(0)}s`}
          onChange={n => setPrefs({ queryTimeoutMs: n })}
        />
        <Toggle
          icon={<Eye size={12} />}
          label={t.autoLoadSchemaLabel}
          hint={t.autoLoadSchemaHint}
          on={t.on}
          off={t.off}
          value={prefs.autoLoadSchema}
          onChange={v => setPrefs({ autoLoadSchema: v })}
        />
        <Toggle
          icon={<Eye size={12} />}
          label={t.showSystemSchemasLabel}
          hint={t.showSystemSchemasHint}
          on={t.on}
          off={t.off}
          value={prefs.showSystemSchemas}
          onChange={v => setPrefs({ showSystemSchemas: v })}
        />
        <Pills
          icon={<Layout size={12} />}
          label={t.diagramDirLabel}
          hint={t.diagramDirHint}
          value={prefs.diagramLayoutDirection}
          options={[
            { id: 'RIGHT', label: t.dirRight },
            { id: 'DOWN', label: t.dirDown },
          ]}
          onChange={v => setPrefs({ diagramLayoutDirection: v })}
        />
        <Pills
          icon={<Layout size={12} />}
          label={t.diagramZoomLabel}
          hint={t.diagramZoomHint}
          value={prefs.diagramDefaultZoom}
          options={[
            { id: 'fit', label: t.zoomFit },
            { id: '1x', label: t.zoomActual },
          ]}
          onChange={v => setPrefs({ diagramDefaultZoom: v })}
        />
        <Pills
          icon={<FileText size={12} />}
          label={t.tabSizeLabel}
          hint={t.tabSizeHint}
          value={prefs.tabSize}
          options={[
            { id: 2, label: '2 spaces' },
            { id: 4, label: '4 spaces' },
          ]}
          onChange={v => setPrefs({ tabSize: v })}
        />
        <Toggle
          icon={<FileText size={12} />}
          label={t.autoFormatLabel}
          hint={t.autoFormatHint}
          on={t.on}
          off={t.off}
          value={prefs.autoFormatOnRun}
          onChange={v => setPrefs({ autoFormatOnRun: v })}
        />
        <Toggle
          icon={<Table2 size={12} />}
          label={t.showRowNumbersLabel}
          hint={t.showRowNumbersHint}
          on={t.on}
          off={t.off}
          value={prefs.showRowNumbers}
          onChange={v => setPrefs({ showRowNumbers: v })}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tiny shared primitives — kept here so this panel ships standalone.
// ---------------------------------------------------------------------------

function Toggle({
  icon,
  label,
  hint,
  value,
  onChange,
  on,
  off,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  on: string;
  off: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--panel-border)] bg-[var(--app-bg)] p-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span className="text-[var(--text-muted)]">{icon}</span>
          {label}
        </div>
        {hint ? <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{hint}</div> : null}
      </div>
      <div className="flex shrink-0 overflow-hidden rounded border border-[var(--panel-border)]">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-2 py-1 text-[10px] uppercase tracking-wide ${!value ? 'bg-zinc-700 text-white' : 'text-[var(--text-muted)]'}`}
        >
          {off}
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-2 py-1 text-[10px] uppercase tracking-wide ${value ? 'bg-emerald-600 text-white' : 'text-[var(--text-muted)]'}`}
        >
          {on}
        </button>
      </div>
    </div>
  );
}

function NumberInput({
  icon,
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-md border border-[var(--panel-border)] bg-[var(--app-bg)] p-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <span className="text-[var(--text-muted)]">{icon}</span>
            {label}
          </div>
          {hint ? <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{hint}</div> : null}
        </div>
        <span className="font-mono text-xs text-emerald-400">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-emerald-500"
      />
    </div>
  );
}

function Pills<T extends string | number>({
  icon,
  label,
  hint,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="rounded-md border border-[var(--panel-border)] bg-[var(--app-bg)] p-2">
      <div className="mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span className="text-[var(--text-muted)]">{icon}</span>
          {label}
        </div>
        {hint ? <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{hint}</div> : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => {
          const active = value === opt.id;
          return (
            <button
              key={String(opt.id)}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`rounded border px-2 py-1 text-[10px] uppercase tracking-wide transition-colors ${
                active
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-[var(--panel-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
