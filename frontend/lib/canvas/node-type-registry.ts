/**
 * NodeTypeRegistry — pluggable interface that decouples the visual
 * canvas from any specific domain (runbooks, SQL, ETL, etc.).
 *
 * The canvas calls these functions to render, validate, and preview
 * nodes without knowing what "shell" or "SELECT" means. Each domain
 * supplies its own implementation.
 *
 * Usage:
 *   import { runbookRegistry } from '@/lib/canvas/runbook-registry';
 *   <EditorCanvas registry={runbookRegistry} ... />
 *
 * To add a new domain (e.g. SQL visual editor):
 *   1. Create sql-registry.ts implementing NodeTypeRegistry
 *   2. Supply SQL-specific node types, previews, and validation
 *   3. Pass it to the same EditorCanvas component
 */

export interface CategoryPalette {
    accent: string;
    tint: string;
}

export interface BadgeInfo {
    retry: number | null;
    conditional: 'runIf' | 'skipIf' | 'both' | null;
    secrets: boolean;
}

export interface CategoryDefinition {
    id: string;
    label: { en: string; es: string };
    color: string;
}

export interface NodeTypeDefinition {
    type: string;
    icon: React.ReactNode;
    label: { en: string; es: string };
    color: string;
    category: string;
    description?: { en: string; es: string };
    inputs?: string[];
    outputs?: string[];
    properties?: any[];
}

/**
 * The contract a domain must implement to plug into the visual canvas.
 * Every method has a sensible default so a minimal registry only needs
 * to supply `nodeTypes` and `categories`.
 */
export interface NodeTypeRegistry {
    /** Available node types for the palette. */
    nodeTypes: NodeTypeDefinition[];

    /** Categories for grouping in the palette. */
    categories: CategoryDefinition[];

    /** Node types that are triggers (no retry/conditional sections). */
    triggerTypes: Set<string>;

    /** Node types that are organizational (no execution features). */
    organizationTypes: Set<string>;

    /**
     * Return a short preview string for a node's config.
     * Shown on the card body so operators can tell nodes apart.
     * Return null for no preview.
     */
    configPreview(type: string, config: Record<string, unknown> | undefined | null): string | null;

    /**
     * Validate a node's config. Return null if valid, or a short
     * error string if incomplete/invalid.
     */
    validateConfig(type: string, config: Record<string, unknown> | undefined | null): string | null;

    /**
     * Detect cross-cutting badges (retry, conditional, secrets).
     */
    detectBadges(config: Record<string, unknown> | undefined | null): BadgeInfo;

    /**
     * Color palette for a category. Controls the left-border accent
     * and icon background tint on node cards.
     */
    categoryPalette(category: string | undefined): CategoryPalette;

    /**
     * Custom preview rendering hint. Some domains want colored
     * method chips (HTTP verbs) while others want plain text.
     * Return null to use the default text preview.
     */
    previewRenderHint?(type: string, config: Record<string, unknown> | undefined | null): {
        type: 'method-chip';
        method: string;
        methodColor: string;
        url: string;
    } | null;
}

/**
 * Default implementations for optional registry methods.
 * Domains can spread this and override only what they need.
 */
export const defaultRegistryMethods: Pick<NodeTypeRegistry, 'configPreview' | 'validateConfig' | 'detectBadges' | 'categoryPalette'> = {
    configPreview: () => null,
    validateConfig: () => null,
    detectBadges: (config) => {
        if (!config || typeof config !== 'object') {
            return { retry: null, conditional: null, secrets: false };
        }
        const retryRaw = config._retry as { count?: number } | undefined;
        const retry = retryRaw && typeof retryRaw.count === 'number' && retryRaw.count > 0 ? retryRaw.count : null;
        const hasRunIf = !!config._runIf;
        const hasSkipIf = !!config._skipIf;
        const conditional: BadgeInfo['conditional'] =
            hasRunIf && hasSkipIf ? 'both' : hasRunIf ? 'runIf' : hasSkipIf ? 'skipIf' : null;
        const secrets = /\{\{\s*secrets\./i.test(JSON.stringify(config));
        return { retry, conditional, secrets };
    },
    categoryPalette: () => ({ accent: '#3b82f6', tint: 'rgba(59, 130, 246, 0.10)' }),
};
