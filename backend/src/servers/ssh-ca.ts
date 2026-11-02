import type { PrismaClient } from '@prisma/client';
import { execFile as nodeExecFile } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import type { SecretCipher } from '../security/secret-cipher';

export type ExecFileFn = (file: string, args: string[]) => Promise<void>;

const defaultExecFile: ExecFileFn = (file, args) =>
  new Promise((resolve, reject) => {
    nodeExecFile(file, args, { timeout: 15_000 }, err => (err ? reject(err) : resolve()));
  });

/** Certificates live long enough to connect and run one step, no more. */
export const CERT_TTL_SECONDS = 5 * 60;

export interface IssuedCertificate {
  privateKey: string;
  certificate: string;
}

/**
 * Per-workspace SSH certificate authority. The CA key is generated once,
 * stored encrypted (AAD bound to the tenant), and only decrypted into a
 * 0700 temp dir for the duration of one `ssh-keygen -s` call.
 */
export class SshCertificateService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cipher: SecretCipher,
    private readonly execFile: ExecFileFn = defaultExecFile
  ) {}

  private aad(tenantId: string): string {
    return `ssh-ca:${tenantId}`;
  }

  async publicKey(tenantId: string): Promise<string> {
    const existing = await this.prisma.sshCertificateAuthority.findUnique({ where: { tenantId } });
    if (existing) return existing.publicKey;
    const dir = mkdtempSync(join(tmpdir(), 'operari-ca-'));
    try {
      const keyPath = join(dir, 'ca');
      await this.execFile('ssh-keygen', [
        '-q',
        '-t',
        'ed25519',
        '-N',
        '',
        '-C',
        `operari-ca-${tenantId}`,
        '-f',
        keyPath,
      ]);
      const publicKey = readFileSync(`${keyPath}.pub`, 'utf8').trim();
      const privateKey = readFileSync(keyPath, 'utf8');
      // Two concurrent first calls: the loser's key is discarded and both
      // return the stored one.
      const row = await this.prisma.sshCertificateAuthority.upsert({
        where: { tenantId },
        create: {
          tenantId,
          publicKey,
          privateKeyEncrypted: this.cipher.encrypt(privateKey, this.aad(tenantId)),
        },
        update: {},
      });
      return row.publicKey;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  /**
   * Fresh ed25519 key plus a certificate for `principal`, valid from one
   * minute ago (clock skew) to CERT_TTL_SECONDS from now, with no agent,
   * port or X11 forwarding.
   */
  async issue(tenantId: string, principal: string, keyId: string): Promise<IssuedCertificate> {
    if (!/^[a-z_][a-z0-9_.-]{0,31}$/i.test(principal)) {
      throw new Error(`invalid ssh principal: ${principal}`);
    }
    await this.publicKey(tenantId);
    const ca = await this.prisma.sshCertificateAuthority.findUniqueOrThrow({ where: { tenantId } });
    const dir = mkdtempSync(join(tmpdir(), 'operari-cert-'));
    try {
      const caPath = join(dir, 'ca');
      const keyPath = join(dir, 'id');
      writeFileSync(caPath, this.cipher.decrypt(ca.privateKeyEncrypted, this.aad(tenantId)), {
        mode: 0o600,
      });
      await this.execFile('ssh-keygen', [
        '-q',
        '-t',
        'ed25519',
        '-N',
        '',
        '-C',
        keyId,
        '-f',
        keyPath,
      ]);
      await this.execFile('ssh-keygen', [
        '-q',
        '-s',
        caPath,
        '-I',
        keyId,
        '-n',
        principal,
        '-V',
        `-1m:+${CERT_TTL_SECONDS}s`,
        '-O',
        'clear',
        '-O',
        'permit-pty',
        `${keyPath}.pub`,
      ]);
      return {
        privateKey: readFileSync(keyPath, 'utf8'),
        certificate: readFileSync(`${keyPath}-cert.pub`, 'utf8').trim(),
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

/** sshd_config lines an admin adds on a server to trust the workspace CA. */
export function caSetupSnippet(publicKey: string): string {
  return [
    `echo '${publicKey}' | sudo tee /etc/ssh/operari_ca.pub`,
    `echo 'TrustedUserCAKeys /etc/ssh/operari_ca.pub' | sudo tee /etc/ssh/sshd_config.d/operari.conf`,
    'sudo systemctl reload ssh',
  ].join('\n');
}
