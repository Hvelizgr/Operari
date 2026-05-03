'use client';

import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * SQLHelpDrawer — slide-in cheat-sheet for the SQL editor.
 *
 * Operators land here without prior SQL exposure pretty often (SREs
 * who write more YAML than SELECT, on-call engineers debugging a
 * connection at 3 a.m.). The drawer surfaces the verbs they'll need
 * — SELECT / INSERT / UPDATE / DELETE / JOIN — plus the constraints
 * that explain "why did my INSERT fail" and the conventions that
 * separate "works in psql" from "still works in three months."
 *
 * Content is inline JSX rather than markdown because (a) the rest
 * of the codebase keeps i18n inline via `lang === 'es'` and adding
 * a markdown processor for one feature is overkill, (b) the syntax
 * blocks need precise control over whitespace + monospace styling,
 * and (c) the topic sections render once on open — there's no win
 * from offloading to a parser.
 */

interface SQLHelpDrawerProps {
  open: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
  /**
   * Optional callback wired to the editor's `insertText` so each
   * code block exposes a "copy to editor" affordance. Silently no-op
   * when omitted (lets the drawer be reused outside the editor flow).
   */
  onInsertSnippet?: (sql: string) => void;
  /**
   * Topic id to scroll to on open / when changed while open. Lets
   * the editor jump straight to "INSERT" when the operator opens the
   * drawer while typing an INSERT. Null = land on the first topic.
   */
  initialTopicId?: string | null;
}

/**
 * Extracts the dominant SQL verb from the query text so the drawer
 * can auto-jump to the matching topic. Heuristic, not a parser:
 *
 *   1. Strip line + block comments — operators paste examples that
 *      lead with `-- foo` and we don't want the next keyword shadowed
 *      by them.
 *   2. Pick the LAST statement (split on `;`). When the operator is
 *      mid-edit on a multi-statement script, the trailing statement
 *      is almost always the one they're working on.
 *   3. Read the first SQL keyword of that statement. Maps to the
 *      drawer topic; unknowns return null and the drawer falls back
 *      to its default landing topic.
 *
 * Exported so SQLEditorCanvas can call it on every onChange without
 * pulling in the rest of the drawer module.
 */
export function detectActiveVerb(query: string): string | null {
  if (!query) return null;
  const stripped = query
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  if (!stripped) return null;
  const statements = stripped
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
  const last = statements[statements.length - 1];
  if (!last) return null;
  const firstWord = last.split(/\s+/)[0]?.toUpperCase();
  switch (firstWord) {
    case 'SELECT':
    case 'WITH':
      return 'select';
    case 'INSERT':
      return 'insert';
    case 'UPDATE':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return null;
  }
}

interface Topic {
  id: string;
  label: { en: string; es: string };
  emoji: string;
  body: { en: React.ReactNode; es: React.ReactNode };
}

interface SyntaxBlockProps {
  sql: string;
  onInsert?: (sql: string) => void;
  lang: 'en' | 'es';
}

const SyntaxBlock = ({ sql, onInsert, lang }: SyntaxBlockProps) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative my-2 rounded border border-zinc-800 bg-black/40">
      <pre className="overflow-x-auto p-2.5 font-mono text-[11px] leading-relaxed text-emerald-200">
        {sql}
      </pre>
      <div className="pointer-events-none absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(sql).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="pointer-events-auto rounded border border-zinc-700 bg-zinc-900/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-300 hover:border-zinc-500 hover:text-white"
          title={lang === 'es' ? 'Copiar' : 'Copy'}
        >
          {copied ? (lang === 'es' ? '¡copiado!' : 'copied!') : lang === 'es' ? 'copiar' : 'copy'}
        </button>
        {onInsert ? (
          <button
            type="button"
            onClick={() => onInsert(sql)}
            className="pointer-events-auto rounded border border-emerald-700 bg-emerald-900/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-200 hover:bg-emerald-900/70"
            title={lang === 'es' ? 'Insertar en el editor' : 'Insert into editor'}
          >
            {lang === 'es' ? 'insertar' : 'insert'}
          </button>
        ) : null}
      </div>
    </div>
  );
};

const buildTopics = (lang: 'en' | 'es', onInsert?: (sql: string) => void): Topic[] => {
  // Rendering helpers scoped to the closure so each topic can spread
  // syntax blocks without re-importing the helper props.
  const Code = ({ children }: { children: string }) => (
    <SyntaxBlock sql={children} onInsert={onInsert} lang={lang} />
  );
  const P = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p className={`text-[12px] leading-relaxed text-zinc-300 ${className ?? ''}`}>{children}</p>
  );
  const Hint = ({ children }: { children: React.ReactNode }) => (
    <p className="my-1.5 rounded border border-amber-700/40 bg-amber-500/5 px-2 py-1.5 text-[11px] leading-relaxed text-amber-200/90">
      {children}
    </p>
  );
  const KW = ({ children }: { children: React.ReactNode }) => (
    <code className="rounded bg-zinc-800 px-1 py-px font-mono text-[10px] text-emerald-300">
      {children}
    </code>
  );
  return [
    {
      id: 'select',
      emoji: '🔍',
      label: { en: 'SELECT — read rows', es: 'SELECT — leer filas' },
      body: {
        en: (
          <>
            <P>
              Reads rows from a table. Always start with the columns you actually need —{' '}
              <KW>SELECT *</KW> becomes painful as the table grows.
            </P>
            <Code>{`SELECT id, name, email
FROM users
WHERE active = TRUE
ORDER BY created_at DESC
LIMIT 50;`}</Code>
            <Hint>
              The <KW>WHERE</KW> clause filters rows. <KW>ORDER BY</KW> + <KW>LIMIT</KW> control how
              much you pull back — the SQL editor auto-wraps unbounded SELECTs but you should still
              cap explicitly.
            </Hint>
          </>
        ),
        es: (
          <>
            <P>
              Lee filas de una tabla. Siempre empezá con las columnas que realmente necesitás —{' '}
              <KW>SELECT *</KW> se vuelve doloroso a medida que la tabla crece.
            </P>
            <Code>{`SELECT id, name, email
FROM users
WHERE active = TRUE
ORDER BY created_at DESC
LIMIT 50;`}</Code>
            <Hint>
              El <KW>WHERE</KW> filtra filas. <KW>ORDER BY</KW> + <KW>LIMIT</KW> controlan cuánto
              traés — el editor SQL auto-wrappea SELECTs sin límite, pero igual deberías cap-earlo
              explícitamente.
            </Hint>
          </>
        ),
      },
    },
    {
      id: 'insert',
      emoji: '➕',
      label: { en: 'INSERT — add rows', es: 'INSERT — agregar filas' },
      body: {
        en: (
          <>
            <P>
              Adds new rows. <KW>INSERT</KW> never modifies existing data — for that you want{' '}
              <KW>UPDATE</KW> or <KW>INSERT … ON CONFLICT</KW> (upsert).
            </P>
            <P className="mt-2 font-semibold text-zinc-200">
              1. With explicit columns (recommended)
            </P>
            <Code>{`INSERT INTO employees (name, email, department, salary)
VALUES ('Luis García', 'luis@correo.com', 'IT', 50000);`}</Code>
            <P className="mt-2 font-semibold text-zinc-200">2. Multiple rows in one statement</P>
            <Code>{`INSERT INTO employees (name, email, department, salary)
VALUES
  ('Marta López', 'marta@correo.com', 'HR', 45000),
  ('Jorge Ruiz', 'jorge@correo.com', 'IT', 55000),
  ('Clara Díaz', 'clara@correo.com', 'Marketing', 47000);`}</Code>
            <P className="mt-2 font-semibold text-zinc-200">3. From a SELECT</P>
            <Code>{`INSERT INTO employees_backup (id, name, email, department, salary)
SELECT id, name, email, department, salary
FROM employees
WHERE department = 'IT';`}</Code>
            <Hint>
              Numbers go bare (<KW>40000</KW>), strings/dates in single quotes (
              <KW>{`'2024-05-20'`}</KW>), missing values explicitly as <KW>NULL</KW>. Mismatched
              column count vs. value count is the #1 INSERT error.
            </Hint>
          </>
        ),
        es: (
          <>
            <P>
              Agrega filas nuevas. <KW>INSERT</KW> nunca modifica datos existentes — para eso usás{' '}
              <KW>UPDATE</KW> o <KW>INSERT … ON CONFLICT</KW> (upsert).
            </P>
            <P className="mt-2 font-semibold text-zinc-200">
              1. Con columnas explícitas (recomendado)
            </P>
            <Code>{`INSERT INTO empleados (nombre, email, departamento, salario)
VALUES ('Luis García', 'luis@correo.com', 'IT', 50000);`}</Code>
            <P className="mt-2 font-semibold text-zinc-200">2. Varias filas en una sentencia</P>
            <Code>{`INSERT INTO empleados (nombre, email, departamento, salario)
VALUES
  ('Marta López', 'marta@correo.com', 'RRHH', 45000),
  ('Jorge Ruiz', 'jorge@correo.com', 'IT', 55000),
  ('Clara Díaz', 'clara@correo.com', 'Marketing', 47000);`}</Code>
            <P className="mt-2 font-semibold text-zinc-200">3. Desde un SELECT</P>
            <Code>{`INSERT INTO empleados_backup (id, nombre, email, departamento, salario)
SELECT id, nombre, email, departamento, salario
FROM empleados
WHERE departamento = 'IT';`}</Code>
            <Hint>
              Los números van pelados (<KW>40000</KW>), strings/fechas entre comillas simples (
              <KW>{`'2024-05-20'`}</KW>), valores ausentes como <KW>NULL</KW> explícito. La causa #1
              de errores de INSERT es columna-count vs. value-count desalineado.
            </Hint>
          </>
        ),
      },
    },
    {
      id: 'update',
      emoji: '✏️',
      label: { en: 'UPDATE — modify rows', es: 'UPDATE — modificar filas' },
      body: {
        en: (
          <>
            <P>
              Modifies existing rows. <KW>UPDATE</KW> without <KW>WHERE</KW> rewrites every row —
              the most common production accident. Always preview the WHERE as a SELECT first.
            </P>
            <Code>{`-- Preview which rows you'd touch
SELECT id, salary FROM employees WHERE department = 'IT';

-- Then the UPDATE
UPDATE employees
SET salary = salary * 1.10
WHERE department = 'IT';`}</Code>
            <Hint>
              Wrap risky UPDATEs in a transaction so you can <KW>ROLLBACK</KW> if the row count is
              wrong: <KW>BEGIN; UPDATE …; -- check count; COMMIT;</KW>
            </Hint>
          </>
        ),
        es: (
          <>
            <P>
              Modifica filas existentes. <KW>UPDATE</KW> sin <KW>WHERE</KW> reescribe TODAS las
              filas — el accidente de producción más común. Siempre previsualizá el WHERE como un
              SELECT primero.
            </P>
            <Code>{`-- Previsualizá qué filas tocarías
SELECT id, salario FROM empleados WHERE departamento = 'IT';

-- Después el UPDATE
UPDATE empleados
SET salario = salario * 1.10
WHERE departamento = 'IT';`}</Code>
            <Hint>
              Envolvé UPDATEs riesgosos en una transacción para poder <KW>ROLLBACK</KW> si el
              row-count está mal: <KW>BEGIN; UPDATE …; -- chequea el count; COMMIT;</KW>
            </Hint>
          </>
        ),
      },
    },
    {
      id: 'delete',
      emoji: '🗑️',
      label: { en: 'DELETE — remove rows', es: 'DELETE — eliminar filas' },
      body: {
        en: (
          <>
            <P>
              Removes rows. Same gotcha as UPDATE — a missing <KW>WHERE</KW> wipes the whole table.
            </P>
            <Code>{`DELETE FROM sessions
WHERE expires_at < NOW();`}</Code>
            <Hint>
              For full-table truncation prefer <KW>TRUNCATE</KW> — it's faster, but skips triggers
              and foreign-key cascades. Use <KW>DELETE</KW> when those matter.
            </Hint>
          </>
        ),
        es: (
          <>
            <P>
              Elimina filas. Misma trampa que UPDATE — sin <KW>WHERE</KW> borra la tabla entera.
            </P>
            <Code>{`DELETE FROM sesiones
WHERE expira_en < NOW();`}</Code>
            <Hint>
              Para truncar la tabla entera, mejor <KW>TRUNCATE</KW> — es más rápido, pero saltea
              triggers y cascadas de foreign-keys. Usá <KW>DELETE</KW> cuando esas importan.
            </Hint>
          </>
        ),
      },
    },
    {
      id: 'join',
      emoji: '🔗',
      label: { en: 'JOIN — combine tables', es: 'JOIN — combinar tablas' },
      body: {
        en: (
          <>
            <P>
              Pull columns from related tables in one query. <KW>INNER JOIN</KW> drops rows with no
              match; <KW>LEFT JOIN</KW> keeps the left side and fills missing right-side columns
              with <KW>NULL</KW>.
            </P>
            <Code>{`SELECT u.id, u.email, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.email
ORDER BY order_count DESC
LIMIT 20;`}</Code>
            <Hint>
              Always alias tables (<KW>users u</KW>, <KW>orders o</KW>) so JOINed columns stay
              unambiguous. Joining on <KW>NULL</KW> never matches — use <KW>IS NULL</KW> instead of{' '}
              <KW>= NULL</KW>.
            </Hint>
          </>
        ),
        es: (
          <>
            <P>
              Trae columnas de tablas relacionadas en una sola query. <KW>INNER JOIN</KW> descarta
              filas sin match; <KW>LEFT JOIN</KW> conserva el lado izquierdo y rellena con{' '}
              <KW>NULL</KW> las columnas del derecho que falten.
            </P>
            <Code>{`SELECT u.id, u.email, COUNT(o.id) AS pedidos
FROM usuarios u
LEFT JOIN pedidos o ON o.usuario_id = u.id
GROUP BY u.id, u.email
ORDER BY pedidos DESC
LIMIT 20;`}</Code>
            <Hint>
              Siempre aliaseá las tablas (<KW>usuarios u</KW>, <KW>pedidos o</KW>) para que las
              columnas JOINeadas no sean ambiguas. Hacer JOIN contra <KW>NULL</KW> nunca matchea —
              usá <KW>IS NULL</KW>, no <KW>= NULL</KW>.
            </Hint>
          </>
        ),
      },
    },
    {
      id: 'constraints',
      emoji: '🔒',
      label: { en: 'Constraints', es: 'Constraints' },
      body: {
        en: (
          <>
            <P>
              Tables enforce rules at the schema level. When an INSERT/UPDATE fails with{' '}
              <KW>violates ... constraint</KW>, the error message names the rule. Common ones:
            </P>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <KW>PRIMARY KEY</KW> — value must be unique and non-null. Auto-indexed.
              </li>
              <li>
                <KW>NOT NULL</KW> — column must always have a value (NULL is rejected).
              </li>
              <li>
                <KW>UNIQUE</KW> — duplicate values rejected; NULL is allowed (and considered
                distinct from other NULLs).
              </li>
              <li>
                <KW>FOREIGN KEY</KW> — value must exist in the referenced table. Deletes can cascade
                or block depending on the constraint definition.
              </li>
              <li>
                <KW>CHECK</KW> — arbitrary expression must hold per row, e.g.{' '}
                <KW>CHECK (price &gt; 0)</KW>.
              </li>
            </ul>
          </>
        ),
        es: (
          <>
            <P>
              Las tablas hacen cumplir reglas a nivel de schema. Cuando un INSERT/UPDATE falla con{' '}
              <KW>violates ... constraint</KW>, el mensaje nombra la regla. Las comunes:
            </P>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <KW>PRIMARY KEY</KW> — el valor debe ser único y no nulo. Auto-indexada.
              </li>
              <li>
                <KW>NOT NULL</KW> — la columna debe tener siempre un valor (NULL se rechaza).
              </li>
              <li>
                <KW>UNIQUE</KW> — valores duplicados rechazados; NULL permitido (y considerado
                distinto de otros NULLs).
              </li>
              <li>
                <KW>FOREIGN KEY</KW> — el valor debe existir en la tabla referenciada. Los deletes
                pueden cascadear o bloquearse según la definición.
              </li>
              <li>
                <KW>CHECK</KW> — una expresión arbitraria debe cumplirse por fila, ej.{' '}
                <KW>CHECK (precio &gt; 0)</KW>.
              </li>
            </ul>
          </>
        ),
      },
    },
    {
      id: 'pitfalls',
      emoji: '⚠️',
      label: { en: 'Common errors', es: 'Errores comunes' },
      body: {
        en: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>UPDATE/DELETE without WHERE — touches every row.</li>
            <li>Comparing to NULL with =. Use IS NULL / IS NOT NULL.</li>
            <li>
              Mixing single and double quotes — strings are 'single', identifiers are "double".
            </li>
            <li>
              Forgetting that <KW>NULL = NULL</KW> is <KW>NULL</KW>, not <KW>TRUE</KW>.
            </li>
            <li>
              Casting silently — <KW>'1' = 1</KW> works in PG but fails in stricter motors.
            </li>
            <li>Implicit cartesian products from a missing JOIN condition.</li>
          </ul>
        ),
        es: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>UPDATE/DELETE sin WHERE — toca todas las filas.</li>
            <li>Comparar contra NULL con =. Usá IS NULL / IS NOT NULL.</li>
            <li>
              Mezclar comillas simples y dobles — strings son 'simples', identificadores son
              "dobles".
            </li>
            <li>
              Olvidar que <KW>NULL = NULL</KW> es <KW>NULL</KW>, no <KW>TRUE</KW>.
            </li>
            <li>
              Casts implícitos — <KW>'1' = 1</KW> funciona en PG pero falla en motores más
              estrictos.
            </li>
            <li>Productos cartesianos accidentales por falta de condición de JOIN.</li>
          </ul>
        ),
      },
    },
    {
      id: 'best-practices',
      emoji: '✅',
      label: { en: 'Best practices', es: 'Buenas prácticas' },
      body: {
        en: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>List columns explicitly on INSERT — your schema will evolve.</li>
            <li>Cap SELECTs with LIMIT until you know the row count.</li>
            <li>Wrap multi-statement writes in BEGIN/COMMIT; keep ROLLBACK ready.</li>
            <li>Preview UPDATE/DELETE WHERE clauses as a SELECT first.</li>
            <li>
              Prefer <KW>EXPLAIN ANALYZE</KW> over guessing why a query is slow.
            </li>
            <li>Name constraints meaningfully — error messages cite them by name.</li>
          </ul>
        ),
        es: (
          <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
            <li>Listá las columnas explícitas en INSERT — el schema va a evolucionar.</li>
            <li>Cap-eá los SELECTs con LIMIT hasta conocer el row count.</li>
            <li>Envolvé writes multi-sentencia en BEGIN/COMMIT; tené el ROLLBACK listo.</li>
            <li>Previsualizá los WHERE de UPDATE/DELETE como SELECT primero.</li>
            <li>
              Mejor <KW>EXPLAIN ANALYZE</KW> que adivinar por qué una query es lenta.
            </li>
            <li>Nombrá los constraints con sentido — los errores los citan por nombre.</li>
          </ul>
        ),
      },
    },
  ];
};

export function SQLHelpDrawer({
  open,
  onClose,
  lang,
  onInsertSnippet,
  initialTopicId,
}: SQLHelpDrawerProps) {
  const topics = useMemo(() => buildTopics(lang, onInsertSnippet), [lang, onInsertSnippet]);
  const [activeId, setActiveId] = useState<string>(
    initialTopicId && topics.some(t => t.id === initialTopicId)
      ? initialTopicId
      : (topics[0]?.id ?? '')
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // When the drawer opens (or the detected verb changes while the
  // drawer is already open), jump to the matching topic. Tied to a
  // ref-keyed effect so a manual click on a different topic chip
  // doesn't get clobbered by the next render — only verb *changes*
  // re-anchor.
  const lastInitialRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    if (!initialTopicId) return;
    if (lastInitialRef.current === initialTopicId) return;
    lastInitialRef.current = initialTopicId;
    if (!topics.some(t => t.id === initialTopicId)) return;
    setActiveId(initialTopicId);
    // Defer the scroll so the drawer DOM exists when the query runs.
    // requestAnimationFrame lands after the paint that opens the
    // drawer; setTimeout(0) sometimes fires too early.
    const id = requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>(`[data-topic="${initialTopicId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(id);
  }, [open, initialTopicId, topics]);

  // Esc closes — same affordance as the schema sidebar's mobile drawer.
  // Body keydown listener attached only while the drawer is open so we
  // don't intercept Esc presses meant for other modals.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const scrollToTopic = (id: string) => {
    setActiveId(id);
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-topic="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!open) return null;
  const t =
    lang === 'es'
      ? { title: 'Ayuda SQL', close: 'Cerrar', subtitle: 'Cheatsheet del editor', kbd: 'Esc' }
      : { title: 'SQL Help', close: 'Close', subtitle: 'Editor cheatsheet', kbd: 'Esc' };

  return (
    <>
      {/* Backdrop — clicking outside closes. Stops at the drawer body. */}
      <button
        type="button"
        aria-label={t.close}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-label={t.title}
        className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(640px,95vw)] flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-zinc-100">{t.title}</span>
            <span className="text-[11px] text-zinc-500">{t.subtitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="hidden rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline">
              {t.kbd}
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              aria-label={t.close}
              title={t.close}
            >
              <X size={16} />
            </button>
          </div>
        </header>
        {/* Topic chips — quick-jump nav. Click scrolls the body to that
            topic; the active state mirrors the most recently scrolled
            topic (kept simple, no IntersectionObserver wiring). */}
        <nav className="flex flex-wrap gap-1 border-b border-zinc-800 bg-zinc-900/30 px-3 py-2">
          {topics.map(topic => (
            <button
              key={topic.id}
              type="button"
              onClick={() => scrollToTopic(topic.id)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                activeId === topic.id
                  ? 'bg-emerald-700/30 text-emerald-200'
                  : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100'
              }`}
            >
              <span className="mr-1">{topic.emoji}</span>
              {topic.label[lang]}
            </button>
          ))}
        </nav>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {topics.map((topic, i) => (
            <section key={topic.id} data-topic={topic.id} className={i === 0 ? '' : 'mt-6'}>
              <h3 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-zinc-100">
                <span>{topic.emoji}</span>
                {topic.label[lang]}
              </h3>
              <div className="space-y-1.5">{topic.body[lang]}</div>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
