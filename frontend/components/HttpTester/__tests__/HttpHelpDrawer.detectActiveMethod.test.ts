import { detectActiveMethod } from '../HttpHelpDrawer';

describe('detectActiveMethod', () => {
  it('returns null for empty / nullish input', () => {
    expect(detectActiveMethod(null)).toBeNull();
    expect(detectActiveMethod(undefined)).toBeNull();
    expect(detectActiveMethod('')).toBeNull();
    expect(detectActiveMethod('   ')).toBeNull();
  });

  it('maps every known HTTP verb to the methods topic', () => {
    for (const m of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']) {
      expect(detectActiveMethod(m)).toBe('methods');
    }
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(detectActiveMethod('get')).toBe('methods');
    expect(detectActiveMethod(' Post ')).toBe('methods');
    expect(detectActiveMethod('Delete')).toBe('methods');
  });

  it('returns null for unknown methods (CONNECT, TRACE, gibberish)', () => {
    expect(detectActiveMethod('CONNECT')).toBeNull();
    expect(detectActiveMethod('TRACE')).toBeNull();
    expect(detectActiveMethod('FOO')).toBeNull();
  });
});
