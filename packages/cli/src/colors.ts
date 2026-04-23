/**
 * Minimal ANSI color helpers — zero deps.
 */
const supportsColor = process.stdout.isTTY && process.env.NO_COLOR !== '1';

function wrap(open: string, close: string) {
  return (text: string) => (supportsColor ? `${open}${text}${close}` : text);
}

export const colors = {
  reset: '\x1b[0m',
  bold: wrap('\x1b[1m', '\x1b[22m'),
  dim: wrap('\x1b[2m', '\x1b[22m'),
  italic: wrap('\x1b[3m', '\x1b[23m'),

  black: wrap('\x1b[30m', '\x1b[39m'),
  red: wrap('\x1b[31m', '\x1b[39m'),
  green: wrap('\x1b[32m', '\x1b[39m'),
  yellow: wrap('\x1b[33m', '\x1b[39m'),
  blue: wrap('\x1b[34m', '\x1b[39m'),
  magenta: wrap('\x1b[35m', '\x1b[39m'),
  cyan: wrap('\x1b[36m', '\x1b[39m'),
  white: wrap('\x1b[37m', '\x1b[39m'),
  gray: wrap('\x1b[90m', '\x1b[39m'),

  bgGreen: wrap('\x1b[42m', '\x1b[49m'),
  bgRed: wrap('\x1b[41m', '\x1b[49m'),
};

export const symbols = {
  check: '✓',
  cross: '✗',
  arrow: '→',
  dot: '•',
  circle: '○',
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
};

export function statusColor(status: string): string {
  const c = colors;
  switch (status.toUpperCase()) {
    case 'SUCCESS':
      return c.green(c.bold('SUCCESS'));
    case 'FAILED':
      return c.red(c.bold('FAILED'));
    case 'RUNNING':
      return c.cyan(c.bold('RUNNING'));
    case 'PENDING':
      return c.gray('PENDING');
    case 'CANCELLED':
      return c.yellow('CANCELLED');
    case 'PAUSED':
      return c.magenta('PAUSED');
    default:
      return status;
  }
}
