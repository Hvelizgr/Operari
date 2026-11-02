import type { SandboxClient } from '../sandbox/client';
import type { TerminalOpenRequest } from '../sandbox/protocol';
import type { PtyProcess, TerminalOwner } from './terminal-session';

type DataListener = (data: string) => void;
type ExitListener = (event: { exitCode: number; signal?: number }) => void;

/**
 * A PtyProcess backed by a terminal on the sandbox-runner. Creation is
 * synchronous like node-pty; the remote session opens in the background and
 * anything typed before it is ready is queued. Input goes out strictly in
 * order because each keystroke is its own request.
 */
export class RemotePty implements PtyProcess {
  readonly pid = 0;
  private id: string | null = null;
  private exited = false;
  private detach: (() => void) | null = null;
  private chain: Promise<unknown>;
  private readonly dataListeners = new Set<DataListener>();
  private readonly exitListeners = new Set<ExitListener>();

  constructor(
    private readonly client: SandboxClient,
    owner: TerminalOwner,
    size: { cols: number; rows: number },
    persistent: boolean,
    egress: () => Promise<Pick<TerminalOpenRequest, 'network' | 'allowedHosts'>> = async () => ({
      network: 'open',
    })
  ) {
    this.chain = egress()
      .catch(() => ({ network: 'none' as const }))
      .then(net => client.openTerminal({ ...owner, ...size, persistent, ...net }))
      .then(id => {
        if (this.exited) {
          void client.closeTerminal(id).catch(() => undefined);
          return;
        }
        this.id = id;
        this.detach = client.attachTerminal(
          id,
          line => {
            if (line.t === 'data') this.emitData(line.d);
            else this.emitExit(line.code ?? 1);
          },
          err => {
            if (err && !this.exited) this.emitData(`\r\n[sandbox] ${err.message}\r\n`);
            this.emitExit(err ? 1 : 0);
          }
        );
      })
      .catch((err: Error) => {
        this.emitData(`\r\n[sandbox] ${err.message}\r\n`);
        this.emitExit(1);
      });
  }

  onData(listener: DataListener) {
    this.dataListeners.add(listener);
    return { dispose: () => this.dataListeners.delete(listener) };
  }

  onExit(listener: ExitListener) {
    this.exitListeners.add(listener);
    return { dispose: () => this.exitListeners.delete(listener) };
  }

  write(data: string): void {
    this.enqueue(id => this.client.input(id, data));
  }

  resize(cols: number, rows: number): void {
    this.enqueue(id => this.client.resize(id, cols, rows));
  }

  kill(): void {
    if (this.exited) return;
    this.exited = true;
    this.detach?.();
    this.enqueue(id => this.client.closeTerminal(id), true);
  }

  private enqueue(op: (id: string) => Promise<unknown>, evenIfExited = false): void {
    this.chain = this.chain.then(() => {
      if (!this.id || (this.exited && !evenIfExited)) return;
      return op(this.id).catch(() => undefined);
    });
  }

  private emitData(data: string): void {
    for (const l of this.dataListeners) l(data);
  }

  private emitExit(exitCode: number): void {
    const wasExited = this.exited;
    this.exited = true;
    if (wasExited && this.exitListeners.size === 0) return;
    const listeners = Array.from(this.exitListeners);
    this.exitListeners.clear();
    for (const l of listeners) l({ exitCode });
  }
}
