import { TransformNodeExecutor } from '../../../editor/nodes/transform.executor';
import type { Logger } from '../../../services/logger.service';

const buildDeps = () => {
    const logger = {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    };
    return { logger: logger as unknown as Logger };
};

const errCtx = { nodeId: 'n', nodeName: 'Transform', nodeType: 'Transform' };

describe('TransformNodeExecutor', () => {
    it('exposes type=Transform', () => {
        const exec = new TransformNodeExecutor(buildDeps());
        expect(exec.type).toBe('Transform');
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

    it('passes input through when no mapping is set', async () => {
        const exec = new TransformNodeExecutor(buildDeps());
        const result = await exec.execute({}, { foo: 'bar' }, errCtx);
        expect(result).toEqual({ foo: 'bar' });
    });
});
