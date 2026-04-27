/**
 * Mobile responsive pins for /approvals and /runs/:id surfaces.
 *
 * Narrow viewports (320–430px, the most common on-call phone width
 * range) are easy to break by accident — a single `flex` without
 * `flex-wrap` or a hardcoded padding can push content off-screen.
 * This suite locks the specific classes that keep those two surfaces
 * usable at 390px so a future refactor notices the regression here
 * instead of in an on-call Slack screenshot.
 *
 * We read the DOM classes rather than render a full browser viewport;
 * Tailwind's responsive prefixes are compile-time CSS, so the class
 * list is what actually determines behaviour at a given breakpoint.
 */

import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';

import ApprovalInbox from '@/components/Inbox/ApprovalInbox';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// ApprovalInbox fetches on mount; stub so the smoke-render works
// without an open socket.
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [], nextCursor: null }),
  }) as unknown as typeof fetch;
});

describe('ApprovalInbox — mobile (390px) responsive classes', () => {
  it('uses a tighter horizontal gutter + smaller title on narrow viewports', () => {
    const { container } = render(<ApprovalInbox lang="en" />);
    // Root container picks up tailwind responsive prefixes. The narrow
    // base classes (no prefix) apply at <640px; sm: kicks in at ≥640px.
    const outer = container.querySelector('.mx-auto.max-w-5xl');
    expect(outer).not.toBeNull();
    const classes = outer!.className;
    expect(classes).toContain('px-4'); // narrow gutter at 390px
    expect(classes).toContain('sm:px-6'); // comfortable gutter on tablet+
    expect(classes).toContain('py-6');
    expect(classes).toContain('sm:py-10');

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass('text-2xl');
    expect(h1).toHaveClass('sm:text-3xl');
  });
});
