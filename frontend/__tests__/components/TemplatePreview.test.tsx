import type { Connection, WorkflowNode } from '@cairn/shared';
import { render } from '@testing-library/react';

import TemplatePreview from '@/app/[lang]/(marketing)/templates/TemplatePreview';

/**
 * TemplatePreview is a read-only SVG mini-render. The UX contract is:
 *   - One <rect> per node, one <path> per connection, one arrowhead
 *     marker shared across edges.
 *   - Node types drive color tones so shell vs approval vs http
 *     read visibly different.
 *   - Empty input collapses to null (no broken <svg> in the DOM).
 *   - Orphan connections (pointing at a nonexistent node id) are
 *     skipped, not crashed on.
 *
 * Tests pin those behaviors with DOM queries against the rendered
 * SVG rather than pixel comparisons.
 */

const mkNode = (id: string, type: string, title?: string, x = 0, y = 0): WorkflowNode =>
  ({
    id,
    type,
    title: title ?? '',
    position: { x, y },
    inputs: [],
    outputs: [],
  }) as WorkflowNode;

const mkConn = (id: string, source: string, target: string): Connection =>
  ({
    id,
    source,
    target,
  }) as Connection;

describe('TemplatePreview', () => {
  it('returns null for an empty node list (no orphan <svg> in the DOM)', () => {
    const { container } = render(<TemplatePreview nodes={[]} connections={[]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders one <rect> per node (plus the grid background rect)', () => {
    const { container } = render(
      <TemplatePreview
        nodes={[mkNode('n1', 'shell', 'Restart', 0, 0), mkNode('n2', 'http', 'Ping', 300, 0)]}
        connections={[]}
      />
    );
    const rects = container.querySelectorAll('rect');
    // 1 grid background + 2 node rects = 3 total.
    expect(rects.length).toBe(3);
  });

  it('renders one <path> per connection', () => {
    const { container } = render(
      <TemplatePreview
        nodes={[mkNode('a', 'shell', 'A', 0, 0), mkNode('b', 'shell', 'B', 300, 0)]}
        connections={[mkConn('e1', 'a', 'b')]}
      />
    );
    // Filter out the arrowhead marker's <path> (lives inside <defs>).
    const svgPaths = Array.from(container.querySelectorAll('svg > path'));
    expect(svgPaths.length).toBe(1);
  });

  it('skips connections that point at a missing node id without crashing', () => {
    const { container } = render(
      <TemplatePreview
        nodes={[mkNode('a', 'shell', 'A', 0, 0)]}
        connections={[mkConn('orphan', 'a', 'does-not-exist')]}
      />
    );
    const svgPaths = Array.from(container.querySelectorAll('svg > path'));
    expect(svgPaths.length).toBe(0);
  });

  it('renders node type (uppercased) + title text in each node group', () => {
    const { container } = render(
      <TemplatePreview nodes={[mkNode('a', 'approval', 'Needs sign-off', 0, 0)]} connections={[]} />
    );
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent);
    // The type label renders lowercase in the DOM; the CSS
    // text-transform uppercases it at paint time. Both the type and
    // title should show up.
    expect(texts).toContain('approval');
    expect(texts).toContain('Needs sign-off');
  });

  it('truncates long titles with an ellipsis', () => {
    const longTitle = 'a'.repeat(50);
    const { container } = render(
      <TemplatePreview nodes={[mkNode('a', 'shell', longTitle, 0, 0)]} connections={[]} />
    );
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent ?? '');
    const hasTruncated = texts.some(t => t.endsWith('…') && t.length < longTitle.length);
    expect(hasTruncated).toBe(true);
  });

  it('falls back to the default tone for an unknown node type', () => {
    // An unmapped node type must still render cleanly; toneFor()
    // guards against a typo in the template YAML.
    const { container } = render(
      <TemplatePreview nodes={[mkNode('a', 'totally-made-up', 'X', 0, 0)]} connections={[]} />
    );
    const nodeRects = container.querySelectorAll('svg > g > rect');
    expect(nodeRects.length).toBe(1);
  });

  it('exposes an accessible role + label on the SVG for screen readers', () => {
    const { getByRole } = render(
      <TemplatePreview nodes={[mkNode('a', 'shell', 'A', 0, 0)]} connections={[]} />
    );
    const svg = getByRole('img');
    expect(svg).toHaveAttribute('aria-label', 'Runbook graph preview');
  });
});
