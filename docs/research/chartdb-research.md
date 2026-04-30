# chartdb research

Research notes from a deep read of [chartdb/chartdb](https://github.com/chartdb/chartdb)
(AGPL-3.0, v1.20.1) used as reference material for our own SQL editor and
runbook lineage features.

## Why we looked

chartdb is the most polished open-source database-diagram editor on the
market. It runs entirely in the browser on top of `@xyflow/react` v12 —
the same React Flow major we use — so the UX patterns translate cleanly.
We wanted to understand: what features are _possible_ on a React Flow
canvas, and which of them transfer to the runbook editor's vocabulary.

## License posture

Both projects are AGPL-3.0. We are license-compatible to copy code
verbatim, but have chosen not to. Every feature we shipped under this
research bucket is original implementation written against our own
domain types, with `// inspired by chartdb's pattern` references in the
file headers where the _idea_ came from outside the project.

If we ever want to lift code directly (e.g. their DDL parser), the AGPL
notice must travel with it.

## Architecture map

```
chartdb/
├── src/
│   ├── lib/
│   │   ├── data/
│   │   │   ├── data-types/         # 1130 LOC — per-DB type catalogs (pg, mysql, ...)
│   │   │   ├── default-schemas.ts  # which schema is default per DB
│   │   │   ├── import-metadata/    # 408 LOC postgres-script.ts + per-DB scripts
│   │   │   ├── sql-import/         # 2247 LOC postgresql.ts DDL parser, etc.
│   │   │   └── sql-export/         # 590 LOC postgresql.ts DDL emitter, etc.
│   │   ├── dbml/                   # 1606 LOC export, 1100 LOC import, 693 LOC apply
│   │   └── domain/                 # DBTable, DBField, DBRelationship, etc.
│   ├── pages/editor-page/
│   │   ├── canvas/                 # 656 LOC table-node, 540 LOC relationship-edge
│   │   ├── side-panel/             # tables / DBML editor / refs / custom types / visuals
│   │   ├── top-navbar/             # File / Edit / View menu
│   │   └── editor-sidebar/
│   └── context/                    # 162-method ChartDB context + 13 other contexts
└── ...
```

## Domain inventory

What chartdb models, in increasing order of complexity:

| Entity              | Notable fields                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DBTable`           | id, schema, x/y, fields[], indexes[], checkConstraints[], color, isView, isMaterializedView, comments, expanded, parentAreaId                    |
| `DBField`           | type (full DataType obj), primaryKey, unique, nullable, increment, isArray, charMaxLength, precision, scale, default, collation, comments, check |
| `DBIndex`           | unique, fieldIds[], type (btree/hash/gin/gist/spgist/brin/clustered/nonclustered/xml/fulltext/spatial)                                           |
| `DBRelationship`    | source/targetTableId, source/targetFieldId, source/targetCardinality (`one`\|`many`)                                                             |
| `DBDependency`      | view→table dependencies (computed FK-likes for views)                                                                                            |
| `DBCheckConstraint` | constraint name + expression                                                                                                                     |
| `DBCustomType`      | ENUM / composite (PG ENUMs, MSSQL UDT)                                                                                                           |
| `Area`              | rectangle of background to group tables                                                                                                          |
| `Note`              | sticky note with markdown content                                                                                                                |

## Database support matrix

PostgreSQL (+ Supabase, Timescale), CockroachDB, MySQL, MariaDB, SQL
Server, SQLite (+ Cloudflare D1), Oracle, ClickHouse, Generic. Each
provider declares `DatabaseCapabilities` (`supportsArrays`,
`supportsCustomTypes`, `supportsSchemas`, `supportsComments`,
`supportsCheckConstraints`).

We borrowed the _shape_ of this idea — see
`packages/shared/src/types/connected-account-capabilities.ts`. Same
declarative-table pattern, different vocabulary (our providers include
non-databases like Slack and PagerDuty).

## Features by area

### Importation (4 modes)

1. **Smart Query** — one query per dialect that returns the entire
   schema as a JSON blob. PG version is 408 LOC of nested
   `array_to_string(array_agg(...))` building each entity inline.
2. **DDL paste** — pegás `CREATE TABLE …` and the parser builds the
   diagram. PG parser is 2247 LOC.
3. **DBML import** — `@dbml/parse` + 1100 LOC of their own
   reconciliation. Round-trip with autocomplete in a Monaco editor in
   the side panel.
4. **pg_dump** — dedicated parser for `pg_dump` output.

### Exportation (5 modes)

1. **SQL DDL same-dialect** — deterministic, ~590 LOC PG, ~523 MySQL,
   ~473 SQLite, ~362 MSSQL.
2. **SQL DDL cross-dialect** — `exportBaseSQL` (deterministic) → GPT-4o-mini
   to translate. The only AI dependency in the project. Cached locally.
3. **DBML export** — 1606 LOC, refs inline, comments, cardinalities.
4. **Image** — PNG / JPG / SVG via `html-to-image`. 1×/2×/4× scale
   options, default 4×. Inline SVG styles for cardinality markers so the
   exported diagram survives copy-paste into Figma / Notion.
5. **JSON** — full diagram serializable.

### Canvas + nodes

- **TableNode** — 3 sizes (224 / 337 / 450 px), collapse to 10 fields,
  edit-in-place mode, indicators PK/FK/unique/nullable/increment,
  comments tooltip, drag-to-create-relationship via cursor flotante.
- **AreaNode** — rectangular group container.
- **NoteNode** — sticky note with markdown rendering.
- **RelationshipEdge** — cardinality markers (one / many / mandatory /
  optional), inline popover for editing constraint name + cardinality.
- **DependencyEdge** — distinct dotted style for view→table.
- **TempCursorNode + TempFloatingEdge** — drag UX for relationship
  creation.
- **Marker definitions** — SVG defs for cardinality (crow's-foot, etc.).

### Filter + side panels

- **Canvas filter sidebar** — TreeView grouped by Schema or Area,
  multi-select, contador "visible/total" per group.
- **Tables panel** — list + buscador, click foca en canvas.
- **DBML editor panel** — Monaco con autocomplete, brackets autoclose.
  Edita el DBML y se aplica vía `apply-dbml.ts` (693 LOC) que hace diff
  por id en lugar de remontar todo.
- **Refs panel** — listado de relationships visible aún si la tabla
  está collapsed.
- **Custom types panel** — listado con highlight (hover → resaltar
  tablas que usan ese type).
- **Visuals panel** — tabs de Areas + Notes.

### Top-navbar menus

- **File**: New / Open / Save (⌘S) / Import (DBML/SQL/DB) / Export
  (DBML/SQL/PNG/JPG/SVG) / Delete diagram.
- **Edit**: Undo (⌘Z) / Redo (⇧⌘Z) / Clear all.
- **View**: Toggle side panel (⌘B) / Toggle cardinality / Toggle field
  attributes / Toggle minimap.

### Hotkeys (`react-hotkeys-hook`)

⌘Z / ⇧⌘Z (undo/redo), ⌘S (save), ⌘O (open), ⌘B (sidebar toggle),
Backspace/Delete (eliminar selección), Show All shortcut (fitView).

### Schema diff

`lib/domain/diff/*` — 7 tipos (table, field, index, check-constraint,
relationship, area, note). Compara dos diagramas, devuelve added /
removed / changed. UI lo usa para colorear el canvas.

### AI assist

- **DDL cross-dialect translation** — Vercel AI SDK + OpenAI.
- **LLM-based JSON repair** — si la "Smart Query" devuelve JSON
  malformado, intenta reparar con el LLM (cap de 2 reintentos).

### Persistence

Dexie/IndexedDB local (no requiere backend). 50-step undo/redo via
custom hook. "Last saved" indicator. Auto-save on every mutation.

## What we shipped (using chartdb as guide, original code)

| Feature                                | Where                                                         | Lines | chartdb equivalent                  |
| -------------------------------------- | ------------------------------------------------------------- | ----: | ----------------------------------- |
| `/api/sql/metadata` rich introspection | `backend/src/routes/sql.routes.ts`                            |  ~270 | 408 LOC postgres-script.ts          |
| Typed metadata model                   | `frontend/lib/sql/metadata.ts`                                |  ~190 | metadata-types/\*                   |
| `SchemaDiagram` canvas                 | `frontend/components/SQLEditor/SchemaDiagram/`                |  ~390 | editor-page/canvas/\*               |
| Schema diff (JSON snapshots)           | `frontend/lib/sql/diff.ts`                                    |  ~210 | domain/diff/\*                      |
| DBML export                            | `frontend/lib/sql/dbml-export.ts`                             |  ~150 | 1606 LOC dbml-export.ts             |
| Provider capability matrix             | `packages/shared/src/types/connected-account-capabilities.ts` |  ~150 | DATABASE_CAPABILITIES               |
| Runbook lineage backend                | `backend/src/routes/runbook.routes.ts` (`/lineage`)           |   ~85 | n/a (our domain)                    |
| Runbook lineage frontend               | `frontend/components/Lineage/LineageCanvas.tsx`               |  ~280 | n/a (our domain)                    |
| YAML diff-apply                        | `frontend/lib/canvas/reconcile.ts`                            |  ~110 | apply-dbml's incremental reconciler |
| Diagram PNG/SVG export                 | `frontend/hooks/useDiagramExport.ts`                          |  ~100 | export-image-context                |

## What we did NOT take

- Their **DDL parser** (2247 LOC PG) — our users connect to live PG via
  ConnectedAccount; pasting raw DDL is a niche path.
- Their **AI cross-dialect SQL translation** — our deploy story doesn't
  assume an OpenAI key, and migrating PG → MySQL is not in our roadmap.
- Their **i18next + Helmet + react-helmet-async** stack — we do
  inline EN/ES per the project convention (CLAUDE.md).
- Their **Dexie** browser-only persistence — we have a backend.
- Their **Areas + Notes** as schema canvas primitives — we already have
  Frame and Note in the runbook editor, which serves the same purpose
  in our domain.
- Their **edit-on-canvas mode for tables** — the SQL editor is meant for
  _viewing_ the schema; mutating it lives in the connected DB (or, if
  the user wants offline editing, in their own DDL workflow).

## Open follow-ups (deferred, not done)

- **Multi-DB introspection** (MySQL / SQL Server / SQLite). Today the
  `/api/sql/metadata` endpoint is PG-only because that's the only
  backend connector we ship. When we add a MySQL connector the script
  would extend; the frontend types and diagram are already DB-agnostic.
- **DBML import** — pegar DBML, generar metadata, pintar diagrama. Útil
  if a user wants to draft a schema before connecting a DB. Requires a
  DBML parser dependency or our own.
- **Index visualizer** — today indexes ride on the table node only
  implicitly (PK badge). chartdb has a panel that lists every index.
  Worth doing when we add a "performance review" tab.
- **Custom type panel** — for PG ENUMs and composite types. Backend
  query already returns this data; UI not yet built.

## Reproducing

```bash
# Clone the latest chartdb release
git clone --depth 1 https://github.com/chartdb/chartdb.git /tmp/chartdb

# Read alongside our own files. Comparable surfaces:
#   chartdb/src/lib/domain/db-table.ts          ↔ frontend/lib/sql/metadata.ts
#   chartdb/src/lib/data/sql-export/...         ↔ frontend/lib/sql/dbml-export.ts
#   chartdb/src/pages/editor-page/canvas/*      ↔ frontend/components/SQLEditor/SchemaDiagram/*
#   chartdb/src/lib/domain/diff/*               ↔ frontend/lib/sql/diff.ts
```

If you want to verify the "this is original code" claim, the line-count
deltas in the table above are a good starting point — we ship 5–10× less
code per feature, which would not be true if any file were ported.
