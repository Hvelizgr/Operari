import { EventEmitter } from 'events';
import { DockerRunner, SpawnFn } from '../../../runbook/runners/docker.runner';
import { RunnerError, type RunnerContext } from '../../../runbook/runners/runner.types';

// ---------------------------------------------------------------------------
// Fake spawn — emits scripted stdout/stderr/close events
// ---------------------------------------------------------------------------

interface FakeSpawnScript {
    stdout?: string[];
    stderr?: string[];
    exitCode?: number | null;
    /** Delay before emitting close, lets us test timeouts */
    closeAfterMs?: number;
    /** Throw synchronously on spawn (e.g. ENOENT) */
    throwOnSpawn?: Error;
    /** Emit an 'error' event after spawn (e.g. EACCES) */
    errorEvent?: Error;
}

interface SpawnCall {
    command: string;
    args: string[];
}

const buildFakeSpawn = (script: FakeSpawnScript = {}) => {
    const calls: SpawnCall[] = [];
    const fn: SpawnFn = (command, args) => {
        calls.push({ command, args: [...args] });
        if (script.throwOnSpawn) throw script.throwOnSpawn;

        const stdout = new EventEmitter() as EventEmitter & { on: EventEmitter['on'] };
        const stderr = new EventEmitter();
        const proc = new EventEmitter() as EventEmitter & {
            stdout: typeof stdout;
            stderr: typeof stderr;
            kill: jest.Mock;
        };
        proc.stdout = stdout;
        proc.stderr = stderr;

        let closed = false;
        let scheduled: ReturnType<typeof setTimeout> | undefined;

        const fireClose = (code: number | null) => {
            if (closed) return;
            closed = true;
            if (scheduled) clearTimeout(scheduled);
            proc.emit('close', code);
        };

        proc.kill = jest.fn(() => {
            // Real child_process emits 'close' with null exit code after SIGKILL
            fireClose(null);
        });

        const closeAfter = script.closeAfterMs ?? 0;
        scheduled = setTimeout(() => {
            for (const text of script.stdout ?? []) stdout.emit('data', Buffer.from(text));
            for (const text of script.stderr ?? []) stderr.emit('data', Buffer.from(text));
            if (script.errorEvent) {
                proc.emit('error', script.errorEvent);
                return;
            }
            fireClose(script.exitCode ?? 0);
        }, closeAfter);

        return proc as never;
    };
    return { fn, calls };
};

const ctx = (over: Partial<RunnerContext> = {}): RunnerContext => ({
    runId: 'run-1',
    stepId: 'step-1',
    tenantId: 'tenant-1',
    ...over,
});

// ---------------------------------------------------------------------------

describe('DockerRunner.buildDockerArgs', () => {
    const runner = new DockerRunner({ spawnImpl: buildFakeSpawn().fn });

    it('uses --rm, hardening flags, and the default image', () => {
        const args = runner.buildDockerArgs({ command: 'echo hi' }, ctx());
        expect(args[0]).toBe('run');
        expect(args).toContain('--rm');
        expect(args).toContain('--read-only');
        expect(args).toContain('--tmpfs');
        expect(args.some((a) => a.startsWith('/tmp:rw'))).toBe(true);
        expect(args).toContain('--pids-limit');
        expect(args).toContain('256');
        // image followed by sh -c command
        const imageIdx = args.indexOf('alpine:3.20');
        expect(imageIdx).toBeGreaterThan(0);
        expect(args.slice(imageIdx)).toEqual(['alpine:3.20', 'sh', '-c', 'echo hi']);
    });

    it('defaults network to none', () => {
        const args = runner.buildDockerArgs({ command: 'true' }, ctx());
        const idx = args.indexOf('--network');
        expect(args[idx + 1]).toBe('none');
    });

    it('respects network=open', () => {
        const args = runner.buildDockerArgs({ command: 'true', network: 'open' }, ctx());
        const idx = args.indexOf('--network');
        expect(args[idx + 1]).toBe('bridge');
    });

    it('encodes resource limits in docker units', () => {
        const args = runner.buildDockerArgs(
            {
                command: 'true',
                resources: { memoryMb: 256, cpuMillis: 500 },
            },
            ctx(),
        );
        expect(args[args.indexOf('--memory') + 1]).toBe('256m');
        expect(args[args.indexOf('--cpus') + 1]).toBe('0.500');
    });

    it('emits one -e flag per env var', () => {
        const args = runner.buildDockerArgs(
            { command: 'true', env: { FOO: 'bar', BAZ: 'qux' } },
            ctx(),
        );
        // -e FOO=bar and -e BAZ=qux must both be present, in any order
        const eIndices = args
            .map((a, i) => (a === '-e' ? i : -1))
            .filter((i) => i >= 0);
        const pairs = eIndices.map((i) => args[i + 1]);
        expect(pairs).toEqual(expect.arrayContaining(['FOO=bar', 'BAZ=qux']));
    });

    it('rejects malicious env var names', () => {
        expect(() =>
            runner.buildDockerArgs(
                { command: 'true', env: { 'BAD;rm -rf /': 'x' } },
                ctx(),
            ),
        ).toThrow(RunnerError);
    });

    it('attaches audit labels for run/step/tenant', () => {
        const args = runner.buildDockerArgs(
            { command: 'true' },
            ctx({ runId: 'r-9', stepId: 's-9', tenantId: 't-9' }),
        );
        const labels = args.filter((_, i, arr) => arr[i - 1] === '--label');
        expect(labels).toContain('nanorun.run.id=r-9');
        expect(labels).toContain('nanorun.step.id=s-9');
        expect(labels).toContain('nanorun.tenant.id=t-9');
    });

    it('honors a custom image override', () => {
        const args = runner.buildDockerArgs(
            { command: 'true', image: 'ghcr.io/nanorun/runner:1.2.3' },
            ctx(),
        );
        expect(args).toContain('ghcr.io/nanorun/runner:1.2.3');
    });

    it('honors a custom shell', () => {
        const args = runner.buildDockerArgs(
            { command: 'echo $0', shell: 'bash' },
            ctx(),
        );
        const tail = args.slice(-3);
        expect(tail).toEqual(['bash', '-c', 'echo $0']);
    });
});

describe('DockerRunner.run', () => {
    it('captures stdout from a successful run', async () => {
        const fake = buildFakeSpawn({ stdout: ['hello\n'], exitCode: 0 });
        const runner = new DockerRunner({ spawnImpl: fake.fn });

        const result = await runner.run({ command: 'echo hello' }, ctx());

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('hello');
        expect(result.timedOut).toBe(false);
        // First call is the actual `docker run`
        expect(fake.calls[0].command).toBe('docker');
        expect(fake.calls[0].args[0]).toBe('run');
    });

    it('captures stderr and propagates non-zero exit codes', async () => {
        const fake = buildFakeSpawn({ stderr: ['boom\n'], exitCode: 7 });
        const runner = new DockerRunner({ spawnImpl: fake.fn });

        const result = await runner.run({ command: 'false' }, ctx());

        expect(result.exitCode).toBe(7);
        expect(result.stderr).toBe('boom');
    });

    it('streams output via emit', async () => {
        const fake = buildFakeSpawn({
            stdout: ['line1\n', 'line2\n'],
            stderr: ['warn\n'],
            exitCode: 0,
        });
        const runner = new DockerRunner({ spawnImpl: fake.fn });
        const events: string[] = [];

        await runner.run(
            { command: 'echo lines' },
            { ...ctx(), emit: (e) => events.push(`${e.type}:${e.text.trim()}`) },
        );

        expect(events).toEqual(
            expect.arrayContaining(['stdout:line1', 'stdout:line2', 'stderr:warn']),
        );
    });

    it('reports timeouts and kills the container process', async () => {
        const fake = buildFakeSpawn({
            stdout: ['slow output\n'],
            exitCode: 0,
            closeAfterMs: 5_000, // never reaches close before timeout
        });
        const runner = new DockerRunner({ spawnImpl: fake.fn });

        const result = await runner.run({ command: 'sleep 999', timeoutMs: 80 }, ctx());

        expect(result.timedOut).toBe(true);
    });

    it('reports spawn errors as failures, not throws', async () => {
        const fake = buildFakeSpawn({ throwOnSpawn: new Error('ENOENT: docker not found') });
        const runner = new DockerRunner({ spawnImpl: fake.fn });

        const result = await runner.run({ command: 'true' }, ctx());
        expect(result.exitCode).toBeNull();
        expect(result.stderr).toContain('ENOENT');
    });

    it('reports async error events as failures, not throws', async () => {
        const fake = buildFakeSpawn({ errorEvent: new Error('EACCES') });
        const runner = new DockerRunner({ spawnImpl: fake.fn });

        const result = await runner.run({ command: 'true' }, ctx());
        expect(result.exitCode).toBeNull();
        expect(result.stderr).toContain('EACCES');
    });

    it('honors dockerBinary override (e.g. podman)', async () => {
        const fake = buildFakeSpawn({ exitCode: 0 });
        const runner = new DockerRunner({ spawnImpl: fake.fn, dockerBinary: 'podman' });

        await runner.run({ command: 'true' }, ctx());
        expect(fake.calls[0].command).toBe('podman');
    });
});

describe('DockerRunner.run with --name', () => {
    it('injects --name <containerName> for cancellation', async () => {
        const fake = buildFakeSpawn({ exitCode: 0 });
        const runner = new DockerRunner({ spawnImpl: fake.fn });
        await runner.run({ command: 'true' }, ctx({ runId: 'r-42', stepId: 's-7' }));
        const args = fake.calls[0].args;
        const idx = args.indexOf('--name');
        expect(idx).toBeGreaterThan(0);
        const name = args[idx + 1];
        expect(name).toMatch(/^nanorun-r-42-s-7-[0-9a-f]{8}$/);
    });

    it('sanitizes runId/stepId characters that docker would reject', () => {
        const name = DockerRunner.buildContainerName({
            runId: 'run/with:bad@chars',
            stepId: 'step with spaces',
            tenantId: 't',
        });
        expect(name).toMatch(/^nanorun-run_with_bad_chars-step_with_spaces-[0-9a-f]{8}$/);
    });
});

describe('DockerRunner.cancel', () => {
    it('returns 0 when no run is in flight for the given runId', async () => {
        const fake = buildFakeSpawn({ exitCode: 0 });
        const runner = new DockerRunner({ spawnImpl: fake.fn });
        await expect(runner.cancel('ghost-run')).resolves.toBe(0);
    });

    it('issues docker kill <name> for an in-flight container and returns 1', async () => {
        // The `docker run` spawn must hang (long-running container), but
        // the subsequent `docker kill` spawn must close immediately so
        // cancel() actually returns. Branch on argv[0].
        const calls: SpawnCall[] = [];
        const runProcs: Array<EventEmitter & { kill: jest.Mock }> = [];
        const fn: SpawnFn = (command, args) => {
            calls.push({ command, args: [...args] });
            const stdout = new EventEmitter();
            const stderr = new EventEmitter();
            const proc = new EventEmitter() as EventEmitter & {
                stdout: typeof stdout;
                stderr: typeof stderr;
                kill: jest.Mock;
            };
            proc.stdout = stdout;
            proc.stderr = stderr;
            let closed = false;
            const fireClose = (code: number | null) => {
                if (closed) return;
                closed = true;
                proc.emit('close', code);
            };
            proc.kill = jest.fn(() => fireClose(null));

            if (args[0] === 'run') {
                // Hold the run open until the test kills it
                runProcs.push(proc);
            } else if (args[0] === 'kill') {
                // Immediate success — let the kill subprocess resolve
                setImmediate(() => fireClose(0));
                // Also force-close the corresponding run proc that was held open
                setImmediate(() => {
                    for (const p of runProcs) p.kill();
                });
            } else {
                setImmediate(() => fireClose(0));
            }

            return proc as never;
        };

        const runner = new DockerRunner({ spawnImpl: fn });
        const runPromise = runner.run({ command: 'sleep 30', timeoutMs: 30_000 }, ctx({ runId: 'r-cancel' }));

        // Let run() reach the point where it tracks the container
        await new Promise((resolve) => setImmediate(resolve));

        const killed = await runner.cancel('r-cancel');
        expect(killed).toBe(1);

        const killCall = calls.find((c) => c.args[0] === 'kill');
        expect(killCall).toBeDefined();
        expect(killCall!.command).toBe('docker');
        expect(killCall!.args[1]).toMatch(/^nanorun-r-cancel-/);

        await runPromise;
    });
});

describe('DockerRunner.healthcheck', () => {
    it('passes when docker version exits 0', async () => {
        const fake = buildFakeSpawn({ stdout: ['25.0.5\n'], exitCode: 0 });
        const runner = new DockerRunner({ spawnImpl: fake.fn });
        await expect(runner.healthcheck()).resolves.toBeUndefined();
        expect(fake.calls[0].args).toEqual(['version', '--format', '{{.Server.Version}}']);
    });

    it('throws RunnerError when docker version fails', async () => {
        const fake = buildFakeSpawn({ stderr: ['Cannot connect\n'], exitCode: 1 });
        const runner = new DockerRunner({ spawnImpl: fake.fn });
        await expect(runner.healthcheck()).rejects.toThrow(RunnerError);
    });
});
