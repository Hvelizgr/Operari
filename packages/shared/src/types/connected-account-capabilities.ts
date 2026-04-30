/**
 * Declarative capability matrix for ConnectedAccount providers.
 *
 * Each provider declares what surfaces it supports so the UI can
 * disable buttons that would never work (e.g. don't show the "View
 * schema" button on a Slack account, don't show the "Send message"
 * action on a Postgres credential). Backend handlers use the same
 * matrix to short-circuit invalid requests with a 400 instead of
 * forwarding them to a provider that will reject them with an
 * obscure error.
 *
 * Adding a capability:
 *   1. Add the boolean field to `ConnectedAccountCapabilities`.
 *   2. Set the default in `DEFAULT_CAPABILITIES` (false unless you
 *      know every provider supports it).
 *   3. Flip it on in the providers that actually support it.
 *   4. Use `hasCapability(provider, name)` at the UI/backend
 *      boundary you're gating.
 *
 * Adding a provider:
 *   1. Add the literal to `KNOWN_PROVIDERS`.
 *   2. Add an entry to `PROVIDER_CAPABILITIES`.
 *
 * Unknown providers fall through to `DEFAULT_CAPABILITIES`, which is
 * conservative (almost everything off) — better to under-promise
 * than to surface a broken button on a provider we forgot to map.
 */

export const KNOWN_PROVIDERS = [
  'postgres',
  'mysql',
  'github',
  'slack',
  'datadog',
  'pagerduty',
  'aws',
  'gcp',
  'azure',
  'http',
] as const;

export type KnownProvider = (typeof KNOWN_PROVIDERS)[number];

export interface ConnectedAccountCapabilities {
  /** Provider exposes a queryable database (SQL editor, schema diagram). */
  canQuery: boolean;
  /** Provider returns a structured catalog of tables / columns. */
  canIntrospectSchema: boolean;
  /** Provider can execute a runbook step that performs an action. */
  canExecute: boolean;
  /** Provider streams events back to us (webhooks, push notifications). */
  canSubscribe: boolean;
  /** Provider supports OAuth2 authorization-code flow. */
  usesOAuth: boolean;
  /** Provider holds a PostgreSQL-compatible connection. */
  isRelationalDatabase: boolean;
}

export const DEFAULT_CAPABILITIES: ConnectedAccountCapabilities = {
  canQuery: false,
  canIntrospectSchema: false,
  canExecute: false,
  canSubscribe: false,
  usesOAuth: false,
  isRelationalDatabase: false,
};

export const PROVIDER_CAPABILITIES: Record<KnownProvider, ConnectedAccountCapabilities> = {
  postgres: {
    canQuery: true,
    canIntrospectSchema: true,
    canExecute: true,
    canSubscribe: false,
    usesOAuth: false,
    isRelationalDatabase: true,
  },
  mysql: {
    canQuery: true,
    canIntrospectSchema: true,
    canExecute: true,
    canSubscribe: false,
    usesOAuth: false,
    isRelationalDatabase: true,
  },
  github: {
    canQuery: false,
    canIntrospectSchema: false,
    canExecute: true,
    canSubscribe: true,
    usesOAuth: true,
    isRelationalDatabase: false,
  },
  slack: {
    canQuery: false,
    canIntrospectSchema: false,
    canExecute: true,
    canSubscribe: true,
    usesOAuth: true,
    isRelationalDatabase: false,
  },
  datadog: {
    canQuery: true,
    canIntrospectSchema: false,
    canExecute: true,
    canSubscribe: true,
    usesOAuth: false,
    isRelationalDatabase: false,
  },
  pagerduty: {
    canQuery: false,
    canIntrospectSchema: false,
    canExecute: true,
    canSubscribe: true,
    usesOAuth: true,
    isRelationalDatabase: false,
  },
  aws: {
    canQuery: false,
    canIntrospectSchema: false,
    canExecute: true,
    canSubscribe: false,
    usesOAuth: false,
    isRelationalDatabase: false,
  },
  gcp: {
    canQuery: false,
    canIntrospectSchema: false,
    canExecute: true,
    canSubscribe: false,
    usesOAuth: true,
    isRelationalDatabase: false,
  },
  azure: {
    canQuery: false,
    canIntrospectSchema: false,
    canExecute: true,
    canSubscribe: false,
    usesOAuth: true,
    isRelationalDatabase: false,
  },
  http: {
    canQuery: false,
    canIntrospectSchema: false,
    canExecute: true,
    canSubscribe: false,
    usesOAuth: false,
    isRelationalDatabase: false,
  },
};

export function getCapabilities(provider: string): ConnectedAccountCapabilities {
  if ((KNOWN_PROVIDERS as readonly string[]).includes(provider)) {
    return PROVIDER_CAPABILITIES[provider as KnownProvider];
  }
  return DEFAULT_CAPABILITIES;
}

export function hasCapability(
  provider: string,
  capability: keyof ConnectedAccountCapabilities
): boolean {
  return getCapabilities(provider)[capability];
}

export function isKnownProvider(provider: string): provider is KnownProvider {
  return (KNOWN_PROVIDERS as readonly string[]).includes(provider);
}
