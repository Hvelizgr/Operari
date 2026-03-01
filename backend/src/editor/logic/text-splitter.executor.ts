
import { TextSplitterNodeConfig, TextSplitterResult, ExecutionInput } from '../../types/workflow.types';
import { TextSplitterService } from '../../services/ai/text-splitter.service';

export class TextSplitterExecutor {
    async execute(config: TextSplitterNodeConfig, input: ExecutionInput): Promise<TextSplitterResult> {
        const chunkSize = config.chunkSize || 1000;
        const chunkOverlap = config.chunkOverlap || 200;
        const inputField = config.inputField || 'text';
        
        let text = (input as any)[inputField];
        if (!text && (input as any).text) {
            text = (input as any).text;
        }
        
        const chunks = TextSplitterService.split(text || '', chunkSize, chunkOverlap);
        
        return {
            ...input,
            chunks,
            count: chunks.length
        };
    }
}
