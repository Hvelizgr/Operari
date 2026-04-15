import { render, fireEvent } from '@testing-library/react';
import type { Connection } from '@cairn/shared';
import EditorConnection from '@/components/Editor/EditorConnection';

/**
 * EditorConnection renders FOUR SVG paths under the same <g>:
 *   1. an invisible wide path (stroke="transparent") for click hitbox
 *   2. a glow under-line  (rgba(59,130,246,0.3) when selected)
 *   3. the main coloured line (#3b82f6 when selected)
 *   4. an end dot (circle, not a path)
 *
 * Animated executing-mode dots are rendered with motion.circle and
 * use the CSS `offset-path` motion API. React used to warn about the
 * `offsetDistance` prop leaking onto DOM elements; that warning was
 * silenced in framer-motion >= 11 by treating these as motion values.
 * The test below queries with class/index instead of stroke colour
 * so it does not break again the next time the visual styling changes.
 */

const mockConnection: Connection = {
    id: 'conn-1',
    source: 'node-1',
    target: 'node-2',
    sourcePort: 0,
    targetPort: 0,
};

const sourcePos = { x: 100, y: 100 };
const targetPos = { x: 300, y: 100 };

const defaultProps = {
    connection: mockConnection,
    sourcePos,
    targetPos,
    isSelected: false,
    isExecuting: false,
    onClick: jest.fn(),
};

const renderInSvg = (extra?: Partial<typeof defaultProps>) =>
    render(
        <svg>
            <EditorConnection {...defaultProps} {...extra} />
        </svg>,
    );

describe('EditorConnection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders at least one connection path', () => {
        const { container } = renderInSvg();
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBeGreaterThanOrEqual(1);
    });

    it('uses a transparent wide hitbox path for click events', () => {
        const { container } = renderInSvg();
        const paths = container.querySelectorAll('path');
        // The first path is the invisible click hitbox.
        expect(paths[0].getAttribute('stroke')).toBe('transparent');
        expect(paths[0].getAttribute('stroke-width')).toBe('20');
    });

    it('paints the main line blue when selected', () => {
        const { container } = renderInSvg({ isSelected: true });
        const paths = container.querySelectorAll('path');
        // The third path (index 2) is the main coloured line.
        // Selected colour is #3b82f6 (blue-500).
        expect(paths[2].getAttribute('stroke')).toBe('#3b82f6');
    });

    it('fires onClick with the connection id when the group is clicked', () => {
        const { container } = renderInSvg();
        const group = container.querySelector('g')!;
        fireEvent.click(group);
        expect(defaultProps.onClick).toHaveBeenCalledWith('conn-1');
    });

    it('renders the end-dot circle on the target', () => {
        const { container } = renderInSvg();
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBeGreaterThanOrEqual(1);
        expect(circles[0].getAttribute('cx')).toBe(String(targetPos.x));
        expect(circles[0].getAttribute('cy')).toBe(String(targetPos.y));
    });

    it('renders extra animated circles in executing mode', () => {
        const { container: idle } = renderInSvg();
        const { container: running } = renderInSvg({ isExecuting: true });
        const idleCount = idle.querySelectorAll('circle').length;
        const runningCount = running.querySelectorAll('circle').length;
        expect(runningCount).toBeGreaterThan(idleCount);
    });

    it('builds a bezier path that starts at sourcePos and uses a C curve', () => {
        const { container } = renderInSvg();
        const paths = container.querySelectorAll('path');
        const d = paths[0].getAttribute('d');
        expect(d).toContain('M 100 100');
        expect(d).toContain('C');
    });
});
