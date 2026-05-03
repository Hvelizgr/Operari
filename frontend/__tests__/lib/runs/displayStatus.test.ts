import { deriveDisplayStatus } from '@/lib/runs/displayStatus';

describe('deriveDisplayStatus', () => {
  it('passes through non-FAILED statuses verbatim', () => {
    expect(deriveDisplayStatus('SUCCESS', null)).toBe('SUCCESS');
    expect(deriveDisplayStatus('RUNNING', null)).toBe('RUNNING');
    expect(deriveDisplayStatus('PAUSED', null)).toBe('PAUSED');
    expect(deriveDisplayStatus('CANCELLED', null)).toBe('CANCELLED');
    // Even with an error blob, non-FAILED stays non-FAILED.
    expect(deriveDisplayStatus('SUCCESS', { code: 'TIMEOUT_ERROR', message: 'timed out' })).toBe(
      'SUCCESS'
    );
  });

  it('returns FAILED when there is no error blob to inspect', () => {
    expect(deriveDisplayStatus('FAILED', null)).toBe('FAILED');
    expect(deriveDisplayStatus('FAILED', undefined)).toBe('FAILED');
    expect(deriveDisplayStatus('FAILED', {})).toBe('FAILED');
  });

  it('detects TIMED_OUT from the error code', () => {
    expect(deriveDisplayStatus('FAILED', { code: 'TIMEOUT_ERROR' })).toBe('TIMED_OUT');
    expect(deriveDisplayStatus('FAILED', { code: 'NODE_TIMEOUT' })).toBe('TIMED_OUT');
  });

  it('detects TIMED_OUT from the message phrase as a legacy fallback', () => {
    expect(deriveDisplayStatus('FAILED', { message: 'Operation timed out after 30s' })).toBe(
      'TIMED_OUT'
    );
    expect(deriveDisplayStatus('FAILED', { message: 'request hit timeout' })).toBe('TIMED_OUT');
  });

  it('detects CRASHED on OOM / segfault-style markers', () => {
    expect(deriveDisplayStatus('FAILED', { code: 'NODE_OOM' })).toBe('CRASHED');
    expect(
      deriveDisplayStatus('FAILED', { message: 'Killed by signal SIGKILL (out of memory)' })
    ).toBe('CRASHED');
    expect(deriveDisplayStatus('FAILED', { message: 'OOM in worker' })).toBe('CRASHED');
  });

  it('detects EXPIRED from the error code or message', () => {
    expect(deriveDisplayStatus('FAILED', { code: 'TTL_EXCEEDED' })).toBe('EXPIRED');
    expect(deriveDisplayStatus('FAILED', { message: 'job expired before pickup' })).toBe('EXPIRED');
  });

  it('keeps FAILED for unrecognised error blobs', () => {
    expect(deriveDisplayStatus('FAILED', { code: 'VALIDATION_ERROR' })).toBe('FAILED');
    expect(deriveDisplayStatus('FAILED', { message: 'Permission denied talking to Datadog' })).toBe(
      'FAILED'
    );
  });
});
