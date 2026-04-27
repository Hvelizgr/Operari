import { Command } from 'commander';
import { loginCommand } from './commands/login';
import { logoutCommand } from './commands/logout';
import { whoamiCommand } from './commands/whoami';
import { listCommand } from './commands/list';
import { runCommand } from './commands/run';
import { statusCommand } from './commands/status';
import { logsCommand } from './commands/logs';
import { auditVerifyCommand } from './commands/audit/verify';
import { approvalGrantCommand } from './commands/approval/grant';
import { approvalRejectCommand } from './commands/approval/reject';
import { rundeckImportCommand } from './commands/import/rundeck';

const program = new Command();

program.name('operari').description('Run Operari runbooks from your terminal').version('0.1.0');

program
  .command('login')
  .description('Authenticate with Operari')
  .option('--api-key <key>', 'API key (skip the prompt)')
  .option('--base-url <url>', 'Server URL (skip the prompt)')
  .action(loginCommand);

program.command('logout').description('Clear stored credentials').action(logoutCommand);

program.command('whoami').description('Show current login info').action(whoamiCommand);

program.command('list').alias('ls').description('List available runbooks').action(listCommand);

program
  .command('run <slug>')
  .description('Trigger a runbook and stream output')
  .option(
    '-v, --var <key=value>',
    'Set a variable (repeatable)',
    (val: string, prev: string[] = []) => [...prev, val],
    []
  )
  .option('--async', 'Trigger and return immediately, do not wait')
  .option('--timeout <seconds>', 'Max time to wait for completion', '300')
  .action(runCommand);

program.command('status <runId>').description('Get the status of a run').action(statusCommand);

program
  .command('logs <runId>')
  .description("Print a run's log stream (snapshot or live tail)")
  .option('-f, --follow', 'Tail live via SSE; prints entries as the runtime emits them')
  .option('--from-id <id>', 'Resume cursor (redis stream id) — useful after a dropped tail')
  .option('--count <n>', 'Max entries per snapshot (1-10000, default 1000)')
  .action(logsCommand);

const audit = program.command('audit').description('Tamper-evident audit log operations');

audit
  .command('verify')
  .description("Verify the integrity of this tenant's audit chain")
  .option('--from-seq <seq>', 'Start verification at this seq instead of the beginning')
  .option('--page-size <n>', 'Rows fetched per page (1-10000, default 1000)')
  .option('--json', 'Print machine-readable JSON instead of pretty output')
  .action(auditVerifyCommand);

const approval = program.command('approval').description('Resolve human-in-the-loop approvals');

approval
  .command('grant <approvalId>')
  .description('Grant a pending approval and resume the execution')
  .option('-c, --comment <text>', 'Comment recorded next to the approval')
  .option('--json', 'Print machine-readable JSON instead of pretty output')
  .action(approvalGrantCommand);

approval
  .command('reject <approvalId>')
  .description('Reject a pending approval and cancel the execution')
  .option('-c, --comment <text>', 'Comment recorded next to the rejection')
  .option('--json', 'Print machine-readable JSON instead of pretty output')
  .action(approvalRejectCommand);

const importCmd = program
  .command('import')
  .description('Import runbooks from other automation tools');

importCmd
  .command('rundeck <file>')
  .description('Convert a Rundeck jobs.yaml export to Operari runbooks (stub)')
  .option('-o, --output <dir>', 'Output directory for generated runbooks', './runbooks')
  .option('--json', 'Print machine-readable JSON instead of pretty output')
  .action(rundeckImportCommand);

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});
