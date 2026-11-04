import { randomBytes } from 'crypto';

export type LogStream = 'stdout' | 'stderr';

export interface LogChunk {
  stream: LogStream;
  seq: number;
  text: string;
}

interface Registration {
  onChunk: (chunk: LogChunk) => void;
  expiresAt: number;
}

/**
 * Remote runners (Fly Machines) cannot hand output back inline, so the
 * process inside the machine POSTs each line to
 * `/api/internal/runner-logs/<token>`. The token is 32 random bytes minted
 * per machine and only known to the backend and that machine, which makes
 * it the authentication; it stops working when the run ends or expires.
 */
export class LogCallbackRegistry {
  private readonly byToken = new Map<string, Registration>();

  constructor(private readonly now: () => number = Date.now) {}

  register(onChunk: (chunk: LogChunk) => void, ttlMs: number): { token: string; close(): void } {
    const token = randomBytes(32).toString('base64url');
    this.byToken.set(token, { onChunk, expiresAt: this.now() + ttlMs });
    return { token, close: () => this.byToken.delete(token) };
  }

  /** False when the token is unknown or expired. */
  deliver(token: string, chunk: LogChunk): boolean {
    const reg = this.byToken.get(token);
    if (!reg) return false;
    if (reg.expiresAt < this.now()) {
      this.byToken.delete(token);
      return false;
    }
    reg.onChunk(chunk);
    return true;
  }

  get size(): number {
    return this.byToken.size;
  }
}

export const runnerLogCallbacks = new LogCallbackRegistry();

/**
 * Runs inside the machine: executes the step's command (base64 in
 * OPERARI_COMMAND_B64, so no quoting survives into the shell line) and
 * POSTs every stdout and stderr line, numbered per stream, to
 * OPERARI_LOG_URL with curl or busybox wget. Exits with the command's
 * status so the machine's exit code stays the step's. A posting failure
 * never fails the step: output is best effort, the exit code is not.
 */
export const LOG_WRAPPER_SCRIPT = `#!/bin/sh
cmd=$(printf '%s' "$OPERARI_COMMAND_B64" | base64 -d)
shell="\${OPERARI_SHELL:-sh}"
if command -v curl >/dev/null 2>&1; then
  send() { curl -fsS -m 10 -X POST -H 'content-type: text/plain' --data-binary @- "$1" >/dev/null 2>&1; }
elif command -v wget >/dev/null 2>&1; then
  send() { tmp=$(mktemp); cat >"$tmp"; wget -q -T 10 -O /dev/null --header='content-type: text/plain' --post-file="$tmp" "$1" >/dev/null 2>&1; rm -f "$tmp"; }
else
  send() { cat >/dev/null; }
fi
post() {
  n=0
  while IFS= read -r line || [ -n "$line" ]; do
    n=$((n + 1))
    printf '%s\\n' "$line" | send "$OPERARI_LOG_URL?stream=$1&seq=$n" || true
  done
}
rc=/tmp/.operari-rc
{ { { "$shell" -c "$cmd"; echo $? >"$rc"; } | post stdout; } 2>&1 1>&3 | post stderr; } 3>&1
status=$(cat "$rc" 2>/dev/null || echo 1)
exit "$status"
`;
