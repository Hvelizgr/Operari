/**
 * Canonical JSON serialization (RFC 8785-style: deterministic key ordering,
 * no whitespace) so that the same logical payload always produces the
 * same byte sequence — required for hash chains.
 *
 * Rules:
 *   - Object keys are sorted lexicographically (Unicode code points).
 *   - No insignificant whitespace.
 *   - Numbers serialize via JSON.stringify (we never accept NaN/Infinity).
 *   - undefined is dropped exactly like JSON.stringify does.
 *   - Date instances are serialized as their ISO string for stability.
 *
 * This is intentionally a small, focused implementation. We do NOT depend
 * on `json-canonicalize` or `canonicalize` to keep the dependency surface
 * minimal in security-critical code.
 */
export function canonicalJson(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError('canonicalJson: non-finite number is not allowed');
        }
        return JSON.stringify(value);
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'bigint') return JSON.stringify(value.toString());
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (Array.isArray(value)) {
        return '[' + value.map(canonicalJson).join(',') + ']';
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj)
            .filter((k) => obj[k] !== undefined)
            .sort();
        const parts = keys.map(
            (k) => JSON.stringify(k) + ':' + canonicalJson(obj[k]),
        );
        return '{' + parts.join(',') + '}';
    }
    throw new TypeError(`canonicalJson: unsupported type ${typeof value}`);
}
