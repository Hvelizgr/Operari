
import { MemoryNodeConfig, MemoryResult, ExecutionInput } from '../../types/workflow.types';
import { MemoryService } from '../../services/ai/memory.service';

export class MemoryExecutor {
    async execute(config: MemoryNodeConfig, input: ExecutionInput): Promise<MemoryResult> {
        const service = MemoryService.getInstance();
        const operation = config.operation || 'get';
        const namespace = config.namespace || 'default';
        const key = config.key || 'default_key';
        
        const result: MemoryResult = { ...input, success: true };

        switch (operation) {
            case 'set': {
                let value = config.value;
                if (value === undefined) {
                    if ((input as any).data) value = (input as any).data;
                    else if ((input as any).text) value = (input as any).text;
                    else value = input;
                }
                await service.addMessage(namespace, 'system', JSON.stringify({ key, value }));
                result.key = key;
                result.value = value;
                break;
            }

            case 'get': {
                const history = await service.getHistory(namespace, 100);
                const found = history.find(m => {
                    try {
                        const parsed = JSON.parse(m.content);
                        return parsed.key === key;
                    } catch {
                        return false;
                    }
                });
                if (found) {
                    try {
                        const parsed = JSON.parse(found.content);
                        result.value = parsed.value;
                    } catch { /* ignore parse errors */ }
                }
                result.key = key;
                break;
            }

            case 'delete':
                await service.clearHistory(namespace);
                result.key = key;
                break;

            case 'list': {
                const allHistory = await service.getHistory(namespace, 1000);
                const keys = allHistory.map(m => {
                    try {
                        return JSON.parse(m.content).key;
                    } catch {
                        return null;
                    }
                }).filter(Boolean);
                result.keys = [...new Set(keys)] as string[];
                break;
            }
        }

        return result;
    }
}
