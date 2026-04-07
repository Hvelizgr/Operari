import { NanoRun, Run } from '@nanorun/sdk';
import { requireConfig } from '../config';
import { colors, symbols, statusColor } from '../colors';

interface RunOptions {
    var?: string[];
    async?: boolean;
    timeout?: string;
}

function parseVars(vars: string[] = []): Record<string, string> {
    const result: Record<string, string> = {};
    for (const v of vars) {
        const idx = v.indexOf('=');
        if (idx === -1) continue;
        result[v.substring(0, idx)] = v.substring(idx + 1);
    }
    return result;
}

function formatDuration(ms: number | null): string {
    if (ms === null) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

export async function runCommand(slug: string, options: RunOptions = {}) {
    const config = requireConfig();
    const client = new NanoRun(config);
    const variables = parseVars(options.var);

    console.log(`${colors.bold(symbols.dot + ' Running runbook:')} ${colors.cyan(slug)}`);
    if (Object.keys(variables).length > 0) {
        console.log(`  ${colors.dim('Variables:')} ${JSON.stringify(variables)}`);
    }
    console.log();

    let triggered;
    try {
        triggered = await client.trigger(slug, { variables });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(colors.red(`${symbols.cross} ${msg}`));
        process.exit(1);
    }

    console.log(`  ${colors.dim('Run ID:')}  ${triggered.id}`);
    console.log(`  ${colors.dim('Console:')} ${colors.blue(triggered.url)}`);
    console.log();

    if (options.async) {
        console.log(colors.green(`${symbols.check} Triggered (async mode)`));
        return;
    }

    // Stream-poll until completion
    const seenSteps = new Set<string>();
    const pollInterval = 800;
    const startTime = Date.now();
    const timeoutMs = options.timeout ? parseInt(options.timeout) * 1000 : 5 * 60 * 1000;

    let final: Run | null = null;
    while (Date.now() - startTime < timeoutMs) {
        let run: Run;
        try {
            run = await client.getRun(triggered.id);
        } catch (err) {
            console.error(colors.red(`${symbols.cross} Failed to fetch run state`));
            process.exit(1);
        }

        // Print newly seen steps
        for (const step of run.steps) {
            const key = `${step.id}:${step.status}`;
            if (seenSteps.has(key)) continue;
            seenSteps.add(key);

            if (step.status === 'RUNNING') {
                process.stdout.write(`  ${colors.cyan('●')} ${step.name} ${colors.dim('(' + step.type + ')')}\n`);
            } else if (step.status === 'SUCCESS') {
                const dur = formatDuration(step.duration);
                console.log(`  ${colors.green(symbols.check)} ${step.name} ${colors.dim('(' + step.type + ', ' + dur + ')')}`);

                // Show shell stdout if exists
                if (step.type === 'shell' && step.output && typeof step.output === 'object') {
                    const out = step.output as { stdout?: string; stderr?: string };
                    if (out.stdout) {
                        const lines = out.stdout.split('\n');
                        const preview = lines.slice(0, 3).map((l) => `    ${colors.dim('│')} ${colors.gray(l)}`).join('\n');
                        console.log(preview);
                        if (lines.length > 3) {
                            console.log(`    ${colors.dim('│ … (' + (lines.length - 3) + ' more lines)')}`);
                        }
                    }
                }
            } else if (step.status === 'FAILED') {
                console.log(`  ${colors.red(symbols.cross)} ${step.name} ${colors.dim('(' + step.type + ')')}`);
                if (step.error) {
                    console.log(`    ${colors.red('error:')} ${step.error}`);
                }
            }
        }

        if (['SUCCESS', 'FAILED', 'CANCELLED'].includes(run.status)) {
            final = run;
            break;
        }

        await new Promise((r) => setTimeout(r, pollInterval));
    }

    console.log();
    if (!final) {
        console.error(colors.red(`${symbols.cross} Timed out after ${timeoutMs / 1000}s`));
        process.exit(1);
    }

    const totalDur = formatDuration(final.duration);
    console.log(`${statusColor(final.status)}  ${colors.dim('Total:')} ${totalDur}`);

    if (final.status === 'FAILED') {
        process.exit(1);
    }
}
