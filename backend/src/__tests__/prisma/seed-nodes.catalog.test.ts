// Pin the seed-nodes.js node-type catalog so a future edit can't
// accidentally drop a property, change an option set, or introduce a
// non-renderable property type. The frontend's DynamicNodeForm is the
// consumer; if a property here doesn't match its switch, the editor
// falls back to a raw JSON textarea and the auto-form UX silently
// regresses.
//
// We import the seed file directly. It exports { NODES } and skips
// the prisma client + auto-run when require.main !== module, so this
// runs without a DB connection.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { NODES } = require('../../../prisma/seed-nodes.js') as {
  NODES: Array<{
    type: string;
    properties?: Array<{
      name: string;
      displayName: string;
      type: 'string' | 'boolean' | 'options' | 'number' | 'secret' | 'sql' | 'color';
      default?: unknown;
      description?: string;
      options?: Array<{ name: string; value: string }>;
      typeOptions?: { rows?: number; expression?: boolean; provider?: string };
    }>;
  }>;
};

const RENDERABLE_TYPES = new Set([
  'string',
  'boolean',
  'options',
  'number',
  'secret',
  'sql',
  'color',
]);

function nodeOf(type: string) {
  const found = NODES.find(n => n.type === type);
  if (!found) throw new Error(`Seed catalog missing node type "${type}"`);
  return found;
}

describe('node-types catalog (seed-nodes.js NODES export)', () => {
  it('exports a non-empty NODES array with unique types', () => {
    expect(Array.isArray(NODES)).toBe(true);
    expect(NODES.length).toBeGreaterThan(10);
    const types = NODES.map(n => n.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('every property has a renderable type so the auto-form does not fall back to JSON', () => {
    for (const node of NODES) {
      for (const p of node.properties ?? []) {
        expect(RENDERABLE_TYPES.has(p.type)).toBe(true);
        expect(p.name.length).toBeGreaterThan(0);
        expect(p.displayName.length).toBeGreaterThan(0);
      }
    }
  });

  it('every options property has a non-empty options array', () => {
    for (const node of NODES) {
      for (const p of node.properties ?? []) {
        if (p.type === 'options') {
          expect(Array.isArray(p.options)).toBe(true);
          expect(p.options!.length).toBeGreaterThan(0);
          for (const opt of p.options!) {
            expect(opt.name).toBeTruthy();
            expect(opt.value).toBeTruthy();
          }
        }
      }
    }
  });

  it('shell exposes the documented config: command, cwd, shell, timeout, failOnNonZeroExit, image', () => {
    const props = (nodeOf('shell').properties ?? []).map(p => p.name);
    expect(props).toEqual(
      expect.arrayContaining(['command', 'cwd', 'shell', 'timeout', 'failOnNonZeroExit', 'image'])
    );
  });

  it('operari.httpRequest has a method options field with the standard verbs', () => {
    const method = nodeOf('operari.httpRequest').properties!.find(p => p.name === 'method')!;
    expect(method.type).toBe('options');
    const verbs = method.options!.map(o => o.value);
    expect(verbs).toEqual(
      expect.arrayContaining(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])
    );
  });

  it('github.commitFile threads a github-scoped secret picker for credentialId', () => {
    const cred = nodeOf('github.commitFile').properties!.find(p => p.name === 'credentialId')!;
    expect(cred.type).toBe('secret');
    expect(cred.typeOptions?.provider).toBe('github');
  });

  it('operari.database exposes a sql-typed query input + a postgres-scoped credential', () => {
    const props = nodeOf('operari.database').properties!;
    const query = props.find(p => p.name === 'query')!;
    expect(query.type).toBe('sql');
    const cred = props.find(p => p.name === 'credentialId')!;
    expect(cred.type).toBe('secret');
    expect(cred.typeOptions?.provider).toBe('postgres');
  });

  it('approval is template-aware: message is multi-row + expression-aware', () => {
    const message = nodeOf('approval').properties!.find(p => p.name === 'message')!;
    expect(message.type).toBe('string');
    expect(message.typeOptions?.rows).toBeGreaterThan(1);
    expect(message.typeOptions?.expression).toBe(true);
  });

  it('notify exposes the channel options + Slack severity colors', () => {
    const props = nodeOf('notify').properties!;
    const channel = props.find(p => p.name === 'channel')!;
    expect(channel.options!.map(o => o.value)).toEqual(
      expect.arrayContaining(['slack', 'discord', 'webhook'])
    );
    const color = props.find(p => p.name === 'color')!;
    expect(color.options!.map(o => o.value)).toEqual(
      expect.arrayContaining(['good', 'warning', 'danger'])
    );
  });

  it('visual-only and trigger-only nodes have no config properties', () => {
    expect(nodeOf('custom.frame').properties ?? []).toHaveLength(0);
    expect(nodeOf('custom.note').properties ?? []).toHaveLength(0);
    expect(nodeOf('operari.webhook').properties ?? []).toHaveLength(0);
  });
});
