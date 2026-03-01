
import { DocumentParserNodeConfig, DocumentParserResult, ExecutionInput } from '../../types/workflow.types';
import { DocumentProcessorService } from '../../services/ai/document-processor.service';

export class DocumentParserExecutor {
    async execute(config: DocumentParserNodeConfig, input: ExecutionInput): Promise<DocumentParserResult> {
        const inputField = config.inputField || 'filePath';
        const filePath = (input as any)[inputField] || '';
        
        if (!filePath) {
             throw new Error('File path is required');
        }
        
        const service = DocumentProcessorService.getInstance();
        const text = await service.processFile(filePath);
        
        return {
            ...input,
            text,
            metadata: { parser: config.parser || 'auto' }
        };
    }
}
