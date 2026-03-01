
import { EmbeddingsNodeConfig, EmbeddingsResult, ExecutionInput } from '../../types/workflow.types';
import { EmbeddingsService } from '../../services/ai/embeddings.service';

export class EmbeddingsExecutor {
    async execute(config: EmbeddingsNodeConfig, input: ExecutionInput): Promise<EmbeddingsResult> {
        const service = EmbeddingsService.getInstance();
        const provider = config.provider || 'local';
        const inputField = config.inputField || 'text';
        
        let textToEmbed = (input as any)[inputField];
        
        if (!textToEmbed && (input as any).text) {
            textToEmbed = (input as any).text;
        } else if (!textToEmbed && (input as any).data?.text) {
            textToEmbed = (input as any).data.text;
        } else if (!textToEmbed) {
            textToEmbed = JSON.stringify(input);
        }
        
        const apiKey = process.env.OPENAI_API_KEY;
        const vector = await service.embed(textToEmbed || '', provider, apiKey);
        
        return {
            ...input,
            embeddings: [vector],
            model: config.model,
            dimensions: config.dimensions || vector.length
        };
    }
}
