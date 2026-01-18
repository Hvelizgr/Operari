
export const id = 'slack-node';
export const name = 'Slack';
export const description = 'Send messages to Slack';
export const version = '1.0.0';

export class SlackNode {
    meta = {
        name: 'Slack',
        version: '1.0.0',
        description: 'Send messages to Slack',
        author: 'NanoFlow',
        category: 'Communication',
        icon: 'slack'
    };

    async execute(input: any, context: any) {
        context.log('Executing Slack Node...');
        
        const { webhookUrl, message } = input;
        
        if (!webhookUrl) {
            throw new Error('Slack Webhook URL is required');
        }

        if (!message) {
            throw new Error('Message is required');
        }

        try {
            // Use axios to send the webhook
            const axios = require('axios');
            const response = await axios.post(webhookUrl, {
                text: message
            });

            context.log(`Slack response status: ${response.status}`);
            
            return {
                success: true,
                status: response.status,
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            context.log(`Slack node error: ${error.message}`);
            throw new Error(`Failed to send Slack message: ${error.message}`);
        }
    }
}

export const executor = new SlackNode();
