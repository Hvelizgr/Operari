import { NoteNodeExecutor } from '../../../editor/nodes/note.executor';

describe('NoteNodeExecutor', () => {
    const exec = new NoteNodeExecutor();
    const errCtx = { nodeId: 'n', nodeName: 'note', nodeType: 'custom.note' };

    it('exposes type=custom.note', () => {
        expect(exec.type).toBe('custom.note');
    });

    it('passes input through unchanged', async () => {
        const input = { foo: 'bar', nested: { x: 1 } };
        const result = await exec.execute({}, input, errCtx);
        expect(result).toEqual(input);
        // Same reference: passthrough must not clone
        expect(result).toBe(input);
    });
});
