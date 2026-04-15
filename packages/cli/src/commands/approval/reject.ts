import { NanoRun } from '@cairn/sdk';
import { requireConfig } from '../../config';
import { colors, symbols, statusColor } from '../../colors';

export interface RejectFlags {
    comment?: string;
    json?: boolean;
}

export async function approvalRejectCommand(approvalId: string, opts: RejectFlags = {}) {
    const config = requireConfig();
    const client = new NanoRun(config);

    try {
        const result = await client.rejectApproval(approvalId, { comment: opts.comment });

        if (opts.json) {
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        }

        console.log(colors.bold(`Approval ${result.id}`));
        console.log(`  ${colors.dim('Status:')}    ${statusColor(result.status)}`);
        console.log(`  ${colors.dim('Run:')}       ${result.executionId}`);
        console.log(`  ${colors.dim('Step:')}      ${result.stepId}`);
        if (result.comment) {
            console.log(`  ${colors.dim('Comment:')}   ${result.comment}`);
        }
        if (result.executionCancelled) {
            console.log(
                `${colors.red(symbols.cross)} ${colors.red('Execution cancelled.')} Downstream steps will not run.`,
            );
        } else {
            console.log(
                `${colors.yellow(symbols.dot)} ${colors.yellow('Approval recorded but execution was not paused — nothing to cancel.')}`,
            );
        }
        process.exit(0);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(colors.red(`${symbols.cross} ${msg}`));
        process.exit(1);
    }
}
