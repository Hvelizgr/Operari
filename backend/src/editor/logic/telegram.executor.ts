
import { TelegramNodeConfig, TelegramResult, ExecutionInput } from '../../types/workflow.types';
import { TelegramService } from '../../services/integrations/telegram.service';

export class TelegramExecutor {
    async execute(config: TelegramNodeConfig, input: ExecutionInput): Promise<TelegramResult> {
        const service = TelegramService.getInstance();
        const operation = config.operation || 'sendMessage';
        const token = process.env.TELEGRAM_BOT_TOKEN || 'mock_token';
        const chatId = config.chatId || process.env.TELEGRAM_CHAT_ID || '123456';
        
        const result: TelegramResult = { 
            ...input,
            success: false
        };

        try {
            switch (operation) {
                case 'sendMessage': {
                    let text = config.message;
                    if (!text) {
                        if (typeof (input as any).data === 'string') text = (input as any).data;
                        else if ((input as any).text) text = (input as any).text;
                        else if ((input as any).response) text = (input as any).response;
                        else text = JSON.stringify(input);
                    }

                    const response = await service.sendMessage(token, chatId, text || 'Hello from NanoFlow!');
                    result.success = true;
                    result.response = response;
                    result.chatId = chatId;
                    break;
                }
            }
        } catch (error) {
            result.success = false;
            result.response = { error: (error as Error).message };
        }

        return result;
    }
}
