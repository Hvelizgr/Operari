
import fs from 'fs';
import path from 'path';
import { NodePlugin } from './PluginInterface';

export class PluginManager {
    private static instance: PluginManager;
    private plugins: Map<string, NodePlugin> = new Map();
    private pluginsDir: string;

    private constructor(pluginsDir: string) {
        this.pluginsDir = pluginsDir;
    }

    public static getInstance(pluginsDir?: string): PluginManager {
        if (!PluginManager.instance) {
            PluginManager.instance = new PluginManager(pluginsDir || './plugins');
        }
        return PluginManager.instance;
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
            // Priority: index.ts (dev) -> index.js (prod)
            let entryPoint = path.join(dirPath, 'index.ts');
            if (!fs.existsSync(entryPoint)) {
                entryPoint = path.join(dirPath, 'index.js');
            }
            
            if (fs.existsSync(entryPoint)) {
                // Clear cache for hot-reloading support
                delete require.cache[require.resolve(entryPoint)];
                
                const pluginModule = require(entryPoint);
                // Handle both 'export default' and 'module.exports'
                const PluginClass = pluginModule.default || pluginModule;
                
                if (typeof PluginClass === 'function') {
                    const pluginInstance = new PluginClass();
                    if (pluginInstance.meta && typeof pluginInstance.execute === 'function') {
                        const pluginName = pluginInstance.meta.name || path.basename(dirPath);
                        this.plugins.set(pluginName, pluginInstance);
                        console.log(`[PluginManager] Loaded plugin: ${pluginName} (v${pluginInstance.meta.version})`);
                    }
                }
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
