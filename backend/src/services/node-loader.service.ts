import fs from 'fs';
import path from 'path';
import { Logger } from './logger.service';

export interface DynamicNodeDefinition {
    id: string; // e.g. "my-custom-node"
    name: string;
    description?: string;
    version: string;
    executor: any; // Class or object with execute method
}

export class NodeLoaderService {
    private static instance: NodeLoaderService;
    private logger: Logger;
    private nodes = new Map<string, DynamicNodeDefinition>();
    private nodesDir: string;

    private constructor() {
        this.logger = Logger.getInstance();
        // Default to 'custom-nodes' in root, or configurable via env
        this.nodesDir = process.env.CUSTOM_NODES_DIR || path.join(process.cwd(), 'custom-nodes');
    }

    public static getInstance(): NodeLoaderService {
        if (!NodeLoaderService.instance) {
            NodeLoaderService.instance = new NodeLoaderService();
        }
        return NodeLoaderService.instance;
    }

    public async initialize(): Promise<void> {
        if (!fs.existsSync(this.nodesDir)) {
            this.logger.info(`Creating custom nodes directory: ${this.nodesDir}`);
            fs.mkdirSync(this.nodesDir, { recursive: true });
        }

        await this.scanAndLoad();
        this.startWatcher();
    }

    private startWatcher() {
        if (!fs.existsSync(this.nodesDir)) return;

        this.logger.info(`Starting hot-reload watcher on ${this.nodesDir}`);
        
        let debounceTimer: NodeJS.Timeout;

        fs.watch(this.nodesDir, { recursive: true }, (eventType, filename) => {
            if (!filename || !filename.endsWith('.js')) return;

            // Debounce to avoid double events
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                this.logger.info(`File changed: ${filename}. Reloading node...`);
                await this.loadNodeFile(path.join(this.nodesDir, filename));
            }, 100);
        });
    }

    public getExecutor(nodeType: string): any | undefined {
        return this.nodes.get(nodeType)?.executor;
    }

    private async scanAndLoad(): Promise<void> {
        this.logger.info(`Scanning for custom nodes in ${this.nodesDir}...`);
        
        try {
            const entries = fs.readdirSync(this.nodesDir, { withFileTypes: true });

            for (const entry of entries) {
                // Support both single file .js nodes and folders with index.js
                if (entry.isFile() && entry.name.endsWith('.js')) {
                    await this.loadNodeFile(path.join(this.nodesDir, entry.name));
                } else if (entry.isDirectory()) {
                    const indexFile = path.join(this.nodesDir, entry.name, 'index.js');
                    if (fs.existsSync(indexFile)) {
                        await this.loadNodeFile(indexFile);
                    }
                }
            }
        } catch (error) {
            this.logger.error('Failed to scan custom nodes directory', { error: error as Error });
        }
    }

    private async loadNodeFile(filePath: string): Promise<void> {
        try {
            // Clear cache to allow hot-reloading simulation (simple version)
            delete require.cache[require.resolve(filePath)];
            
            // Dynamic require
            const nodeModule = require(filePath);
            
            // Expected format: module.exports = { id: '...', version: '...', executor: Class/Object }
            if (!nodeModule.id || !nodeModule.executor) {
                this.logger.warn(`Skipping invalid node file: ${filePath}. Missing id or executor.`);
                return;
            }

            this.nodes.set(nodeModule.id, {
                id: nodeModule.id,
                name: nodeModule.name || nodeModule.id,
                description: nodeModule.description,
                version: nodeModule.version || '1.0.0',
                executor: nodeModule.executor // Class or instance
            });

            this.logger.info(`Loaded custom node: ${nodeModule.id} (v${nodeModule.version})`);

        } catch (error) {
            this.logger.error(`Failed to load node file: ${filePath}`, { error: error as Error });
        }
    }
    
    // Future: implement watch() with chokidar or @parcel/watcher
}
