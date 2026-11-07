jest.mock('../../../services/email.service', () => ({ sendEmail: jest.fn() }));
jest.mock('../../../security/ssrf-guard', () => ({ blockedTarget: jest.fn() }));

import { ApprovalNotifier,approvalUrl } from '../../../runbook/services/approval-notifier';
import { blockedTarget } from '../../../security/ssrf-guard';
import { sendEmail } from '../../../services/email.service';

const notice = {
  approvalId: 'a b',
  runbookName: 'Restart nginx',
  message: 'Restart prod?',
  escalated: false,
};

describe('ApprovalNotifier', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockResolvedValue({ ok: true });
    (blockedTarget as jest.Mock).mockResolvedValue(null);
    process.env.FRONTEND_URL = 'https://ops.example.com/';
  });

  afterEach(() => {
    delete process.env.FRONTEND_URL;
  });

  it('links to the inbox and carries no approving credential', () => {
    expect(approvalUrl('a b')).toBe('https://ops.example.com/inbox?approval=a%20b');
  });

  it('reports each channel on its own', async () => {
    (sendEmail as jest.Mock)
      .mockResolvedValueOnce({ delivered: true })
      .mockResolvedValueOnce({ delivered: false, loggedOnly: true });
    fetchMock.mockImplementation(async (url: string) => ({ ok: url.includes('slack') }));

    const result = await new ApprovalNotifier().send(notice, {
      emails: ['a@x.io', 'b@x.io'],
      slackWebhookUrl: 'https://hooks.slack.com/services/x',
      telegram: { botToken: 't', chatId: '1' },
    });

    expect(result).toEqual({
      email: { 'a@x.io': 'sent', 'b@x.io': 'logged' },
      slack: 'sent',
      telegram: 'failed',
    });
  });

  it('does not call a Slack URL the SSRF guard blocks, or one without https', async () => {
    (blockedTarget as jest.Mock).mockResolvedValue('blocked');
    const notifier = new ApprovalNotifier();
    const blocked = await notifier.send(notice, {
      emails: [],
      slackWebhookUrl: 'https://169.254.169.254/x',
    });
    const plain = await notifier.send(notice, { emails: [], slackWebhookUrl: 'http://x.io/y' });

    expect(blocked.slack).toBe('failed');
    expect(plain.slack).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('survives a network failure', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const result = await new ApprovalNotifier().send(notice, {
      emails: [],
      telegram: { botToken: 't', chatId: '1' },
    });
    expect(result.telegram).toBe('failed');
  });
});
