
export interface NodePluginMetadata {
    name: string;
    version: string;
    description: string;
    author: string;
    inputs: Record<string, any>; // Schema for inputs
    outputs: Record<string, any>; // Schema for outputs
    icon?: string; // Base64 or URL
}

export interface NodePluginContext {
    log: (message: string) => void;
    // We can expose safe internal services here later
}

export interface NodePlugin {
    metadata: NodePluginMetadata;
    execute: (inputs: any, context: NodePluginContext) => Promise<any>;
}

export interface PluginManifest {
    id: string;
    entryPoint: string; // Relative path to the main file (e.g., index.js)
    enabled: boolean;
}
