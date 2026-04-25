import { NanoRun } from '@nanorun/sdk';
import { requireConfig } from '../config';
import { colors, symbols } from '../colors';

export interface LogsCommandOptions {
  /** Tail live: keep the connection open and print entries as they arrive. */
  follow?: boolean;
  /** Resume cursor (redis stream id). Useful to pick up after a dropped tail. */
  fromId?: string;
  /** Max entries per snapshot (default 1000). Ignored in --follow mode. */
  count?: string;
}

/**
 * `nanorun logs <runId>` — dump a run's log stream.
 *
 * Two modes:
 *   - snapshot (default): prints the current log buffer and exits. Pass
 *     `--from-id=<id>` to paginate through a long run.
 *   - follow (`-f` / `--follow`): tails live via SSE; prints entries as
 *     the runtime emits them. Ctrl-C to stop.
 *
 * Output is plain text: one line per entry, `[ISO-timestamp] message`.
 * Structured metadata is appended only in follow mode when the --verbose
 * flag is set (future); today we keep the line terse.
 */
export async function logsCommand(runId: string, options: LogsCommandOptions = {}): Promise<void> {
  const config = requireConfig();
  const client = new NanoRun(config);

  try {
    if (options.follow) {
      // Ctrl-C cleanly aborts the tail. The SSE reader closes the
      // underlying socket so the server stops its XREAD BLOCK loop
      // right away.
      const controller = new AbortController();
      const onSigint = (): void => {
        controller.abort();
        process.off('SIGINT', onSigint);
      };
      process.on('SIGINT', onSigint);

      for await (const entry of client.tailLogs(runId, {
        fromId: options.fromId,
        signal: controller.signal,
      })) {
        process.stdout.write(formatLine(entry));
      }
      return;
    }

    // Snapshot mode — one bounded page, then exit. The server caps
    // count at 10k so we don't bother paginating in the CLI yet; if
    // a user hits the cap they can pass --from-id to walk the rest.
    const parsedCount = options.count ? Number.parseInt(options.count, 10) : undefined;
    const res = await client.getLogs(runId, {
      fromId: options.fromId,
      count: Number.isFinite(parsedCount) ? parsedCount : undefined,
    });
    for (const entry of res.entries) {
      process.stdout.write(formatLine(entry));
    }
    if (res.totalApprox && res.totalApprox > res.entries.length) {
      process.stderr.write(
        colors.dim(
          `\n… ${res.entries.length} of ~${res.totalApprox} lines shown. ` +
            `Pass --from-id=${res.nextFromId ?? ''} to continue.\n`
        )
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(colors.red(`${symbols.cross} ${msg}`));
    process.exit(1);
  }
}

function formatLine(entry: { timestamp: string; message: string }): string {
  // Keep the terminal output shell-friendly: one line per entry, no
  // ANSI noise so `nanorun logs … | grep` still works.
  return `[${entry.timestamp}] ${entry.message}\n`;
}
