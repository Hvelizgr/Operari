import { fireEvent, render, screen } from '@testing-library/react';

import { OnboardingTour } from '@/components/Common/OnboardingTour';

const STORAGE_KEY = 'nanorun_tour_completed';

// The useAuth session shape the tour reads from. Each test overrides
// this before rendering so we can cover every gating path
// (no session / anonymous / real user).
type TourSession = { user: { id: string } } | null;
let currentSession: TourSession = null;

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ session: currentSession }),
}));

// Next <Link> eagerly prefetches — stub to a plain anchor so tests
// don't chase routing side effects.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

describe('OnboardingTour', () => {
  beforeEach(() => {
    window.localStorage.clear();
    currentSession = null;
  });

  it('renders nothing when there is no session yet', () => {
    currentSession = null;
    const { container } = render(<OnboardingTour lang="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for the anonymous self-host user', () => {
    // Anonymous mode has no per-user state to persist completion
    // against, so the tour is a no-op by design.
    currentSession = { user: { id: 'anonymous' } };
    const { container } = render(<OnboardingTour lang="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when localStorage marks it completed', () => {
    currentSession = { user: { id: 'u-1' } };
    window.localStorage.setItem(STORAGE_KEY, '1');
    const { container } = render(<OnboardingTour lang="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens on first visit for a real user and shows step 1 of 4', () => {
    currentSession = { user: { id: 'u-1' } };
    render(<OnboardingTour lang="en" />);
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByText('Start from a template')).toBeInTheDocument();
  });

  it('advances through all 4 steps with Next and goes back with Back', () => {
    currentSession = { user: { id: 'u-1' } };
    render(<OnboardingTour lang="en" />);

    // Step 1 → Step 2
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    expect(screen.getByText('Edit visually')).toBeInTheDocument();

    // Step 2 → Step 3
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
    expect(screen.getByText('Dry-run first')).toBeInTheDocument();

    // Step 3 → Step 4 (last — button flips to Let's go)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Let's go" })).toBeInTheDocument();

    // Back → Step 3
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
  });

  it('skip closes the tour and persists the completion flag', () => {
    currentSession = { user: { id: 'u-1' } };
    render(<OnboardingTour lang="en" />);

    // Two skip affordances render for redundancy: the top-right X
    // icon button (aria-label) and the footer text link. Either one
    // closes — test hits the footer link via visible text.
    fireEvent.click(screen.getByText('Skip tour'));

    expect(screen.queryByText('Step 1 of 4')).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('finish on the last step closes and persists', () => {
    currentSession = { user: { id: 'u-1' } };
    render(<OnboardingTour lang="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: "Let's go" }));

    expect(screen.queryByText('Step 4 of 4')).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('clicking a CTA link closes the tour so it does not re-open on the next visit', () => {
    currentSession = { user: { id: 'u-1' } };
    render(<OnboardingTour lang="en" />);

    fireEvent.click(screen.getByText('Browse templates'));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('step 3 has no CTA link (dry-run is a concept, not a destination)', () => {
    currentSession = { user: { id: 'u-1' } };
    render(<OnboardingTour lang="en" />);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Dry-run first')).toBeInTheDocument();
    // No "Open", "Browse", "Go to" CTA on this step.
    expect(screen.queryByText('Open the editor')).toBeNull();
    expect(screen.queryByText('Browse templates')).toBeNull();
    expect(screen.queryByText('Go to dashboard')).toBeNull();
  });

  it('renders the Spanish copy when lang=es', () => {
    currentSession = { user: { id: 'u-1' } };
    render(<OnboardingTour lang="es" />);
    expect(screen.getByText('Paso 1 de 4')).toBeInTheDocument();
    expect(screen.getByText('Empezá con un template')).toBeInTheDocument();
  });
});
