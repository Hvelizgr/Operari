import { NanoRun } from '@cairn/sdk';
import { requireConfig } from '../config';
import { colors, symbols, statusColor } from '../colors';

function formatDuration(ms: number | null): string {
    if (ms === null) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

export async function statusCommand(runId: string) {
    const config = requireConfig();
    const client = new NanoRun(config);

    try {
        const run = await client.getRun(runId);

        console.log(colors.bold(`Run ${run.id}`));
        console.log(`  ${colors.dim('Runbook:')} ${run.runbook.name}`);
        console.log(`  ${colors.dim('Status:')}  ${statusColor(run.status)}`);
        console.log(`  ${colors.dim('Trigger:')} ${run.trigger}`);
        console.log(`  ${colors.dim('Started:')} ${new Date(run.startedAt).toLocaleString()}`);
        if (run.completedAt) {
            console.log(`  ${colors.dim('Done:')}    ${new Date(run.completedAt).toLocaleString()}`);
            console.log(`  ${colors.dim('Duration:')} ${formatDuration(run.duration)}`);
        }
        if (run.error) {
            console.log(`  ${colors.red('Error:')}   ${run.error}`);
        }

        console.log();
        console.log(colors.bold(`Steps (${run.steps.length}):`));
        for (const step of run.steps) {
            const dur = formatDuration(step.duration);
            const icon =
                step.status === 'SUCCESS'
                    ? colors.green(symbols.check)
                    : step.status === 'FAILED'
                        ? colors.red(symbols.cross)
                        : colors.dim(symbols.circle);
            console.log(`  ${icon} ${step.name} ${colors.dim('(' + step.type + ', ' + dur + ')')}`);
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(colors.red(`${symbols.cross} ${msg}`));
        process.exit(1);
    }
}
