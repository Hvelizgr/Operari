import { ExecutorContext, resolveTemplate } from '../types/executor.types';
import { ApiRequest, ApiStepExecutor } from './_api-step';

export interface TeamsConfig {
  /** Teams Workflows ("Post to a channel when a webhook request is received") URL. */
  webhookUrl: string;
  title?: string;
  text: string;
}

/**
 * Microsoft Teams — posts an Adaptive Card through an incoming Workflows
 * webhook, the replacement for the retired Office 365 connectors.
 */
export class TeamsExecutor extends ApiStepExecutor<TeamsConfig> {
  readonly type = 'teams.message';

  protected build(config: TeamsConfig, context: ExecutorContext): ApiRequest | string {
    const r = (v?: string) => resolveTemplate(v ?? '', context);
    const url = r(config.webhookUrl);
    const text = r(config.text);
    if (!url) return 'webhookUrl is required';
    if (!text) return 'text is required';
    let host: string;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return 'webhookUrl must use https';
      host = parsed.hostname;
    } catch {
      return 'webhookUrl is not a valid URL';
    }
    const title = r(config.title);
    return {
      method: 'POST',
      url,
      body: {
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
              type: 'AdaptiveCard',
              version: '1.4',
              body: [
                ...(title
                  ? [
                      {
                        type: 'TextBlock',
                        text: title,
                        weight: 'Bolder',
                        size: 'Medium',
                        wrap: true,
                      },
                    ]
                  : []),
                { type: 'TextBlock', text, wrap: true },
              ],
            },
          },
        ],
      },
      describe: `Teams message via ${host} — ${(title || text).slice(0, 120)}`,
    };
  }
}
