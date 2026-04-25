import { NanoRun, AuditVerifyOptions } from '@nanorun/sdk';
import { requireConfig } from '../../config';
import { colors, symbols } from '../../colors';

export interface AuditVerifyFlags {
  fromSeq?: string;
  pageSize?: string;
  json?: boolean;
}

export async function auditVerifyCommand(opts: AuditVerifyFlags = {}) {
  const config = requireConfig();
  const client = new NanoRun(config);

  const requestOptions: AuditVerifyOptions = {};
  if (opts.fromSeq !== undefined) {
    if (!/^\d+$/.test(opts.fromSeq)) {
      console.error(colors.red(`${symbols.cross} --from-seq must be a non-negative integer`));
      process.exit(2);
    }
    requestOptions.fromSeq = opts.fromSeq;
  }
  if (opts.pageSize !== undefined) {
    const n = Number.parseInt(opts.pageSize, 10);
    if (!Number.isInteger(n) || n <= 0 || n > 10_000) {
      console.error(
        colors.red(`${symbols.cross} --page-size must be an integer between 1 and 10000`)
      );
      process.exit(2);
    }
    requestOptions.pageSize = n;
  }

  try {
    const result = await client.verifyAudit(requestOptions);

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.intact ? 0 : 1);
    }

    console.log(colors.bold('NanoRun audit chain'));
    console.log(`  ${colors.dim('Tenant:')}      ${result.tenantId}`);
    console.log(`  ${colors.dim('Events:')}      ${result.eventCount}`);
    console.log(`  ${colors.dim('Verified at:')} ${new Date(result.verifiedAt).toLocaleString()}`);
    console.log();

    if (result.intact) {
      console.log(
        `${colors.green(symbols.check)} ${colors.bold(colors.green('Chain is intact.'))}`
      );
      console.log(
        colors.dim('  Every hash recomputes correctly and the seq column is contiguous.')
      );
      process.exit(0);
    }

    console.log(`${colors.red(symbols.cross)} ${colors.bold(colors.red('Chain is BROKEN.'))}`);
    if (result.firstBrokenSeq) {
      console.log(`  ${colors.dim('First broken seq:')}    ${colors.red(result.firstBrokenSeq)}`);
      console.log(colors.dim("    A row's recorded hash does not match its recomputed hash."));
      console.log(
        colors.dim(
          '    Likely cause: someone bypassed the immutability trigger and edited the row.'
        )
      );
    }
    if (result.firstGapAfterSeq) {
      console.log(`  ${colors.dim('First gap after seq:')} ${colors.red(result.firstGapAfterSeq)}`);
      console.log(colors.dim('    The seq column has a hole here, meaning a row was deleted.'));
    }
    process.exit(1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(colors.red(`${symbols.cross} ${msg}`));
    process.exit(1);
  }
}
