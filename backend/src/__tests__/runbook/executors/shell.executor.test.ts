import { ShellExecutor } from '../../../runbook/executors/shell.executor';
import type {
    Runner,
    RunnerContext,
    RunnerResult,
    RunnerSpec,
} from '../../../runbook/runners/runner.types';
import type { ExecutorContext } from '../../../runbook/types/executor.types';

class FakeRunner implements Runner {
    readonly type = 'fake';
    public lastSpec?: RunnerSpec;
    public lastContext?: RunnerContext;

    constructor(private readonly fixture: RunnerResult) { }

    async run(spec: RunnerSpec, context: RunnerContext): Promise<RunnerResult> {
        this.lastSpec = spec;
        this.lastContext = context;
        return this.fixture;
    }
}

const execCtx = (overrides: Partial<ExecutorContext> = {}): ExecutorContext => ({
    runId: 'run-1',
    stepId: 'step-1',
    tenantId: 'tenant-1',
    variables: { name: 'world' },
    previousOutputs: {},
    ...overrides,
});

describe('ShellExecutor', () => {
    it('resolves templates and forwards spec to the runner', async () => {
        const runner = new FakeRunner({
            exitCode: 0,
            stdout: 'hello world',
            stderr: '',
            timedOut: false,
            durationMs: 12,
        });
        const executor = new ShellExecutor(runner);

        const result = await executor.execute(
            { command: 'echo hello {{vars.name}}', timeout: 5000 },
            execCtx(),
        );

        expect(runner.lastSpec?.command).toBe('echo hello world');
        expect(runner.lastSpec?.timeoutMs).toBe(5000);
        expect(result.success).toBe(true);
        const output = result.output as { stdout: string; exitCode: number };
        expect(output.stdout).toBe('hello world');
        expect(output.exitCode).toBe(0);
    });

    it('marks the step as failed on non-zero exit code by default', async () => {
        const runner = new FakeRunner({
            exitCode: 2,
            stdout: '',
            stderr: 'boom',
            timedOut: false,
            durationMs: 5,
        });
        const executor = new ShellExecutor(runner);

        const result = await executor.execute({ command: 'false' }, execCtx());

        expect(result.success).toBe(false);
        expect(result.error).toContain('exited with code 2');
    });

    it('honors failOnNonZeroExit=false', async () => {
        const runner = new FakeRunner({
            exitCode: 3,
            stdout: '',
            stderr: '',
            timedOut: false,
            durationMs: 5,
        });
        const executor = new ShellExecutor(runner);

        const result = await executor.execute(
            { command: 'false', failOnNonZeroExit: false },
            execCtx(),
        );

        expect(result.success).toBe(true);
    });

    it('reports timeouts as failures', async () => {
        const runner = new FakeRunner({
            exitCode: null,
            stdout: '',
            stderr: '',
            timedOut: true,
            durationMs: 1000,
        });
        const executor = new ShellExecutor(runner);

        const result = await executor.execute(
            { command: 'sleep 999', timeout: 1000 },
            execCtx(),
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('timed out');
    });

    it('passes runId, stepId, tenantId to the runner context', async () => {
        const runner = new FakeRunner({
            exitCode: 0,
            stdout: '',
            stderr: '',
            timedOut: false,
            durationMs: 1,
        });
        const executor = new ShellExecutor(runner);

        await executor.execute(
            { command: 'echo' },
            execCtx({
                runId: 'r-42',
                stepId: 's-42',
                tenantId: 't-42',
            }),
        );

        expect(runner.lastContext?.runId).toBe('r-42');
        expect(runner.lastContext?.stepId).toBe('s-42');
        expect(runner.lastContext?.tenantId).toBe('t-42');
    });
});
