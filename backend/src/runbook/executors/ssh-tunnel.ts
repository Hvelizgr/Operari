import * as net from 'net';
import { Client } from 'ssh2';

export interface TunnelOptions {
  sshHost: string;
  sshPort: number;
  sshUsername: string;
  privateKey: string;
  /** Remote host to forward to (as seen from the SSH server). */
  forwardHost: string;
  /** Remote port to forward to. */
  forwardPort: number;
}

export interface TunnelResult {
  /** Local port assigned by the OS (connect your DB client here). */
  localPort: number;
  /** Call to tear down the tunnel and SSH connection. */
  close: () => Promise<void>;
}

/**
 * Create an SSH tunnel that forwards a local port to a remote host:port
 * through the SSH connection. This is the standard pattern for accessing
 * databases behind a bastion host.
 *
 * Usage:
 *   const tunnel = await createSSHTunnel({ ... });
 *   // connect to localhost:tunnel.localPort
 *   await tunnel.close();
 */
export function createSSHTunnel(
  options: TunnelOptions,
  createClient?: () => Client
): Promise<TunnelResult> {
  return new Promise((resolve, reject) => {
    const client = createClient ? createClient() : new Client();
    const server = net.createServer(sock => {
      client.forwardOut(
        sock.remoteAddress ?? '127.0.0.1',
        sock.remotePort ?? 0,
        options.forwardHost,
        options.forwardPort,
        (err, stream) => {
          if (err) {
            sock.end();
            return;
          }
          sock.pipe(stream).pipe(sock);
        }
      );
    });

    client.on('ready', () => {
      // Listen on port 0 → OS assigns a free port.
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const localPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve({
          localPort,
          close: () =>
            new Promise<void>(res => {
              server.close(() => {
                client.end();
                res();
              });
            }),
        });
      });
    });

    client.on('error', err => {
      server.close();
      reject(new Error(`SSH tunnel failed: ${err.message}`));
    });

    client.connect({
      host: options.sshHost,
      port: options.sshPort,
      username: options.sshUsername,
      privateKey: options.privateKey,
    });
  });
}
