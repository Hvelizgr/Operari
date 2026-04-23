import { Cairn } from '@cairn/sdk';
import { requireConfig } from '../../config';
import { colors, symbols, statusColor } from '../../colors';

export interface GrantFlags {
  comment?: string;
  json?: boolean;
}

export async function approvalGrantCommand(approvalId: string, opts: GrantFlags = {}) {
  const config = requireConfig();
  const client = new Cairn(config);

  try {
    const result = await client.grantApproval(approvalId, { comment: opts.comment });

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
    if (result.executionResumed) {
      console.log(`${colors.green(symbols.check)} ${colors.green('Execution resumed.')}`);
    } else {
      console.log(
        `${colors.yellow(symbols.dot)} ${colors.yellow('Approval recorded but execution did not resume — check the run status.')}`
      );
    }
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(colors.red(`${symbols.cross} ${msg}`));
    process.exit(1);
  }
}
