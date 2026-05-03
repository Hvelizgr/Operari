#!/bin/sh
# operari-tee — Fly Machine sidecar wrapper.
#
# Runs the user command and pipes stdout/stderr both to the
# machine's stdio (so Fly's own log layer still captures everything)
# AND to the Operari chunk-receiver endpoint signed with HMAC-SHA256.
# The runner reads from the chunk buffer at finish-time so the
# RunnerResult ends up with real stdout/stderr instead of empty
# strings.
#
# Required env (injected by FlyMachineRunner.buildEnv when the
# sidecar is configured):
#   OPERARI_CALLBACK_URL     POST target (chunk receiver).
#   OPERARI_CALLBACK_SECRET  Shared HMAC secret. Same value the
#                            backend's OPERARI_RUN_CHUNK_SECRET uses
#                            to verify the X-Operari-Sig header.
#
# The Fly platform exposes the machine's id in FLY_MACHINE_ID; we
# use that as the buffer key so the receiver can route the chunks
# back to the right run.
#
# Resilience:
#   - If any required env is missing we exec the user command
#     directly and skip the sidecar — the runner falls back to v1
#     (empty logs) in that case, which is the documented contract.
#   - Each curl POST is bounded to 5s and uses `|| true` so a
#     temporary network blip does not kill the run. The line still
#     reaches Fly's stdio, so operators can recover output via the
#     `fly logs` CLI even when the sidecar drops.
#
# Dependencies the runner image must provide:
#   sh, sed, mktemp, openssl, curl
#
# Reference Dockerfile lives next to this script.

set -eu

USER_CMD="${1:-}"
if [ -z "$USER_CMD" ]; then
  echo "operari-tee: missing command argument" >&2
  exit 64
fi

CB_URL="${OPERARI_CALLBACK_URL:-}"
CB_SEC="${OPERARI_CALLBACK_SECRET:-}"
MID="${FLY_MACHINE_ID:-}"

if [ -z "$CB_URL" ] || [ -z "$CB_SEC" ] || [ -z "$MID" ]; then
  # Sidecar not configured — fall through to v1 behaviour.
  exec sh -c "$USER_CMD"
fi

post_chunk() {
  s="$1"
  t="$2"
  # Escape backslashes, double-quotes, control chars, then fold
  # newlines into \n so the JSON body is valid on a single line.
  esc=$(printf '%s' "$t" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r/\\r/g')
  body=$(printf '{"machineId":"%s","stream":"%s","text":"%s\\n"}' "$MID" "$s" "$esc")
  sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$CB_SEC" -hex | sed 's/^.* //')
  curl -fsS --max-time 5 -X POST \
    -H 'Content-Type: application/json' \
    -H "X-Operari-Sig: $sig" \
    -d "$body" "$CB_URL" >/dev/null 2>&1 || true
}

TMPDIR_BASE="${TMPDIR:-/tmp}"
WORK=$(mktemp -d "$TMPDIR_BASE/operari-tee.XXXXXX")
OUT="$WORK/out"
ERR="$WORK/err"
mkfifo "$OUT" "$ERR"

# Stream readers — dump to the matching stdio AND POST.
( while IFS= read -r line; do
    printf '%s\n' "$line"
    post_chunk stdout "$line"
  done < "$OUT" ) &
OUT_PID=$!

( while IFS= read -r line; do
    printf '%s\n' "$line" >&2
    post_chunk stderr "$line"
  done < "$ERR" ) &
ERR_PID=$!

# Run the user command, redirecting through the FIFOs. `|| true`
# captures the exit code without aborting the cleanup path below.
EXIT=0
sh -c "$USER_CMD" > "$OUT" 2> "$ERR" || EXIT=$?

# Closing the FIFOs lets the readers see EOF and exit cleanly.
exec 1>&- 2>&-
wait "$OUT_PID" 2>/dev/null || true
wait "$ERR_PID" 2>/dev/null || true

rm -rf "$WORK"
exit "$EXIT"
