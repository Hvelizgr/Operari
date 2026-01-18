
import fs from 'fs';
import path from 'path';
import { NodePlugin } from './PluginInterface';

export class PluginManager {
    private plugins: Map<string, NodePlugin> = new Map();
    private pluginsDir: string;

    constructor(pluginsDir: string) {
        this.pluginsDir = pluginsDir;
    }

    public async loadPlugins(): Promise<void> {
        if (!fs.existsSync(this.pluginsDir)) {
            console.warn(`[PluginManager] Plugins directory not found: ${this.pluginsDir}`);
            return;
        }

        const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                await this.loadPluginFromDir(path.join(this.pluginsDir, entry.name));
            }
        }
    }

    private async loadPluginFromDir(dirPath: string): Promise<void> {
        try {
            // Check for package.json or index.js
            // This is a simplified loader. In production we might use 'require' dynamically
            // or a more sophisticated sandbox like 'vm2' or 'isolated-vm'.
            
            // For MVP: assume index.ts/js exports a 'plugin' object conforming to NodePlugin
            const entryPoint = path.join(dirPath, 'index.ts'); 
            
            if (fs.existsSync(entryPoint)) {
                // Dynamic import is tricky with TS-Node at runtime vs compiled JS.
                // For this prototype, we'll simulate loading by just logging.
                // In a real implementation, we'd use: const pluginModule = await import(entryPoint);
                console.log(`[PluginManager] Detected potential plugin at ${dirPath}`);
            }
        } catch (error) {
            console.error(`[PluginManager] Failed to load plugin from ${dirPath}:`, error);
        }
    }

    public getPlugin(name: string): NodePlugin | undefined {
        return this.plugins.get(name);
    }

    public getAllPlugins(): NodePlugin[] {
        return Array.from(this.plugins.values());
    }
}
