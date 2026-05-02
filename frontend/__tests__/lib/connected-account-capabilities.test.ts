import {
  DEFAULT_CAPABILITIES,
  getCapabilities,
  hasCapability,
  isKnownProvider,
  KNOWN_PROVIDERS,
  PROVIDER_CAPABILITIES,
} from '@operari/shared';

describe('connected-account capabilities', () => {
  it('returns the conservative default for unknown providers', () => {
    expect(getCapabilities('martian-sql')).toBe(DEFAULT_CAPABILITIES);
    expect(hasCapability('martian-sql', 'canQuery')).toBe(false);
  });

  it('marks postgres + mysql as relational and queryable', () => {
    expect(hasCapability('postgres', 'isRelationalDatabase')).toBe(true);
    expect(hasCapability('postgres', 'canIntrospectSchema')).toBe(true);
    expect(hasCapability('mysql', 'isRelationalDatabase')).toBe(true);
  });

  it('marks slack + github + pagerduty as OAuth providers', () => {
    expect(hasCapability('slack', 'usesOAuth')).toBe(true);
    expect(hasCapability('github', 'usesOAuth')).toBe(true);
    expect(hasCapability('pagerduty', 'usesOAuth')).toBe(true);
  });

  it('does not let non-DB providers claim canIntrospectSchema', () => {
    for (const provider of KNOWN_PROVIDERS) {
      const caps = getCapabilities(provider);
      if (!caps.isRelationalDatabase) {
        expect(caps.canIntrospectSchema).toBe(false);
      }
    }
  });

  it('treats every known provider as an entry in PROVIDER_CAPABILITIES', () => {
    for (const provider of KNOWN_PROVIDERS) {
      expect(PROVIDER_CAPABILITIES[provider]).toBeDefined();
      expect(isKnownProvider(provider)).toBe(true);
    }
  });

  it('does not regard arbitrary strings as known providers', () => {
    expect(isKnownProvider('postgres')).toBe(true);
    expect(isKnownProvider('not-a-provider')).toBe(false);
  });
});
