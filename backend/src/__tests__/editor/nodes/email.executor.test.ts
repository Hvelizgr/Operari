import { EmailNodeExecutor } from '../../../editor/nodes/email.executor';
import { ExternalServiceError, ErrorCode } from '../../../errors/custom-error';
import type { Logger } from '../../../services/logger.service';
import type { EmailTransporterLike } from '../../../editor/nodes/_shared';

const buildLogger = () => {
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  return { logger: logger as unknown as Logger, spy: logger };
};

const buildTransporter = (
  sendMailImpl: jest.Mock = jest.fn().mockResolvedValue({
    messageId: 'msg-1',
    accepted: ['to@example.test'],
    rejected: [],
  })
): EmailTransporterLike => ({ sendMail: sendMailImpl });

const errCtx = { nodeId: 'n', nodeName: 'Email', nodeType: 'Email' };

describe('EmailNodeExecutor', () => {
  it('exposes type=Email and custom.email alias', () => {
    const exec = new EmailNodeExecutor({
      ...buildLogger(),
      getEmailTransporter: () => buildTransporter(),
    });
    expect(exec.type).toBe('Email');
    expect(exec.aliases).toEqual(['custom.email']);
  });

  it('throws ExternalServiceError(EMAIL_NOT_CONFIGURED) when no transporter', async () => {
    const exec = new EmailNodeExecutor({
      ...buildLogger(),
      getEmailTransporter: () => null,
    });
    try {
      await exec.execute({ to: 'a@b.test', subject: 's', body: 'b' }, {}, errCtx);
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ExternalServiceError);
      expect((err as ExternalServiceError).code).toBe(ErrorCode.EMAIL_NOT_CONFIGURED);
    }
  });

  it('resolves templates and forwards to transporter.sendMail', async () => {
    const sendMail = jest.fn().mockResolvedValue({
      messageId: 'mid-7',
      accepted: ['ops@example.test'],
      rejected: [],
    });
    const exec = new EmailNodeExecutor({
      ...buildLogger(),
      getEmailTransporter: () => buildTransporter(sendMail),
    });

    const result = await exec.execute(
      {
        to: '{{owner}}@example.test',
        subject: 'Run {{runId}} done',
        body: 'Status: {{status}}',
      },
      { owner: 'ops', runId: 'r-42', status: 'success' },
      errCtx
    );

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@example.test',
        subject: 'Run r-42 done',
        text: 'Status: success',
      })
    );
    expect(result.messageId).toBe('mid-7');
    expect(result.accepted).toEqual(['ops@example.test']);
  });

  it('wraps unknown sendMail failures into ExternalServiceError', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('SMTP rejected'));
    const { logger, spy } = buildLogger();
    const exec = new EmailNodeExecutor({
      logger,
      getEmailTransporter: () => buildTransporter(sendMail),
    });

    await expect(
      exec.execute({ to: 'x@y', subject: 's', body: 'b' }, {}, errCtx)
    ).rejects.toBeInstanceOf(ExternalServiceError);

    expect(spy.error).toHaveBeenCalled();
  });
});
