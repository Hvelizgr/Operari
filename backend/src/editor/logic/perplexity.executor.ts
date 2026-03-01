
import { PerplexityNodeConfig, PerplexityResult, ExecutionInput } from '../../types/workflow.types';
import { PerplexityService } from '../../services/ai/perplexity.service';

export class PerplexityExecutor {
    async execute(config: PerplexityNodeConfig, input: ExecutionInput): Promise<PerplexityResult> {
        const service = PerplexityService.getInstance();
        const model = config.model || 'sonar-small-online';
        const apiKey = process.env.PERPLEXITY_API_KEY;
        const inputField = config.inputField || 'query';
        
        let query = config.query;
        
        if (!query) {
            query = (input as any)[inputField];
            if (!query && (input as any).text) query = (input as any).text;
            else if (!query && (input as any).message) query = (input as any).message;
        }
        
        const answer = await service.searchCallback(query || 'news', model, apiKey);
        
        return {
            ...input,
            response: answer,
            citations: [],
            model,
        };
    }
}
