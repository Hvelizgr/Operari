import { CreateTicketNodeExecutor } from '../../../editor/nodes/create-ticket.executor';
import { NodeExecutionError, ErrorCode } from '../../../errors/custom-error';
import type { Logger } from '../../../services/logger.service';

const buildLogger = () => {
    const logger = {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    };
    return { logger: logger as unknown as Logger, spy: logger };
};

const errCtx = { nodeId: 'n', nodeName: 'CreateTicket', nodeType: 'CreateTicket' };

describe('CreateTicketNodeExecutor', () => {
    it('exposes type=CreateTicket', () => {
        const exec = new CreateTicketNodeExecutor(buildLogger(), { post: jest.fn() });
        expect(exec.type).toBe('CreateTicket');
    });

    it('throws NodeExecutionError(CONFIGURATION_ERROR) when webhookUrl is missing', async () => {
        const exec = new CreateTicketNodeExecutor(buildLogger(), { post: jest.fn() });
        try {
            await exec.execute({ subject: 's', body: 'b' }, {}, errCtx);
            fail('expected throw');
        } catch (err) {
            expect(err).toBeInstanceOf(NodeExecutionError);
            expect((err as NodeExecutionError).code).toBe(ErrorCode.CONFIGURATION_ERROR);
        }
    });

    it('POSTs the resolved payload to the webhook and returns success', async () => {
        const post = jest.fn().mockResolvedValue({ data: { id: 'ticket-7' } });
        const exec = new CreateTicketNodeExecutor(buildLogger(), { post });

        const result = await exec.execute(
            {
                webhookUrl: 'https://hooks.test/{{tenant}}',
                subject: 'Run {{runId}} failed',
                body: 'Step {{step}} returned non-zero',
            },
            { tenant: 'acme', runId: 'r-1', step: 'deploy' },
            errCtx,
        );

        expect(post).toHaveBeenCalledTimes(1);
        const [url, payload] = post.mock.calls[0];
        expect(url).toBe('https://hooks.test/acme');
        expect(payload).toMatchObject({
            subject: 'Run r-1 failed',
            body: 'Step deploy returned non-zero',
            source: 'NanoFlow',
        });
        expect(payload.inputContext).toEqual({ tenant: 'acme', runId: 'r-1', step: 'deploy' });
        expect(result.success).toBe(true);
        expect(result.response).toEqual({ id: 'ticket-7' });
        expect(result.webhookUrl).toBe('https://hooks.test/acme');
    });

    it('wraps webhook errors as NodeExecutionError(EXTERNAL_SERVICE_UNAVAILABLE)', async () => {
        const post = jest.fn().mockRejectedValue(new Error('502 Bad Gateway'));
        const { logger, spy } = buildLogger();
        const exec = new CreateTicketNodeExecutor({ logger }, { post });

        try {
            await exec.execute(
                { webhookUrl: 'https://hooks.test/x', subject: 's', body: 'b' },
                {},
                errCtx,
            );
            fail('expected throw');
        } catch (err) {
            expect(err).toBeInstanceOf(NodeExecutionError);
            expect((err as NodeExecutionError).code).toBe(ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE);
        }
        expect(spy.error).toHaveBeenCalled();
    });
});
