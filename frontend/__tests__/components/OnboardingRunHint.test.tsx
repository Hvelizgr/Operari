import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import OnboardingRunHint from '@/components/Editor/OnboardingRunHint';

beforeEach(() => {
  window.localStorage.clear();
});

describe('OnboardingRunHint', () => {
  it('renders the keyboard hint for a first-time user with a loaded runbook', () => {
    render(<OnboardingRunHint nodeCount={3} isExecuting={false} hasExecution={false} lang="en" />);
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('to run')).toBeInTheDocument();
  });

  it('hides when the canvas is empty (nothing to run)', () => {
    const { container } = render(
      <OnboardingRunHint nodeCount={0} isExecuting={false} hasExecution={false} lang="en" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('hides while a run is in flight so the status pill owns the slot', () => {
    const { container } = render(
      <OnboardingRunHint nodeCount={3} isExecuting hasExecution={false} lang="en" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('hides when the tenant has already run at least once (localStorage flag)', () => {
    window.localStorage.setItem('nanorun:hasRunFirstRunbook', '1');
    const { container } = render(
      <OnboardingRunHint nodeCount={3} isExecuting={false} hasExecution={false} lang="en" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('dismisses permanently when the user clicks the close icon', async () => {
    render(<OnboardingRunHint nodeCount={3} isExecuting={false} hasExecution={false} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    // The pill is wrapped in AnimatePresence, so the DOM element
    // persists briefly during the exit animation. Wait for it to
    // actually leave rather than asserting synchronously.
    await waitFor(() => {
      expect(screen.queryByText('to run')).not.toBeInTheDocument();
    });
  });

  it('sets the persistent flag when a run is detected (hasExecution)', () => {
    const { rerender } = render(
      <OnboardingRunHint nodeCount={3} isExecuting={false} hasExecution={false} lang="en" />
    );
    expect(window.localStorage.getItem('nanorun:hasRunFirstRunbook')).toBeNull();
    rerender(<OnboardingRunHint nodeCount={3} isExecuting={false} hasExecution lang="en" />);
    expect(window.localStorage.getItem('nanorun:hasRunFirstRunbook')).toBe('1');
  });

  it('localises the hint text in Spanish', () => {
    render(<OnboardingRunHint nodeCount={3} isExecuting={false} hasExecution={false} lang="es" />);
    expect(screen.getByText('para ejecutar')).toBeInTheDocument();
  });
});
