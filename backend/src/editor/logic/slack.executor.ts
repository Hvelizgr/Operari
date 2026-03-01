
import { SlackNodeConfig, SlackResult, ExecutionInput } from '../../types/workflow.types';
import { SlackService } from '../../services/integrations/slack.service';

export class SlackExecutor {
    async execute(config: SlackNodeConfig, input: ExecutionInput): Promise<SlackResult> {
        const service = SlackService.getInstance();
        const webhookUrl = process.env.SLACK_WEBHOOK_URL || 'mock_url';
        
        const result: SlackResult = { 
            ...input,
            success: false 
        };

        try {
            let text = config.message;
            if (!text) {
                if (typeof (input as any).data === 'string') text = (input as any).data;
                else if ((input as any).text) text = (input as any).text;
                else if ((input as any).response) text = (input as any).response;
                else text = JSON.stringify(input);
            }

            const response = await service.sendMessage(webhookUrl, text || 'Hello from NanoFlow!', config.channel);
            result.success = true;
            result.response = response;
            result.channel = config.channel;
        } catch (error) {
            result.success = false;
            result.response = { error: (error as Error).message };
        }

        return result;
    }
}
