
export interface VectorDocument {
    id: string;
    vector: number[];
    metadata?: Record<string, any>;
    text?: string;
}

export class VectorStoreService {
    private static instance: VectorStoreService;
    private memoryStore: Map<string, VectorDocument[]> = new Map();

    public static getInstance(): VectorStoreService {
        if (!VectorStoreService.instance) {
            VectorStoreService.instance = new VectorStoreService();
        }
        return VectorStoreService.instance;
    }

    async upsert(provider: string, collection: string, docs: VectorDocument[], _config: any): Promise<any> {
        if (provider === 'memory') {
            const current = this.memoryStore.get(collection) || [];
            // Simple append for now (should dedupe by ID)
            this.memoryStore.set(collection, [...current, ...docs]);
            return { success: true, count: docs.length, provider: 'memory' };
        }
        
        if (provider === 'qdrant_rest') {
            // Placeholder for Qdrant REST API implementation
            // Need URL and API Key from config
            return { success: false, message: 'Qdrant REST not implemented yet' };
        }
        
        throw new Error(`Unknown provider: ${provider}`);
    }

    async search(provider: string, collection: string, queryVector: number[], limit: number = 5, _config: any): Promise<any[]> {
        if (provider === 'memory') {
            const docs = this.memoryStore.get(collection) || [];
            if (docs.length === 0) return [];

            const results = docs.map(doc => ({
                ...doc,
                score: this.cosineSimilarity(queryVector, doc.vector)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
            
            return results;
        }

        throw new Error(`Unknown provider: ${provider}`);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
