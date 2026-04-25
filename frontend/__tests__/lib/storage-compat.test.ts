import { storageRead, storageRemove, storageWrite } from '../../lib/storage-compat';

describe('storage-compat', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('storageRead', () => {
    it('returns the current-prefixed value when present', () => {
      window.localStorage.setItem('nanorun-onboarding-seen', 'true');
      expect(storageRead('nanorun-onboarding-seen')).toBe('true');
    });

    it('falls back to the legacy nanoflow-* key when current is absent', () => {
      window.localStorage.setItem('nanoflow-onboarding-seen', 'true');
      expect(storageRead('nanorun-onboarding-seen')).toBe('true');
    });

    it('ports the legacy value forward and removes the legacy key on first read', () => {
      window.localStorage.setItem('nanoflow-workflow', '{"v":1}');
      storageRead('nanorun-workflow');
      // One-shot migration: after the read, only the new key exists.
      expect(window.localStorage.getItem('nanorun-workflow')).toBe('{"v":1}');
      expect(window.localStorage.getItem('nanoflow-workflow')).toBeNull();
    });

    it('returns null when neither the current nor legacy key exists', () => {
      expect(storageRead('nanorun-missing')).toBeNull();
    });

    it('only consults the legacy key for nanorun-prefixed keys (no accidental cross-app reads)', () => {
      window.localStorage.setItem('other-key-legacy', 'x');
      expect(storageRead('other-key')).toBeNull();
    });

    it('prefers the current value over the legacy value when both exist', () => {
      // After a past migration the legacy key may still linger if a
      // different tab wrote it back. The current value wins — lets
      // the user's most recent write survive instead of getting
      // silently clobbered by stale legacy data.
      window.localStorage.setItem('nanorun-high-contrast', 'true');
      window.localStorage.setItem('nanoflow-high-contrast', 'false');
      expect(storageRead('nanorun-high-contrast')).toBe('true');
      // Legacy remains untouched when the current read wins.
      expect(window.localStorage.getItem('nanoflow-high-contrast')).toBe('false');
    });
  });

  describe('storageWrite', () => {
    it('writes to the current key and purges the legacy copy', () => {
      window.localStorage.setItem('nanoflow-autosave-enabled', 'true');
      storageWrite('nanorun-autosave-enabled', 'false');
      expect(window.localStorage.getItem('nanorun-autosave-enabled')).toBe('false');
      expect(window.localStorage.getItem('nanoflow-autosave-enabled')).toBeNull();
    });

    it('does not touch unrelated legacy keys', () => {
      window.localStorage.setItem('nanoflow-other', 'keep');
      storageWrite('nanorun-autosave-enabled', 'false');
      expect(window.localStorage.getItem('nanoflow-other')).toBe('keep');
    });
  });

  describe('storageRemove', () => {
    it('clears both the current and legacy keys', () => {
      window.localStorage.setItem('nanorun-node-types', 'a');
      window.localStorage.setItem('nanoflow-node-types', 'b');
      storageRemove('nanorun-node-types');
      expect(window.localStorage.getItem('nanorun-node-types')).toBeNull();
      expect(window.localStorage.getItem('nanoflow-node-types')).toBeNull();
    });
  });
});
