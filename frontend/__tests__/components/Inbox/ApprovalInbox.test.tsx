import { render, screen } from '@testing-library/react';

import ApprovalInbox from '@/components/Inbox/ApprovalInbox';

describe('ApprovalInbox', () => {
  it('renders the runbook name the API returns', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'a1',
            status: 'PENDING',
            message: 'Restart nginx?',
            runbook: { id: 'r1', slug: 'restart', name: 'Restart nginx' },
            executionId: 'e1',
            stepId: 's1',
            requestedBy: null,
            createdAt: '2026-11-07T10:00:00Z',
            approvedBy: null,
            approvedAt: null,
            comment: null,
          },
        ],
        nextCursor: null,
      }),
    }) as unknown as typeof fetch;

    render(<ApprovalInbox lang="en" />);

    expect(await screen.findByText('Restart nginx')).toBeInTheDocument();
  });
});
