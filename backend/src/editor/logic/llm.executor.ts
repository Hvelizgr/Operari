
import { LLMNodeConfig, LLMResult, ExecutionInput } from '../../types/workflow.types';
import { LLMService } from '../../services/ai/llm.service';

export class LLMExecutor {
    async execute(config: LLMNodeConfig, input: ExecutionInput): Promise<LLMResult> {
        const service = LLMService.getInstance();
        const provider = config.provider || 'local';
        const model = config.model || 'gpt-3.5-turbo';
        const apiKey = process.env.OPENAI_API_KEY;
        const systemMessage = config.systemPrompt;
        const inputField = config.inputField || 'text';
        
        let prompt = config.prompt;
        
        if (!prompt) {
            prompt = (input as any)[inputField];
            if (!prompt && (input as any).text) prompt = (input as any).text;
            else if (!prompt && (input as any).data?.text) prompt = (input as any).data.text;
            else if (!prompt) prompt = JSON.stringify(input);
        }
        
        const response = await service.chatCompletion(prompt || '', provider, model, apiKey, systemMessage);
        
        return {
            ...input,
            response,
            model,
        };
    }
}
