import { TransformNodeExecutor } from '../../../editor/nodes/transform.executor';
import { SandboxError } from '../../../errors/custom-error';
import type { Logger } from '../../../services/logger.service';

const buildDeps = () => {
    const logger = {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    };
    return {
        sandbox: {
            execute: jest.fn(),
            evaluateCondition: jest.fn(),
        },
        logger: logger as unknown as Logger,
        loggerSpy: logger,
    };
};

const errCtx = { nodeId: 'n', nodeName: 'Transform', nodeType: 'Transform' };

describe('TransformNodeExecutor', () => {
    it('exposes type=Transform and Code alias', () => {
        const exec = new TransformNodeExecutor(buildDeps());
        expect(exec.type).toBe('Transform');
        expect(exec.aliases).toEqual(['Code']);
    });

    it('runs user code through the sandbox and returns its output', async () => {
        const deps = buildDeps();
        deps.sandbox.execute.mockResolvedValue({ doubled: 4 });
        const exec = new TransformNodeExecutor(deps);

        const result = await exec.execute({ code: 'return { doubled: input.value * 2 }' }, { value: 2 }, errCtx);

        expect(result).toEqual({ doubled: 4 });
        expect(deps.sandbox.execute).toHaveBeenCalledWith(
            'return { doubled: input.value * 2 }',
            { value: 2 },
        );
    });

    it('throws SandboxError when the sandbox returns { error }', async () => {
        const deps = buildDeps();
        deps.sandbox.execute.mockResolvedValue({ error: 'oops' });
        const exec = new TransformNodeExecutor(deps);
        await expect(
            exec.execute({ code: 'throw' }, {}, errCtx),
        ).rejects.toBeInstanceOf(SandboxError);
    });

    it('wraps unexpected sandbox throws into SandboxError', async () => {
        const deps = buildDeps();
        deps.sandbox.execute.mockRejectedValue(new Error('boom'));
        const exec = new TransformNodeExecutor(deps);
        await expect(
            exec.execute({ code: 'whatever' }, {}, errCtx),
        ).rejects.toBeInstanceOf(SandboxError);
        expect(deps.loggerSpy.error).toHaveBeenCalled();
    });

    it('resolves a static mapping with template substitution', async () => {
        const exec = new TransformNodeExecutor(buildDeps());
        const result = await exec.execute(
            { mapping: { greeting: 'hello {{name}}', original: '{{name}}' } },
            { name: 'world' },
            errCtx,
        );
        expect(result).toEqual({ greeting: 'hello world', original: 'world' });
    });

    it('passes input through when neither code nor mapping is set', async () => {
        const exec = new TransformNodeExecutor(buildDeps());
        const result = await exec.execute({}, { foo: 'bar' }, errCtx);
        expect(result).toEqual({ foo: 'bar' });
    });
});
