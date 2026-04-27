import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { colors, symbols } from '../../colors';

interface RundeckImportOptions {
  output?: string;
  json?: boolean;
}

/**
 * Stub: parses a Rundeck `jobs.yaml` file and prints the runbooks it would
 * generate. Wedge marketing per IMPLEMENTACION_NANORUN.md P2 #18 — the goal
 * is to give Rundeck users a one-line escape hatch.
 *
 * Currently:
 *   - Reads and parses the file (best-effort, no real Rundeck schema yet)
 *   - Detects job count and surfaces the field shapes
 *   - Prints what Operari runbooks WOULD be generated
 *   - Does NOT write any files
 *   - Does NOT call the server
 *
 * Real conversion is tracked in IMPLEMENTACION_NANORUN.md.
 */
export async function rundeckImportCommand(file: string, options: RundeckImportOptions) {
  const absPath = resolve(process.cwd(), file);
  let raw: string;
  try {
    raw = await readFile(absPath, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(colors.red(`${symbols.cross} Could not read ${absPath}: ${msg}`));
    process.exit(1);
  }

  // Heuristic parse — Rundeck job exports are YAML lists of jobs with a
  // top-level `name`, `description`, `sequence.commands[]`. We deliberately
  // do not pull in a YAML dep yet; this stub only needs counts.
  const jobBlocks = raw.split(/^- name:/m).slice(1);
  const jobCount = jobBlocks.length;

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          status: 'stub',
          file: absPath,
          detectedJobs: jobCount,
          plannedRunbooks: jobCount,
          notImplemented: [
            'YAML schema parsing',
            'Rundeck step → Operari executor mapping',
            'Variable substitution ($RD_OPTION_*)',
            'Node filter → runner selection',
            'Schedule → trigger conversion',
          ],
        },
        null,
        2
      )
    );
    return;
  }

  console.log(colors.bold(`${symbols.arrow} Rundeck import (stub)`));
  console.log(colors.dim(`  source: ${absPath}`));
  console.log(colors.dim(`  detected jobs: ${jobCount}`));
  console.log();
  console.log(`Would generate ${colors.cyan(String(jobCount))} runbook(s) under ./runbooks/`);
  console.log();
  console.log(colors.dim('Not yet implemented in this stub:'));
  console.log(colors.dim('  · Full YAML schema parsing'));
  console.log(colors.dim('  · Rundeck step → Operari executor mapping'));
  console.log(colors.dim('  · Variable substitution ($RD_OPTION_* → {{vars.*}})'));
  console.log(colors.dim('  · Node filter → runner selection'));
  console.log(colors.dim('  · Schedule → trigger conversion'));
}
