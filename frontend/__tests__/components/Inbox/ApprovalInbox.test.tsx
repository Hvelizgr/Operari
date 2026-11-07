import { render, screen } from '@testing-library/react';

import ApprovalInbox from '@/components/Inbox/ApprovalInbox';

describe('ApprovalInbox', () => {
  it('shows only the linked approval when opened from a notification', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'a 1',
        status: 'APPROVED',
        message: 'Restart nginx?',
        runbook: { id: 'r1', slug: 'restart', name: 'Restart nginx' },
        executionId: 'e1',
        stepId: 's1',
        requestedBy: null,
        createdAt: '2026-11-07T10:00:00Z',
        approvedBy: 'user:u1',
        approvedAt: '2026-11-07T10:01:00Z',
        comment: null,
      }),
    }) as unknown as typeof fetch;

    render(<ApprovalInbox lang="es" focusId="a 1" />);

    expect(await screen.findByText('Restart nginx')).toBeInTheDocument();
    expect(screen.getByText('Ver todas las aprobaciones')).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/api/approvals/a%201');
    expect(screen.queryByRole('button', { name: /approve|aprobar/i })).not.toBeInTheDocument();
  });

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
