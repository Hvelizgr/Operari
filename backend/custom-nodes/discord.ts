
export const id = 'discord-node';
export const name = 'Discord';
export const description = 'Send messages to Discord via Webhook';
export const version = '1.0.0';

export class DiscordNode {
    meta = {
        name: 'Discord',
        version: '1.0.0',
        description: 'Send messages to Discord via Webhook',
        author: 'NanoFlow',
        category: 'Communication',
        icon: 'message-square'
    };

    async execute(input: any, context: any) {
        context.log('Executing Discord Node...');
        
        const { webhookUrl, content, username, avatar_url } = input;
        
        if (!webhookUrl) {
            throw new Error('Discord Webhook URL is required');
        }

        if (!content) {
            throw new Error('Content is required');
        }

        try {
            const axios = require('axios');
            const response = await axios.post(webhookUrl, {
                content,
                username: username || 'NanoFlow Bot',
                avatar_url
            });

            context.log(`Discord response status: ${response.status}`);
            
            return {
                success: true,
                status: response.status,
                timestamp: new Date().toISOString()
            };
        } catch (error: any) {
            context.log(`Discord node error: ${error.message}`);
            throw new Error(`Failed to send Discord message: ${error.message}`);
        }
    }
}

export const executor = new DiscordNode();
