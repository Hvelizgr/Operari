import { render, fireEvent } from '@testing-library/react';
import type { Connection } from '@nanoflow/shared';
import EditorConnection from '@/components/Editor/EditorConnection';

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

describe('EditorConnection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders connection path', () => {
        const { container } = render(
            <svg>
                <EditorConnection {...defaultProps} />
            </svg>
        );
        const path = container.querySelector('path');
        expect(path).toBeInTheDocument();
    });

    it('renders with selected styling', () => {
        const { container } = render(
            <svg>
                <EditorConnection {...defaultProps} isSelected={true} />
            </svg>
        );
        const path = container.querySelector('path');
        expect(path).toHaveAttribute('stroke', expect.stringContaining('0.6'));
    });

    it('calls onClick when clicked', () => {
        const { container } = render(
            <svg>
                <EditorConnection {...defaultProps} />
            </svg>
        );
        const group = container.querySelector('g');
        fireEvent.click(group!);
        expect(defaultProps.onClick).toHaveBeenCalledWith('conn-1');
    });

    it('renders target circle', () => {
        const { container } = render(
            <svg>
                <EditorConnection {...defaultProps} />
            </svg>
        );
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBeGreaterThanOrEqual(1);
    });

    it('shows animated circles when executing', () => {
        const { container } = render(
            <svg>
                <EditorConnection {...defaultProps} isExecuting={true} />
            </svg>
        );
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBeGreaterThan(1);
    });

    it('generates correct bezier path', () => {
        const { container } = render(
            <svg>
                <EditorConnection {...defaultProps} />
            </svg>
        );
        const path = container.querySelector('path');
        const d = path?.getAttribute('d');
        expect(d).toContain('M 100 100');
        expect(d).toContain('C');
    });
});
