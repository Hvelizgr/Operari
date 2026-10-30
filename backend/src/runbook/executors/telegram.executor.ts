import { ExecutorContext, resolveTemplate } from '../types/executor.types';
import { ApiRequest, ApiStepExecutor } from './_api-step';

export interface TelegramConfig {
  /** Bot token from @BotFather. Usually `{{secrets.<id>}}`. */
  botToken: string;
  chatId: string;
  text: string;
  parseMode?: 'none' | 'Markdown' | 'HTML';
  disableNotification?: boolean;
}

/** Telegram Bot API — send a message to a chat, group or channel. */
export class TelegramExecutor extends ApiStepExecutor<TelegramConfig> {
  readonly type = 'telegram.message';

  protected build(config: TelegramConfig, context: ExecutorContext): ApiRequest | string {
    const r = (v?: string) => resolveTemplate(v ?? '', context);
    const token = r(config.botToken);
    const chatId = r(config.chatId);
    const text = r(config.text);
    if (!token) return 'botToken is required';
    if (!chatId) return 'chatId is required';
    if (!text) return 'text is required';
    return {
      method: 'POST',
      url: `https://api.telegram.org/bot${token}/sendMessage`,
      body: {
        chat_id: chatId,
        text: text.slice(0, 4096),
        ...(config.parseMode && config.parseMode !== 'none'
          ? { parse_mode: config.parseMode }
          : {}),
        disable_notification: config.disableNotification ?? false,
      },
      describe: `Telegram message to ${chatId} — ${text.slice(0, 120)}`,
    };
  }

  protected shapeOutput(body: unknown, status: number) {
    const b = (body ?? {}) as { result?: { message_id?: number } };
    return { status, messageId: b.result?.message_id };
  }
}
