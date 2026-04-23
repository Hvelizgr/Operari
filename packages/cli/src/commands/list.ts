import { Cairn } from '@cairn/sdk';
import { requireConfig } from '../config';
import { colors, symbols } from '../colors';

export async function listCommand() {
  const config = requireConfig();
  const client = new Cairn(config);

  try {
    const runbooks = await client.listRunbooks();

    if (runbooks.length === 0) {
      console.log(colors.dim('No runbooks found.'));
      console.log(
        colors.dim(
          `Create one in the editor: ${config.baseURL.replace(':4000', ':3000')}/en/editor`
        )
      );
      return;
    }

    console.log(colors.bold(`${runbooks.length} runbook${runbooks.length === 1 ? '' : 's'}:\n`));

    // Calculate column widths
    const slugCol = Math.max(8, ...runbooks.map(r => (r.slug || r.id.substring(0, 8)).length));
    const nameCol = Math.max(8, ...runbooks.map(r => r.name.length));

    // Header
    console.log(
      `  ${colors.dim('SLUG/ID'.padEnd(slugCol))}  ${colors.dim('NAME'.padEnd(nameCol))}  ${colors.dim('CATEGORY')}`
    );

    for (const rb of runbooks) {
      const slug = rb.slug || rb.id.substring(0, 8);
      const category = rb.category || colors.dim('—');
      console.log(
        `  ${colors.cyan(slug.padEnd(slugCol))}  ${rb.name.padEnd(nameCol)}  ${category}`
      );
    }

    console.log(colors.dim(`\nRun a runbook with: cairn run <slug>`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(colors.red(`${symbols.cross} ${msg}`));
    process.exit(1);
  }
}
