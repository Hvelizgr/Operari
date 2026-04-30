const truthy = (value: string | undefined): boolean =>
  value === '1' || value?.toLowerCase() === 'true';

export const featureFlags = {
  editorV2: truthy(process.env.NEXT_PUBLIC_OPERARI_EDITOR_V2),
} as const;

export type FeatureFlags = typeof featureFlags;
