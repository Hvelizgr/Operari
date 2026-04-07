import axios, { AxiosInstance } from 'axios';
import type {
    CreateTicketNodeConfig,
    CreateTicketResult,
    ExecutionInput,
} from '../../types/workflow.types';
import type { EditorNodeExecutor, NodeErrorContext, NodeExecutorDeps } from './_shared';
import { resolveTemplate } from './_shared';
import { NodeExecutionError, ErrorCode } from '../../errors/custom-error';

/**
 * Create-ticket node — POSTs a ticket payload to a generic webhook.
 *
 * Behavior preserved exactly from the legacy `executeCreateTicket`:
 *   - Throws CONFIGURATION_ERROR when webhookUrl is missing
 *   - Resolves {{templates}} in webhookUrl, subject, body
 *   - POSTs { subject, body, source, inputContext } via axios
 *   - On failure, wraps the axios error as
 *     NodeExecutionError(EXTERNAL_SERVICE_UNAVAILABLE) with the
 *     resolved URL in context
 *
 * Note: the `source: 'NanoFlow'` field is preserved AS-IS even though
 * the project is rebranding to NanoRun, because changing it would
 * break any existing ticketing webhooks that filter on that string.
 * The user can opt into rebranding it via a follow-up PR with a
 * migration note.
 *
 * The HTTP client is injected so tests can swap it without monkey-
 * patching the global axios.
 */
export class CreateTicketNodeExecutor
    implements EditorNodeExecutor<CreateTicketNodeConfig, CreateTicketResult> {
    readonly type = 'CreateTicket';

    constructor(
        private readonly deps: Pick<NodeExecutorDeps, 'logger'>,
        private readonly http: Pick<AxiosInstance, 'post'> = axios,
    ) { }

    async execute(
        config: CreateTicketNodeConfig,
        input: ExecutionInput,
        errorContext: NodeErrorContext,
    ): Promise<CreateTicketResult> {
        const { webhookUrl, subject, body } = config;

        if (!webhookUrl) {
            throw new NodeExecutionError({
                ...errorContext,
                message: 'Webhook URL is not defined for Create Ticket operation',
                userMessage: 'Webhook URL for ticket creation is empty',
                code: ErrorCode.CONFIGURATION_ERROR,
            });
        }

        const resolvedWebhookUrl = resolveTemplate(webhookUrl, input);
        const resolvedSubject = resolveTemplate(subject || '', input);
        const resolvedBody = resolveTemplate(body || '', input);

        try {
            const response = await this.http.post(resolvedWebhookUrl, {
                subject: resolvedSubject,
                body: resolvedBody,
                source: 'NanoFlow',
                inputContext: input,
            });

            return {
                success: true,
                response: response.data,
                webhookUrl: resolvedWebhookUrl,
            };
        } catch (error) {
            const ticketError = new NodeExecutionError({
                ...errorContext,
                message: `Failed to create ticket: ${error instanceof Error ? error.message : String(error)}`,
                code: ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
                userMessage: 'Failed to send ticket information to external system',
                cause: error instanceof Error ? error : undefined,
                context: { webhookUrl: resolvedWebhookUrl },
            });
            this.deps.logger.error('Create Ticket node failed', { error: ticketError });
            throw ticketError;
        }
    }
}
