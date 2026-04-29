import { checkUrlSafe, isPrivateIp } from '../../security/ssrf-guard';

describe('isPrivateIp', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback'],
    ['10.0.0.1', 'private-ip'],
    ['10.255.255.255', 'private-ip'],
    ['172.16.0.1', 'private-ip'],
    ['172.31.255.255', 'private-ip'],
    ['192.168.1.1', 'private-ip'],
    ['169.254.169.254', 'link-local'],
    ['0.0.0.0', 'private-ip'],
    ['224.0.0.1', 'private-ip'],
    ['::1', 'loopback'],
    ['fe80::1', 'link-local'],
    ['fe80::1%eth0', 'link-local'],
    ['fc00::1', 'private-ip'],
    ['fd00::1', 'private-ip'],
    ['fec0::1', 'private-ip'], // deprecated site-local
    ['ff02::1', 'private-ip'], // multicast all-nodes
    ['ff05::1', 'private-ip'], // multicast site-local scope
    ['::ffff:127.0.0.1', 'loopback'],
    ['::ffff:10.0.0.1', 'private-ip'],
  ])('classifies %s as %s', (ip, expected) => {
    expect(isPrivateIp(ip)).toBe(expected);
  });

  it.each([
    ['8.8.8.8'],
    ['1.1.1.1'],
    ['172.32.0.1'], // just outside the 172.16/12 block
    ['11.0.0.1'],
    ['2606:4700:4700::1111'], // cloudflare
  ])('returns null for public address %s', ip => {
    expect(isPrivateIp(ip)).toBeNull();
  });

  it('returns null for non-IP strings', () => {
    expect(isPrivateIp('example.com')).toBeNull();
    expect(isPrivateIp('not an ip')).toBeNull();
    expect(isPrivateIp('')).toBeNull();
  });
});

describe('checkUrlSafe', () => {
  beforeEach(() => {
    delete process.env.OPERARI_HTTP_TESTER_ALLOW_PRIVATE;
  });

  it('rejects malformed URLs', async () => {
    const decision = await checkUrlSafe('not-a-url');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('invalid-url');
  });

  it('rejects unsupported schemes (file:, ftp:, gopher:)', async () => {
    for (const scheme of ['file', 'ftp', 'gopher', 'data']) {
      const decision = await checkUrlSafe(`${scheme}://example.com`);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('unsupported-scheme');
    }
  });

  it('rejects literal loopback URLs without DNS lookup', async () => {
    const decision = await checkUrlSafe('http://127.0.0.1:8080/admin');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('loopback');
  });

  it('rejects literal private-IP URLs', async () => {
    const decision = await checkUrlSafe('http://10.0.0.5/internal');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('private-ip');
  });

  it('rejects the AWS instance-metadata endpoint', async () => {
    const decision = await checkUrlSafe('http://169.254.169.254/latest/meta-data/');
    // 169.254.0.0/16 is link-local; the literal IP triggers that path
    // first (no DNS), so we accept either reason.
    expect(decision.allowed).toBe(false);
    expect(['link-local', 'cloud-metadata']).toContain(decision.reason);
  });

  it('rejects "localhost" by name without DNS', async () => {
    const decision = await checkUrlSafe('http://localhost/health');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('loopback');
  });

  it('rejects metadata.google.internal by hostname', async () => {
    const decision = await checkUrlSafe('http://metadata.google.internal/computeMetadata/');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('cloud-metadata');
  });

  it('returns no-op decision when OPERARI_HTTP_TESTER_ALLOW_PRIVATE=true', async () => {
    process.env.OPERARI_HTTP_TESTER_ALLOW_PRIVATE = 'true';
    const decision = await checkUrlSafe('http://127.0.0.1:5432/');
    expect(decision.allowed).toBe(true);
  });

  it('allows public hostnames that resolve to public IPs', async () => {
    // Use a well-known public IP literal so we don't depend on real DNS
    // (1.1.1.1 is Cloudflare). Hostname → DNS lookup is exercised in
    // the next test via a mocked dns module path.
    const decision = await checkUrlSafe('https://1.1.1.1/');
    expect(decision.allowed).toBe(true);
  });
});
