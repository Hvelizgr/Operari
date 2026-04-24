import { render } from '@testing-library/react';

import Sparkline from '@/components/Common/Sparkline';

// Sparkline is intentionally aria-hidden because the raw statuses are
// already exposed next to it as numeric columns (success rate, runs
// count). We verify rendering via DOM structure + class names since
// visual semantics (colour per status) is the contract the rest of the
// UI relies on.
describe('Sparkline', () => {
  it('renders 20 slots when given no statuses, all muted (empty)', () => {
    const { container } = render(<Sparkline statuses={[]} />);
    const tiles = container.querySelectorAll('span');
    expect(tiles).toHaveLength(20);
    // Empty tiles use the white/5 placeholder class; SUCCESS tiles use
    // bg-emerald-500/80. No SUCCESS class should appear with empty
    // input, no matter which tile is inspected.
    const classes = Array.from(tiles).map(el => el.className);
    expect(classes.every(c => c.includes('bg-white/5'))).toBe(true);
  });

  it('right-pads with empties so older statuses do not shift column width', () => {
    const { container } = render(<Sparkline statuses={['SUCCESS', 'FAILED']} />);
    const tiles = Array.from(container.querySelectorAll('span'));
    expect(tiles).toHaveLength(20);
    // First 18 slots are empty padding, last 2 carry the actual
    // statuses. This keeps the component width stable whether the
    // runbook has 2 runs or 200.
    expect(tiles[0].className).toContain('bg-white/5');
    expect(tiles[17].className).toContain('bg-white/5');
    expect(tiles[18].className).toContain('bg-emerald-500/80');
    expect(tiles[19].className).toContain('bg-red-500/80');
  });

  it('maps every documented status to its own colour token', () => {
    const { container } = render(
      <Sparkline statuses={['SUCCESS', 'FAILED', 'RUNNING', 'PAUSED', 'CANCELLED']} />
    );
    const tiles = Array.from(container.querySelectorAll('span'));
    // Take only the last 5 (the first 15 are empty padding).
    const last5 = tiles.slice(-5).map(el => el.className);
    expect(last5[0]).toContain('bg-emerald-500/80');
    expect(last5[1]).toContain('bg-red-500/80');
    expect(last5[2]).toContain('bg-sky-500/80');
    expect(last5[3]).toContain('bg-amber-500/80');
    expect(last5[4]).toContain('bg-zinc-500/60');
  });

  it('truncates history beyond the slot count to the most recent entries', () => {
    const long = Array(50).fill('FAILED');
    long.push('SUCCESS');
    const { container } = render(<Sparkline statuses={long} slots={10} />);
    const tiles = Array.from(container.querySelectorAll('span'));
    expect(tiles).toHaveLength(10);
    // Last tile is the most recent, which is SUCCESS.
    expect(tiles[9].className).toContain('bg-emerald-500/80');
    // Tile 8 is FAILED (one before the tail).
    expect(tiles[8].className).toContain('bg-red-500/80');
  });
});
