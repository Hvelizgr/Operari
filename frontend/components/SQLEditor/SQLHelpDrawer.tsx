'use client';

import {
  HelpDrawer,
  HelpHint,
  HelpKW,
  HelpP,
  type HelpTopic,
  SyntaxBlock,
} from '../help/HelpDrawer';

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
 * Drawer chrome lives in `components/help/HelpDrawer.tsx`; this file
 * supplies the SQL-specific topics + the verb auto-detect used to
 * jump to the matching section on open.
 */

interface SQLHelpDrawerProps {
  open: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
  onInsertSnippet?: (sql: string) => void;
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

const buildSqlTopics = (lang: 'en' | 'es', onInsert?: (sql: string) => void): HelpTopic[] => {
  const Code = ({ children }: { children: string }) => (
    <SyntaxBlock code={children} onInsert={onInsert} lang={lang} />
  );
  return [
    {
      id: 'select',
      emoji: '🔍',
      label: { en: 'SELECT — read rows', es: 'SELECT — leer filas' },
      body: {
        en: (
          <>
            <HelpP>
              Reads rows from a table. Always start with the columns you actually need —{' '}
              <HelpKW>SELECT *</HelpKW> becomes painful as the table grows.
            </HelpP>
            <Code>{`SELECT id, name, email
FROM users
WHERE active = TRUE
ORDER BY created_at DESC
LIMIT 50;`}</Code>
            <HelpHint>
              The <HelpKW>WHERE</HelpKW> clause filters rows. <HelpKW>ORDER BY</HelpKW> +{' '}
              <HelpKW>LIMIT</HelpKW> control how much you pull back — the SQL editor auto-wraps
              unbounded SELECTs but you should still cap explicitly.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              Lee filas de una tabla. Siempre empezá con las columnas que realmente necesitás —{' '}
              <HelpKW>SELECT *</HelpKW> se vuelve doloroso a medida que la tabla crece.
            </HelpP>
            <Code>{`SELECT id, name, email
FROM users
WHERE active = TRUE
ORDER BY created_at DESC
LIMIT 50;`}</Code>
            <HelpHint>
              El <HelpKW>WHERE</HelpKW> filtra filas. <HelpKW>ORDER BY</HelpKW> +{' '}
              <HelpKW>LIMIT</HelpKW> controlan cuánto traés — el editor SQL auto-wrappea SELECTs sin
              límite, pero igual deberías cap-earlo explícitamente.
            </HelpHint>
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
            <HelpP>
              Adds new rows. <HelpKW>INSERT</HelpKW> never modifies existing data — for that you
              want <HelpKW>UPDATE</HelpKW> or <HelpKW>INSERT … ON CONFLICT</HelpKW> (upsert).
            </HelpP>
            <HelpP className="mt-2 font-semibold text-zinc-200">
              1. With explicit columns (recommended)
            </HelpP>
            <Code>{`INSERT INTO employees (name, email, department, salary)
VALUES ('Luis García', 'luis@correo.com', 'IT', 50000);`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">
              2. Multiple rows in one statement
            </HelpP>
            <Code>{`INSERT INTO employees (name, email, department, salary)
VALUES
  ('Marta López', 'marta@correo.com', 'HR', 45000),
  ('Jorge Ruiz', 'jorge@correo.com', 'IT', 55000),
  ('Clara Díaz', 'clara@correo.com', 'Marketing', 47000);`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">3. From a SELECT</HelpP>
            <Code>{`INSERT INTO employees_backup (id, name, email, department, salary)
SELECT id, name, email, department, salary
FROM employees
WHERE department = 'IT';`}</Code>
            <HelpHint>
              Numbers go bare (<HelpKW>40000</HelpKW>), strings/dates in single quotes (
              <HelpKW>{`'2024-05-20'`}</HelpKW>), missing values explicitly as <HelpKW>NULL</HelpKW>
              . Mismatched column count vs. value count is the #1 INSERT error.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              Agrega filas nuevas. <HelpKW>INSERT</HelpKW> nunca modifica datos existentes — para
              eso usás <HelpKW>UPDATE</HelpKW> o <HelpKW>INSERT … ON CONFLICT</HelpKW> (upsert).
            </HelpP>
            <HelpP className="mt-2 font-semibold text-zinc-200">
              1. Con columnas explícitas (recomendado)
            </HelpP>
            <Code>{`INSERT INTO empleados (nombre, email, departamento, salario)
VALUES ('Luis García', 'luis@correo.com', 'IT', 50000);`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">
              2. Varias filas en una sentencia
            </HelpP>
            <Code>{`INSERT INTO empleados (nombre, email, departamento, salario)
VALUES
  ('Marta López', 'marta@correo.com', 'RRHH', 45000),
  ('Jorge Ruiz', 'jorge@correo.com', 'IT', 55000),
  ('Clara Díaz', 'clara@correo.com', 'Marketing', 47000);`}</Code>
            <HelpP className="mt-2 font-semibold text-zinc-200">3. Desde un SELECT</HelpP>
            <Code>{`INSERT INTO empleados_backup (id, nombre, email, departamento, salario)
SELECT id, nombre, email, departamento, salario
FROM empleados
WHERE departamento = 'IT';`}</Code>
            <HelpHint>
              Los números van pelados (<HelpKW>40000</HelpKW>), strings/fechas entre comillas
              simples (<HelpKW>{`'2024-05-20'`}</HelpKW>), valores ausentes como{' '}
              <HelpKW>NULL</HelpKW> explícito. La causa #1 de errores de INSERT es columna-count vs.
              value-count desalineado.
            </HelpHint>
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
            <HelpP>
              Modifies existing rows. <HelpKW>UPDATE</HelpKW> without <HelpKW>WHERE</HelpKW>{' '}
              rewrites every row — the most common production accident. Always preview the WHERE as
              a SELECT first.
            </HelpP>
            <Code>{`-- Preview which rows you'd touch
SELECT id, salary FROM employees WHERE department = 'IT';

-- Then the UPDATE
UPDATE employees
SET salary = salary * 1.10
WHERE department = 'IT';`}</Code>
            <HelpHint>
              Wrap risky UPDATEs in a transaction so you can <HelpKW>ROLLBACK</HelpKW> if the row
              count is wrong: <HelpKW>BEGIN; UPDATE …; -- check count; COMMIT;</HelpKW>
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              Modifica filas existentes. <HelpKW>UPDATE</HelpKW> sin <HelpKW>WHERE</HelpKW>{' '}
              reescribe TODAS las filas — el accidente de producción más común. Siempre previsualizá
              el WHERE como un SELECT primero.
            </HelpP>
            <Code>{`-- Previsualizá qué filas tocarías
SELECT id, salario FROM empleados WHERE departamento = 'IT';

-- Después el UPDATE
UPDATE empleados
SET salario = salario * 1.10
WHERE departamento = 'IT';`}</Code>
            <HelpHint>
              Envolvé UPDATEs riesgosos en una transacción para poder <HelpKW>ROLLBACK</HelpKW> si
              el row-count está mal: <HelpKW>BEGIN; UPDATE …; -- chequea el count; COMMIT;</HelpKW>
            </HelpHint>
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
            <HelpP>
              Removes rows. Same gotcha as UPDATE — a missing <HelpKW>WHERE</HelpKW> wipes the whole
              table.
            </HelpP>
            <Code>{`DELETE FROM sessions
WHERE expires_at < NOW();`}</Code>
            <HelpHint>
              For full-table truncation prefer <HelpKW>TRUNCATE</HelpKW> — it's faster, but skips
              triggers and foreign-key cascades. Use <HelpKW>DELETE</HelpKW> when those matter.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              Elimina filas. Misma trampa que UPDATE — sin <HelpKW>WHERE</HelpKW> borra la tabla
              entera.
            </HelpP>
            <Code>{`DELETE FROM sesiones
WHERE expira_en < NOW();`}</Code>
            <HelpHint>
              Para truncar la tabla entera, mejor <HelpKW>TRUNCATE</HelpKW> — es más rápido, pero
              saltea triggers y cascadas de foreign-keys. Usá <HelpKW>DELETE</HelpKW> cuando esas
              importan.
            </HelpHint>
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
            <HelpP>
              Pull columns from related tables in one query. <HelpKW>INNER JOIN</HelpKW> drops rows
              with no match; <HelpKW>LEFT JOIN</HelpKW> keeps the left side and fills missing
              right-side columns with <HelpKW>NULL</HelpKW>.
            </HelpP>
            <Code>{`SELECT u.id, u.email, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.email
ORDER BY order_count DESC
LIMIT 20;`}</Code>
            <HelpHint>
              Always alias tables (<HelpKW>users u</HelpKW>, <HelpKW>orders o</HelpKW>) so JOINed
              columns stay unambiguous. Joining on <HelpKW>NULL</HelpKW> never matches — use{' '}
              <HelpKW>IS NULL</HelpKW> instead of <HelpKW>= NULL</HelpKW>.
            </HelpHint>
          </>
        ),
        es: (
          <>
            <HelpP>
              Trae columnas de tablas relacionadas en una sola query. <HelpKW>INNER JOIN</HelpKW>{' '}
              descarta filas sin match; <HelpKW>LEFT JOIN</HelpKW> conserva el lado izquierdo y
              rellena con <HelpKW>NULL</HelpKW> las columnas del derecho que falten.
            </HelpP>
            <Code>{`SELECT u.id, u.email, COUNT(o.id) AS pedidos
FROM usuarios u
LEFT JOIN pedidos o ON o.usuario_id = u.id
GROUP BY u.id, u.email
ORDER BY pedidos DESC
LIMIT 20;`}</Code>
            <HelpHint>
              Siempre aliaseá las tablas (<HelpKW>usuarios u</HelpKW>, <HelpKW>pedidos o</HelpKW>)
              para que las columnas JOINeadas no sean ambiguas. Hacer JOIN contra{' '}
              <HelpKW>NULL</HelpKW> nunca matchea — usá <HelpKW>IS NULL</HelpKW>, no{' '}
              <HelpKW>= NULL</HelpKW>.
            </HelpHint>
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
            <HelpP>
              Tables enforce rules at the schema level. When an INSERT/UPDATE fails with{' '}
              <HelpKW>violates ... constraint</HelpKW>, the error message names the rule. Common
              ones:
            </HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>PRIMARY KEY</HelpKW> — value must be unique and non-null. Auto-indexed.
              </li>
              <li>
                <HelpKW>NOT NULL</HelpKW> — column must always have a value (NULL is rejected).
              </li>
              <li>
                <HelpKW>UNIQUE</HelpKW> — duplicate values rejected; NULL is allowed (and considered
                distinct from other NULLs).
              </li>
              <li>
                <HelpKW>FOREIGN KEY</HelpKW> — value must exist in the referenced table. Deletes can
                cascade or block depending on the constraint definition.
              </li>
              <li>
                <HelpKW>CHECK</HelpKW> — arbitrary expression must hold per row, e.g.{' '}
                <HelpKW>CHECK (price &gt; 0)</HelpKW>.
              </li>
            </ul>
          </>
        ),
        es: (
          <>
            <HelpP>
              Las tablas hacen cumplir reglas a nivel de schema. Cuando un INSERT/UPDATE falla con{' '}
              <HelpKW>violates ... constraint</HelpKW>, el mensaje nombra la regla. Las comunes:
            </HelpP>
            <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-zinc-300">
              <li>
                <HelpKW>PRIMARY KEY</HelpKW> — el valor debe ser único y no nulo. Auto-indexada.
              </li>
              <li>
                <HelpKW>NOT NULL</HelpKW> — la columna debe tener siempre un valor (NULL se
                rechaza).
              </li>
              <li>
                <HelpKW>UNIQUE</HelpKW> — valores duplicados rechazados; NULL permitido (y
                considerado distinto de otros NULLs).
              </li>
              <li>
                <HelpKW>FOREIGN KEY</HelpKW> — el valor debe existir en la tabla referenciada. Los
                deletes pueden cascadear o bloquearse según la definición.
              </li>
              <li>
                <HelpKW>CHECK</HelpKW> — una expresión arbitraria debe cumplirse por fila, ej.{' '}
                <HelpKW>CHECK (precio &gt; 0)</HelpKW>.
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
              Forgetting that <HelpKW>NULL = NULL</HelpKW> is <HelpKW>NULL</HelpKW>, not{' '}
              <HelpKW>TRUE</HelpKW>.
            </li>
            <li>
              Casting silently — <HelpKW>'1' = 1</HelpKW> works in PG but fails in stricter motors.
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
              Olvidar que <HelpKW>NULL = NULL</HelpKW> es <HelpKW>NULL</HelpKW>, no{' '}
              <HelpKW>TRUE</HelpKW>.
            </li>
            <li>
              Casts implícitos — <HelpKW>'1' = 1</HelpKW> funciona en PG pero falla en motores más
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
              Prefer <HelpKW>EXPLAIN ANALYZE</HelpKW> over guessing why a query is slow.
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
              Mejor <HelpKW>EXPLAIN ANALYZE</HelpKW> que adivinar por qué una query es lenta.
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
  const topics = buildSqlTopics(lang, onInsertSnippet);
  return (
    <HelpDrawer
      open={open}
      onClose={onClose}
      lang={lang}
      topics={topics}
      title={{ en: 'SQL Help', es: 'Ayuda SQL' }}
      subtitle={{ en: 'Editor cheatsheet', es: 'Cheatsheet del editor' }}
      initialTopicId={initialTopicId}
    />
  );
}
