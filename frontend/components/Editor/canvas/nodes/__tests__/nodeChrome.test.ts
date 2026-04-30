import {
  handleTone,
  isOrphanOutput,
  resolvePreview,
  resolveSecondaryChips,
  resolveTags,
} from '../nodeChrome';

describe('resolvePreview', () => {
  it('returns the explicit primary key when present', () => {
    expect(resolvePreview('shell', { command: 'ls -la' })).toBe('ls -la');
    expect(resolvePreview('operari.httpRequest', { url: 'https://api.example' })).toBe(
      'https://api.example'
    );
  });

  it('falls back to the first non-empty non-meta string', () => {
    const config = { _tags: ['a'], _retry: { count: 3 }, payload: 'fallback' };
    expect(resolvePreview('plugin.unknown', config)).toBe('fallback');
  });

  it('returns null when nothing is preview-able', () => {
    expect(resolvePreview('shell', {})).toBeNull();
    expect(resolvePreview('shell', undefined)).toBeNull();
    expect(resolvePreview('shell', { _tags: ['a'], count: 5 })).toBeNull();
  });
});

describe('resolveTags', () => {
  it('returns _tags when they are strings', () => {
    expect(resolveTags({ _tags: ['prod', 'rollback'] })).toEqual(['prod', 'rollback']);
  });

  it('filters non-string and empty entries', () => {
    expect(resolveTags({ _tags: ['ok', '', 42, null, 'good'] as unknown[] })).toEqual([
      'ok',
      'good',
    ]);
  });

  it('returns [] when _tags is missing or wrong shape', () => {
    expect(resolveTags(undefined)).toEqual([]);
    expect(resolveTags({})).toEqual([]);
    expect(resolveTags({ _tags: 'not-an-array' })).toEqual([]);
  });
});

describe('resolveSecondaryChips', () => {
  it('shows HTTP method', () => {
    expect(resolveSecondaryChips('operari.httpRequest', { method: 'POST' })).toEqual(['POST']);
  });

  it('shows user@host for SSH when both present', () => {
    expect(resolveSecondaryChips('ssh', { host: 'box', username: 'deploy' })).toEqual([
      'deploy@box',
    ]);
  });

  it('shows host alone when no user', () => {
    expect(resolveSecondaryChips('ssh', { host: 'box' })).toEqual(['box']);
  });

  it('shows cron expression', () => {
    expect(resolveSecondaryChips('operari.cron', { expression: '* * * * *' })).toEqual([
      '* * * * *',
    ]);
  });

  it('returns [] for types without secondary signal', () => {
    expect(resolveSecondaryChips('approval', { message: 'ok?' })).toEqual([]);
  });
});

describe('handleTone', () => {
  it('returns null for neutral labels', () => {
    expect(handleTone('main')).toBeNull();
    expect(handleTone('iteration')).toBeNull();
    expect(handleTone('')).toBeNull();
  });

  it('returns sunset for error-shaped labels', () => {
    expect(handleTone('err')).toBe('var(--op-sunset)');
    expect(handleTone('error')).toBe('var(--op-sunset)');
    expect(handleTone('FAIL')).toBe('var(--op-sunset)');
  });

  it('returns moss for ok / success labels', () => {
    expect(handleTone('ok')).toBe('var(--op-moss)');
    expect(handleTone('Success')).toBe('var(--op-moss)');
    expect(handleTone('done')).toBe('var(--op-moss)');
  });

  it('returns gold for warning labels', () => {
    expect(handleTone('warn')).toBe('var(--op-gold)');
    expect(handleTone('warning')).toBe('var(--op-gold)');
  });

  it('returns fog for skipped labels', () => {
    expect(handleTone('skip')).toBe('var(--op-fog)');
    expect(handleTone('skipped')).toBe('var(--op-fog)');
  });
});

describe('isOrphanOutput', () => {
  it('flags step nodes with expected outputs but zero live edges', () => {
    expect(isOrphanOutput('shell', 1, 0, undefined)).toBe(true);
  });

  it('does not flag nodes that have live outputs', () => {
    expect(isOrphanOutput('shell', 1, 1, undefined)).toBe(false);
  });

  it('never flags frames or notes', () => {
    expect(isOrphanOutput('custom.frame', 0, 0, undefined)).toBe(false);
    expect(isOrphanOutput('custom.note', 0, 0, undefined)).toBe(false);
  });

  it('does not flag while running (transient state)', () => {
    expect(isOrphanOutput('shell', 1, 0, 'running')).toBe(false);
  });

  it('does not flag types whose catalog says they have no outputs', () => {
    expect(isOrphanOutput('approval', 0, 0, undefined)).toBe(false);
  });
});
