/**
 * localStorage helpers with transparent nanoflow-* → nanorun-* key
 * migration. Pre-rebrand builds persisted under `nanoflow-*`; this
 * layer keeps those reads working and silently ports the value to
 * the current prefix on first access, so legacy keys drain without
 * a global migration cron.
 *
 * Usage: call `storageRead('nanorun-X')` / `storageWrite('nanorun-X', v)`
 * instead of `window.localStorage.*`. The helpers resolve the legacy
 * key automatically when the requested key starts with `nanorun-`.
 *
 * SSR-safe: every helper is a no-op when window is undefined.
 */

const LEGACY_PREFIX = 'nanoflow-';
const CURRENT_PREFIX = 'nanorun-';

const hasWindow = () => typeof window !== 'undefined';

const legacyKeyFor = (key: string): string | null => {
  if (!key.startsWith(CURRENT_PREFIX)) return null;
  return LEGACY_PREFIX + key.slice(CURRENT_PREFIX.length);
};

/** Read a value, preferring the current key. If only the legacy key
 *  exists, port the value forward and remove the legacy copy so the
 *  next read is a direct hit. Returns null when neither exists. */
export function storageRead(key: string): string | null {
  if (!hasWindow()) return null;
  const current = window.localStorage.getItem(key);
  if (current !== null) return current;
  const legacy = legacyKeyFor(key);
  if (!legacy) return null;
  const legacyValue = window.localStorage.getItem(legacy);
  if (legacyValue === null) return null;
  try {
    window.localStorage.setItem(key, legacyValue);
    window.localStorage.removeItem(legacy);
  } catch {
    // Quota/access error — still return the legacy value.
  }
  return legacyValue;
}

/** Write to the current key and clear any stale legacy copy so the
 *  two don't diverge after the migration window. */
export function storageWrite(key: string, value: string): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(key, value);
  const legacy = legacyKeyFor(key);
  if (legacy) window.localStorage.removeItem(legacy);
}

/** Remove both the current and legacy entries for a key. */
export function storageRemove(key: string): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(key);
  const legacy = legacyKeyFor(key);
  if (legacy) window.localStorage.removeItem(legacy);
}
