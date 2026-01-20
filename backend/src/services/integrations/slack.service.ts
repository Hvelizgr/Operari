
export class SlackService {
    private static instance: SlackService;

    public static getInstance(): SlackService {
        if (!SlackService.instance) {
            SlackService.instance = new SlackService();
        }
        return SlackService.instance;
    }

    async sendMessage(webhookUrl: string, text: string, channel?: string): Promise<any> {
        if (!webhookUrl || webhookUrl === 'mock_url') {
            console.log(`[Slack Mock] Sending to ${channel || 'default'}: ${text}`);
            return { ok: true, text: 'ok' };
        }

        try {
            // Slack Webhooks are simple POST requests
            const body: any = { text };
            if (channel) body.channel = channel;

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const responseText = await response.text();
            if (response.status !== 200) {
                 throw new Error(`Slack API Error: ${responseText}`);
            }
            return { ok: true, result: responseText };

        } catch (error) {
            console.error('Slack Service Error:', error);
            throw error;
        }
    }
}
