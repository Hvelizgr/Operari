import { fireEvent, render, screen } from '@testing-library/react';

import ShortcutHelpModal from '@/components/Common/ShortcutHelpModal';

describe('ShortcutHelpModal', () => {
  it('renders nothing when closed (so the Esc handler doesn’t fire globally)', () => {
    render(<ShortcutHelpModal isOpen={false} onClose={() => {}} lang="en" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists the palette, nav, editor and global sections with their keys', () => {
    render(<ShortcutHelpModal isOpen={true} onClose={() => {}} lang="en" />);
    // Section headings — pin the h3 role so duplicate text in the
    // body doesn't cause the multi-match error.
    expect(screen.getByRole('heading', { level: 3, name: /command palette/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /navigate/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /editor/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /global/i })).toBeInTheDocument();
    // Spot-check a canonical shortcut: G H goes to Dashboard.
    expect(screen.getByText(/go to dashboard/i)).toBeInTheDocument();
  });

  it('closes on backdrop click (not just the × button)', () => {
    const onClose = jest.fn();
    render(<ShortcutHelpModal isOpen={true} onClose={onClose} lang="en" />);
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = jest.fn();
    render(<ShortcutHelpModal isOpen={true} onClose={onClose} lang="en" />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close on every keydown — only Escape', () => {
    const onClose = jest.fn();
    render(<ShortcutHelpModal isOpen={true} onClose={onClose} lang="en" />);
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders the spanish copy when lang=es', () => {
    render(<ShortcutHelpModal isOpen={true} onClose={() => {}} lang="es" />);
    expect(screen.getByText(/atajos de teclado/i)).toBeInTheDocument();
    expect(screen.getByText(/ir al panel/i)).toBeInTheDocument();
  });
});
