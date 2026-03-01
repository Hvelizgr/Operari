
import { VectorStoreNodeConfig, VectorStoreResult, ExecutionInput } from '../../types/workflow.types';
import { VectorStoreService, VectorDocument } from '../../services/ai/vector-store.service';

export class VectorStoreExecutor {
    async execute(config: VectorStoreNodeConfig, input: ExecutionInput): Promise<VectorStoreResult> {
        const service = VectorStoreService.getInstance();
        const operation = config.operation || 'upsert';
        const provider = config.provider || 'memory';
        const collection = config.collection || 'default';
        
        if (operation === 'upsert') {
            const docs: VectorDocument[] = [];
            const inputData = Array.isArray(input) ? input : [input];
            
            inputData.forEach((item: any, index: number) => {
                const vector = item.vector || item.embedding;
                if (vector && Array.isArray(vector)) {
                    docs.push({
                        id: item.id || `doc_${Date.now()}_${index}`,
                        vector: vector,
                        text: item.text,
                        metadata: item.metadata
                    });
                }
            });
            
            if (docs.length === 0) {
                const vector = (input as any).vector || (input as any).embedding;
                if (vector && Array.isArray(vector)) {
                    docs.push({
                        id: (input as any).id || `doc_${Date.now()}`,
                        vector: vector,
                        text: (input as any).text,
                        metadata: (input as any).metadata
                    });
                }
            }
            
            const result = await service.upsert(provider, collection, docs, config);
            return {
                ...input,
                success: true,
                count: result.count,
                ids: docs.map(d => d.id)
            };
        } 
        
        if (operation === 'query') {
            const queryVector = config.queryVector || (input as any).vector || (input as any).embedding;
            if (!queryVector || !Array.isArray(queryVector)) {
                throw new Error('Input must contain a query vector/embedding for query');
            }
            
            const topK = config.topK || 5;
            const results = await service.search(provider, collection, queryVector, topK, config);
            return {
                ...input,
                success: true,
                matches: results.map((r: any) => ({
                    id: r.id,
                    score: r.score,
                    text: r.text,
                    metadata: r.metadata
                })),
                sources: results.map((r: any, idx: number) => ({
                    index: idx + 1,
                    id: r.id,
                    text: r.text?.substring(0, 200) + (r.text?.length > 200 ? '...' : ''),
                    score: Math.round(r.score * 100),
                    metadata: r.metadata
                })),
                count: results.length
            };
        }

        if (operation === 'delete') {
            const ids = config.ids || [];
            return {
                ...input,
                success: true,
                ids,
                count: ids.length
            };
        }
        
        return { ...input, success: true };
    }
}
