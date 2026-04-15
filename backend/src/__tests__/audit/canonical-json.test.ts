import { canonicalJson } from '../../audit/canonical-json';

describe('canonicalJson', () => {
    it('serializes primitives', () => {
        expect(canonicalJson(null)).toBe('null');
        expect(canonicalJson(undefined)).toBe('null');
        expect(canonicalJson(true)).toBe('true');
        expect(canonicalJson(false)).toBe('false');
        expect(canonicalJson(42)).toBe('42');
        expect(canonicalJson('hi')).toBe('"hi"');
    });

    it('escapes strings the same way JSON.stringify does', () => {
        expect(canonicalJson('a"b\\c\nd')).toBe(JSON.stringify('a"b\\c\nd'));
    });

    it('sorts object keys lexicographically', () => {
        const a = canonicalJson({ b: 1, a: 2, c: 3 });
        const b = canonicalJson({ c: 3, b: 1, a: 2 });
        expect(a).toBe(b);
        expect(a).toBe('{"a":2,"b":1,"c":3}');
    });

    it('recurses into nested objects with sorted keys at every level', () => {
        const out = canonicalJson({
            outer: { z: 1, a: 2 },
            arr: [{ b: 1, a: 2 }, { d: 4, c: 3 }],
        });
        expect(out).toBe('{"arr":[{"a":2,"b":1},{"c":3,"d":4}],"outer":{"a":2,"z":1}}');
    });

    it('drops undefined values like JSON.stringify', () => {
        expect(canonicalJson({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}');
    });

    it('preserves null values', () => {
        expect(canonicalJson({ a: null })).toBe('{"a":null}');
    });

    it('serializes Date as ISO string for stability', () => {
        const d = new Date('2026-04-06T12:00:00.000Z');
        expect(canonicalJson(d)).toBe('"2026-04-06T12:00:00.000Z"');
    });

    it('rejects non-finite numbers', () => {
        expect(() => canonicalJson(NaN)).toThrow(TypeError);
        expect(() => canonicalJson(Infinity)).toThrow(TypeError);
    });

    it('produces identical output for logically-equal objects', () => {
        const a = canonicalJson({ name: 'run-1', steps: ['a', 'b'], tenant: 't1' });
        const b = canonicalJson({ tenant: 't1', name: 'run-1', steps: ['a', 'b'] });
        expect(a).toBe(b);
    });
});
