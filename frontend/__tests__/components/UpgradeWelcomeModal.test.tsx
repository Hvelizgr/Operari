import { fireEvent, render, screen } from '@testing-library/react';

import { UpgradeWelcomeModal } from '@/components/Settings/UpgradeWelcomeModal';

/**
 * UpgradeWelcomeModal is the post-Stripe-Checkout landing modal. Gated
 * entirely on the ?checkout=success query param. Dismiss strips the
 * param so a reload of /settings doesn't re-fire the celebration.
 */

function setUrl(pathAndSearch: string) {
  window.history.replaceState({}, '', pathAndSearch);
}

describe('UpgradeWelcomeModal', () => {
  beforeEach(() => {
    setUrl('/settings');
  });

  it('renders nothing on a plain /settings visit', () => {
    const { container } = render(<UpgradeWelcomeModal lang="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the welcome modal when ?checkout=success is in the URL', () => {
    setUrl('/settings?checkout=success');
    render(<UpgradeWelcomeModal lang="en" />);
    expect(screen.getByText('Welcome to the paid club.')).toBeInTheDocument();
    // All four value bullets land.
    expect(screen.getByText(/Unlimited runbooks/)).toBeInTheDocument();
    expect(screen.getByText(/Invite unlimited teammates/)).toBeInTheDocument();
    expect(screen.getByText(/Priority email support/)).toBeInTheDocument();
    expect(screen.getByText(/SAML SSO/)).toBeInTheDocument();
  });

  it('renders the Spanish copy when lang=es', () => {
    setUrl('/settings?checkout=success');
    render(<UpgradeWelcomeModal lang="es" />);
    expect(screen.getByText('Bienvenido al club pago.')).toBeInTheDocument();
    expect(screen.getByText('Empezar')).toBeInTheDocument();
  });

  it('dismiss via the X icon strips the query param', () => {
    setUrl('/settings?checkout=success');
    render(<UpgradeWelcomeModal lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('Welcome to the paid club.')).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('dismiss via the CTA button strips the query param', () => {
    setUrl('/settings?checkout=success');
    render(<UpgradeWelcomeModal lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start building' }));

    expect(screen.queryByText('Welcome to the paid club.')).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('preserves other query params when stripping checkout=success', () => {
    setUrl('/settings?checkout=success&tab=team');
    render(<UpgradeWelcomeModal lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start building' }));
    expect(window.location.search).toBe('?tab=team');
  });

  it('does not fire for ?checkout=canceled (only success triggers)', () => {
    // Stripe can redirect with checkout=canceled when the user backs
    // out. Celebrate only on success.
    setUrl('/settings?checkout=canceled');
    const { container } = render(<UpgradeWelcomeModal lang="en" />);
    expect(container).toBeEmptyDOMElement();
    // Param stays (we didn't handle it).
    expect(window.location.search).toBe('?checkout=canceled');
  });
});
