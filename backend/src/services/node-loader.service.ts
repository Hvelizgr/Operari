import { Logger } from './logger.service';

export interface DynamicNodeDefinition {
    id: string;
    name: string;
    description?: string;
    version: string;
    executor: any;
}

export class NodeLoaderService {
    private static instance: NodeLoaderService;
    private logger: Logger;
    private nodes = new Map<string, DynamicNodeDefinition>();

    private constructor() {
        this.logger = Logger.getInstance();
    }

    public static getInstance(): NodeLoaderService {
        if (!NodeLoaderService.instance) {
            NodeLoaderService.instance = new NodeLoaderService();
        }
        return NodeLoaderService.instance;
    }

    public async initialize(): Promise<void> {
        this.logger.info('NodeLoaderService initialized (nodes loaded from n8n API)');
    }

    public getExecutor(nodeType: string): any | undefined {
        return this.nodes.get(nodeType)?.executor;
    }
    
    public getLoadedNodes(): DynamicNodeDefinition[] {
        return Array.from(this.nodes.values());
    }
}
