/**
 * Which steps may run again after a crash interrupted them mid-execution
 * (step.started with no terminal event). Re-running is only safe when a
 * second run cannot repeat a side effect: pure data steps, flow control,
 * waits, and reads. Everything else, including every integration step,
 * makes the run be abandoned instead, because a half-landed POST, SQL
 * write or deploy cannot be told apart from one that never happened.
 */

export interface ReplayNode {
  type: string;
  config?: unknown;
}

const PURE_TYPES = new Set([
  // flow control
  'operari.if',
  'operari.switch',
  'Condition',
  'If',
  'Switch',
  'wait',
  'Delay',
  'Trigger',
  'operari.webhook',
  'operari.cron',
  'operari.manualTrigger',
  'Webhook',
  'Schedule',
  'custom.frame',
  'custom.note',
  // data shaping, no I/O
  'operari.set',
  'operari.crypto',
  'operari.dateTime',
  'operari.stopAndError',
  'Transform',
  'operari.json',
  'operari.filter',
  'operari.sort',
  'operari.limit',
  'operari.removeDuplicates',
  'operari.aggregate',
  'operari.merge',
  'operari.text',
  'operari.base64',
  'operari.csv',
  'operari.yaml',
  'operari.jwt',
  'operari.url',
  'operari.renameKeys',
  'operari.splitOut',
  'operari.compareDatasets',
  'operari.summarize',
  'operari.html',
  'operari.xml',
  'operari.ical',
  'operari.rss',
  'StoreGet',
]);

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function field(config: unknown, name: string): unknown {
  return config && typeof config === 'object'
    ? (config as Record<string, unknown>)[name]
    : undefined;
}

export function isReplaySafe(node: ReplayNode): boolean {
  if (PURE_TYPES.has(node.type)) return true;
  if (node.type === 'operari.httpRequest' || node.type === 'HTTP') {
    const method = String(field(node.config, 'method') ?? 'GET').toUpperCase();
    return READ_METHODS.has(method);
  }
  if (node.type === 'operari.database') {
    const op = field(node.config, 'operation');
    return op === 'introspect' || op === 'health';
  }
  return false;
}
