import {
  DockerEgressController,
  removeOrphanEgressNetworks,
} from '../../sandbox/egress-controller';
import { verifyGrant } from '../../sandbox/egress-proxy';

function fakeDocker(fail: (args: string[]) => string | null = () => null) {
  const calls: string[][] = [];
  const spawnSync = (_bin: string, args: string[]) => {
    calls.push(args);
    const err = fail(args);
    return { status: err ? 1 : 0, stdout: '', stderr: err ?? '' };
  };
  return { calls, spawnSync };
}

describe('DockerEgressController', () => {
  it('starts a locked-down proxy on the upstream network', () => {
    const d = fakeDocker();
    new DockerEgressController({
      dockerBinary: 'docker',
      upstreamNetwork: 'operari-sandbox',
      spawnSync: d.spawnSync,
      proxyScript: 'SCRIPT\n//# sourceMappingURL=egress-proxy.js.map',
    }).start();
    expect(d.calls[0]).toEqual(['rm', '-f', 'operari-egress']);
    const run = d.calls[1];
    expect(run.slice(0, 4)).toEqual(['run', '-d', '--name', 'operari-egress']);
    expect(run).toEqual(
      expect.arrayContaining([
        '--cap-drop=ALL',
        '--read-only',
        '--user',
        '1000:1000',
        '--network',
        'operari-sandbox',
      ])
    );
    expect(run[run.indexOf('-e') + 1]).toBe('OPERARI_EGRESS_PROXY_MAIN=1');
    expect(run.slice(-3)).toEqual(['node', '-e', 'SCRIPT\n']);
  });

  it('gives each sandbox its own internal /29 and a grant only for its hosts', () => {
    const d = fakeDocker();
    const c = new DockerEgressController({
      dockerBinary: 'docker',
      upstreamNetwork: 'n',
      spawnSync: d.spawnSync,
      now: () => 1_000_000,
    });
    const a = c.attach('abc', ['pypi.org'], 60);
    const create = d.calls[0];
    expect(create).toEqual(expect.arrayContaining(['network', 'create', '--internal']));
    expect(create[create.indexOf('--subnet') + 1]).toMatch(/^10\.213\.\d+\.\d+\/29$/);
    expect(d.calls[1]).toEqual([
      'network',
      'connect',
      '--alias',
      'operari-egress',
      'operari-eg-abc',
      'operari-egress',
    ]);
    expect(a.network).toBe('operari-eg-abc');
    const token = decodeURIComponent(new URL(a.env.HTTPS_PROXY).password);
    const secret = (c as unknown as { secret: string }).secret;
    expect(verifyGrant(secret, token, 1000)).toEqual({ hosts: ['pypi.org'], exp: 1060 });
    a.release();
    a.release();
    expect(d.calls.slice(2)).toEqual([
      ['network', 'disconnect', '-f', 'operari-eg-abc', 'operari-egress'],
      ['network', 'rm', 'operari-eg-abc'],
    ]);
  });

  it('retries on a subnet clash and cleans up when connecting the proxy fails', () => {
    let creates = 0;
    const d = fakeDocker(args => {
      if (args[1] === 'create' && creates++ === 0)
        return 'Pool overlaps with other one on this address space';
      if (args[1] === 'connect') return 'no such container';
      return null;
    });
    const c = new DockerEgressController({
      dockerBinary: 'docker',
      upstreamNetwork: 'n',
      spawnSync: d.spawnSync,
    });
    expect(() => c.attach('x', ['pypi.org'], 60)).toThrow(/connect/);
    expect(d.calls.filter(a => a[1] === 'create')).toHaveLength(2);
    expect(d.calls.at(-1)).toEqual(['network', 'rm', 'operari-eg-x']);
  });

  it('removes orphaned sandbox egress networks', () => {
    const calls: string[][] = [];
    const n = removeOrphanEgressNetworks('docker', (_b, args) => {
      calls.push(args);
      return { status: 0, stdout: args[1] === 'ls' ? 'n1\nn2\n' : '', stderr: '' };
    });
    expect(n).toBe(2);
    expect(calls.filter(a => a[1] === 'rm').map(a => a[2])).toEqual(['n1', 'n2']);
  });
});
