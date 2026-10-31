#!/usr/bin/env bash
# Re-renders the landing diagrams (frontend/public/diagrams/) from their
# sources in docs/diagrams/src/ with Archify. Each source pins
# meta.repository.revision: when the code it cites changes, update the
# cited line numbers and that revision together, then run this.
set -euo pipefail

ARCHIFY="${ARCHIFY:-$HOME/.claude/skills/archify/bin/archify.mjs}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ARCHIFY" ]]; then
  echo "Archify not found at $ARCHIFY (set ARCHIFY=/path/to/archify.mjs)" >&2
  exit 1
fi

for src in docs/diagrams/src/*.json; do
  type=$(node -p "require('./$src').diagram_type")
  out=$(node -p "require('./$src').meta.output")
  echo "→ $src ($type) → $out"
  node "$ARCHIFY" finalize "$type" "$src" "$out" --repo-root . --quality showcase \
    --out-dir "${TMPDIR:-/tmp}/operari-diagrams/$(basename "$src" .json)"
done
