import { fireEvent, render, screen } from '@testing-library/react';
import { LayoutTemplate } from 'lucide-react';

import { EmptyState } from '@/components/Common/EmptyState';

// Plain-anchor stub so <Link> routing side effects stay out of
// the test. The component's whole UX contract is "renders title +
// body + CTAs that navigate" — that's what gets pinned here.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('EmptyState', () => {
  it('renders title + body', () => {
    render(
      <EmptyState
        icon={LayoutTemplate}
        title="No runbooks yet"
        body="Start from a template or open the editor."
      />
    );
    expect(screen.getByText('No runbooks yet')).toBeInTheDocument();
    expect(screen.getByText('Start from a template or open the editor.')).toBeInTheDocument();
  });

  it('renders both primary + secondary CTAs when both are provided', () => {
    render(
      <EmptyState
        icon={LayoutTemplate}
        title="No runbooks yet"
        body="Start from a template or open the editor."
        primaryLabel="Browse templates"
        primaryHref="/en/templates"
        secondaryLabel="Open editor"
        secondaryHref="/en/editor"
      />
    );

    const primary = screen.getByText('Browse templates').closest('a');
    const secondary = screen.getByText('Open editor').closest('a');
    expect(primary).toHaveAttribute('href', '/en/templates');
    expect(secondary).toHaveAttribute('href', '/en/editor');
  });

  it('omits the primary CTA when label or href is missing', () => {
    render(
      <EmptyState
        icon={LayoutTemplate}
        title="x"
        body="y"
        primaryLabel="Browse templates"
        // primaryHref intentionally omitted
      />
    );
    expect(screen.queryByText('Browse templates')).toBeNull();
  });

  it('omits the secondary CTA when label or href is missing', () => {
    render(
      <EmptyState
        icon={LayoutTemplate}
        title="x"
        body="y"
        secondaryHref="/en/editor"
        // secondaryLabel intentionally omitted
      />
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders with only a primary CTA (runs-history shape)', () => {
    render(
      <EmptyState
        icon={LayoutTemplate}
        title="No runs yet"
        body="Run a runbook to see history here."
        primaryLabel="Open editor"
        primaryHref="/en/editor"
      />
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/en/editor');
  });

  it('CTAs are clickable links (navigate via href, not onClick)', () => {
    render(
      <EmptyState
        icon={LayoutTemplate}
        title="x"
        body="y"
        primaryLabel="Go"
        primaryHref="/en/templates"
      />
    );
    // No throw when clicked — confirms it's a plain anchor, not a
    // button wrapper that would swallow the navigation.
    fireEvent.click(screen.getByText('Go'));
    expect(screen.getByText('Go').closest('a')).toHaveAttribute('href', '/en/templates');
  });
});
