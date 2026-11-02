import { killOrphans, prefetchImages } from '../../sandbox/housekeeping';

describe('sandbox housekeeping', () => {
  it('kills every labelled container once', () => {
    const calls: string[][] = [];
    const spawnSync = (_cmd: string, args: string[]) => {
      calls.push(args);
      if (args[0] === 'ps') {
        const out = args[3] === 'label=operari.terminal' ? 'aaa\nbbb\n' : 'bbb\nccc\n';
        return { status: 0, stdout: out };
      }
      return { status: 0, stdout: '' };
    };
    expect(killOrphans('docker', spawnSync)).toEqual(['aaa', 'bbb', 'ccc']);
    expect(calls.at(-1)).toEqual(['kill', 'aaa', 'bbb', 'ccc']);
  });

  it('does nothing when there are no orphans or ps fails', () => {
    const calls: string[][] = [];
    const spawnSync = (_cmd: string, args: string[]) => {
      calls.push(args);
      return { status: args[3] === 'label=operari.terminal' ? 1 : 0, stdout: '' };
    };
    expect(killOrphans('docker', spawnSync)).toEqual([]);
    expect(calls.every(a => a[0] === 'ps')).toBe(true);
  });

  it('pulls each image once in the background', () => {
    const pulled: string[] = [];
    prefetchImages('docker', ['alpine:3.20', 'python:3.12-alpine', 'alpine:3.20'], (_c, args) => {
      pulled.push(args[2]);
      return { on: () => undefined };
    });
    expect(pulled).toEqual(['alpine:3.20', 'python:3.12-alpine']);
  });
});
