
export class TelegramService {
    private static instance: TelegramService;

    public static getInstance(): TelegramService {
        if (!TelegramService.instance) {
            TelegramService.instance = new TelegramService();
        }
        return TelegramService.instance;
    }

    async sendMessage(token: string, chatId: string, text: string): Promise<any> {
        if (!token || token === 'mock_token') {
            console.log(`[Telegram Mock] Sending to ${chatId}: ${text}`);
            return { ok: true, result: { message_id: 123, text } };
        }

        try {
            const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text })
            });

            const data = await response.json();
            if (!data.ok) {
                throw new Error(`Telegram API Error: ${data.description}`);
            }
            return data;
        } catch (error) {
            console.error('Telegram Service Error:', error);
            throw error;
        }
    }
}
