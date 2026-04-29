process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long-123';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://x:y@localhost:5432/z';

import { MonitorAlertService } from '../../services/monitor-alert.service';

jest.mock('../../services/email.service', () => ({
  sendEmail: jest.fn(),
}));

const { sendEmail } = require('../../services/email.service') as {
  sendEmail: jest.Mock;
};

const monitor = (
  overrides: Partial<{
    id: string;
    name: string;
    alertWebhookUrl: string | null;
    alertEmail: string | null;
    runbookId: string;
  }> = {}
) => ({
  id: 'mon-1',
  name: 'deploys-per-hour',
  alertWebhookUrl: null,
  alertEmail: null,
  runbookId: 'wf-1',
  ...overrides,
});

describe('MonitorAlertService.fire', () => {
  beforeEach(() => jest.clearAllMocks());

  it('no-ops (delivered=false) when neither channel is configured', async () => {
    const fetchMock = jest.fn();
    const svc = new MonitorAlertService(fetchMock as unknown as typeof fetch);

    const result = await svc.fire({ monitor: monitor(), reason: 'no success in 60m' });
    expect(result.delivered).toBe(false);
    expect(result.channels).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('POSTs a Slack-shaped body to the webhook when alertWebhookUrl is set', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    const svc = new MonitorAlertService(fetchMock as unknown as typeof fetch);

    const result = await svc.fire({
      monitor: monitor({ alertWebhookUrl: 'https://hooks.slack.com/test' }),
      reason: 'no_success_in_last_60m',
    });
    expect(result.channels.slack).toBe('sent');
    expect(result.delivered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hooks.slack.com/test');
    const parsed = JSON.parse((opts as RequestInit).body as string) as {
      text: string;
      attachments: Array<{ text: string }>;
    };
    expect(parsed.text).toContain('deploys-per-hour');
    expect(parsed.attachments[0].text).toBe('no_success_in_last_60m');
  });

  it('marks the slack channel failed on non-2xx', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const svc = new MonitorAlertService(fetchMock as unknown as typeof fetch);

    const result = await svc.fire({
      monitor: monitor({ alertWebhookUrl: 'https://hooks.slack.com/test' }),
      reason: 'boom',
    });
    expect(result.channels.slack).toBe('failed');
    expect(result.delivered).toBe(false);
  });

  it('marks the slack channel failed when fetch throws', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('EAI_AGAIN'));
    const svc = new MonitorAlertService(fetchMock as unknown as typeof fetch);

    const result = await svc.fire({
      monitor: monitor({ alertWebhookUrl: 'https://hooks.slack.com/test' }),
      reason: 'boom',
    });
    expect(result.channels.slack).toBe('failed');
  });

  it('sends an email via the existing sendEmail helper when alertEmail is set', async () => {
    sendEmail.mockResolvedValue({ delivered: true });
    const svc = new MonitorAlertService(jest.fn() as unknown as typeof fetch);

    const result = await svc.fire({
      monitor: monitor({ alertEmail: 'ops@acme.test' }),
      reason: 'failure_rate=0.85>0.5',
      contextLine: 'runbook: Deploy prod',
    });
    expect(result.channels.email).toBe('sent');
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@acme.test',
        subject: expect.stringContaining('deploys-per-hour'),
        text: expect.stringContaining('failure_rate=0.85>0.5'),
      })
    );
    // contextLine should land in the body
    const call = sendEmail.mock.calls[0][0] as { text: string };
    expect(call.text).toContain('runbook: Deploy prod');
  });

  it('treats loggedOnly (self-host no provider) as delivered for email', async () => {
    sendEmail.mockResolvedValue({ delivered: false, loggedOnly: true });
    const svc = new MonitorAlertService(jest.fn() as unknown as typeof fetch);

    const result = await svc.fire({
      monitor: monitor({ alertEmail: 'ops@acme.test' }),
      reason: 'r',
    });
    expect(result.channels.email).toBe('sent');
    expect(result.delivered).toBe(true);
  });

  it('dispatches both channels independently when both are configured', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    sendEmail.mockResolvedValue({ delivered: true });
    const svc = new MonitorAlertService(fetchMock as unknown as typeof fetch);

    const result = await svc.fire({
      monitor: monitor({
        alertWebhookUrl: 'https://hooks.slack.com/test',
        alertEmail: 'ops@acme.test',
      }),
      reason: 'r',
    });
    expect(result.channels.slack).toBe('sent');
    expect(result.channels.email).toBe('sent');
    expect(result.delivered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
