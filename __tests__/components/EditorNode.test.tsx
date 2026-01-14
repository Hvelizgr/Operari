import { render, screen, fireEvent } from '@testing-library/react';
import EditorNode, { WorkflowNode } from '@/components/EditorNode';

const mockNode: WorkflowNode = {
    id: 'test-node-1',
    position: { x: 100, y: 100 },
    title: 'Test Node',
    type: 'Webhook',
    executionState: 'idle',
    inputs: [{ id: 'in1', label: 'Input' }],
    outputs: [{ id: 'out1', label: 'Output' }],
};

const defaultProps = {
    node: mockNode,
    onDragStart: jest.fn(),
    onDrag: jest.fn(),
    onDragEnd: jest.fn(),
    isDragging: false,
    onPortDragStart: jest.fn(),
    isConnectionTarget: false,
    isSelected: false,
    isHighlighted: false,
    onSelect: jest.fn(),
    onDelete: jest.fn(),
};

describe('EditorNode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders node with correct title', () => {
        render(<EditorNode {...defaultProps} />);
        expect(screen.getByText('Test Node')).toBeInTheDocument();
    });

    it('renders node type', () => {
        render(<EditorNode {...defaultProps} />);
        expect(screen.getByText('Webhook')).toBeInTheDocument();
    });

    it('shows selected state styling', () => {
        const { container } = render(<EditorNode {...defaultProps} isSelected={true} />);
        expect(container.querySelector('[aria-selected="true"]')).toBeInTheDocument();
    });

    it('shows highlighted state styling', () => {
        const { container } = render(<EditorNode {...defaultProps} isHighlighted={true} />);
        expect(container.firstChild).toHaveClass('ring-4');
    });

    it('calls onSelect when clicked', () => {
        render(<EditorNode {...defaultProps} />);
        const nodeElement = screen.getByRole('button');
        fireEvent.mouseDown(nodeElement);
        expect(defaultProps.onSelect).toHaveBeenCalledWith('test-node-1', false);
    });

    it('calls onDelete when delete button clicked', () => {
        render(<EditorNode {...defaultProps} isSelected={true} />);
        const deleteButton = screen.getByTitle(/delete/i);
        fireEvent.click(deleteButton);
        expect(defaultProps.onDelete).toHaveBeenCalledWith('test-node-1');
    });

    it('has proper ARIA attributes', () => {
        render(<EditorNode {...defaultProps} />);
        const nodeElement = screen.getByRole('button');
        expect(nodeElement).toHaveAttribute('aria-label', 'Webhook node: Test Node');
        expect(nodeElement).toHaveAttribute('aria-describedby', 'node-description-test-node-1');
    });

    it('renders input and output ports', () => {
        const { container } = render(<EditorNode {...defaultProps} />);
        const ports = container.querySelectorAll('[class*="rounded-full"]');
        expect(ports.length).toBeGreaterThanOrEqual(2);
    });

    it('shows running state indicator', () => {
        const runningNode = { ...mockNode, executionState: 'running' as const };
        const { container } = render(<EditorNode {...defaultProps} node={runningNode} />);
        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('shows success state indicator', () => {
        const successNode = { ...mockNode, executionState: 'success' as const };
        render(<EditorNode {...defaultProps} node={successNode} />);
        expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('shows error state indicator', () => {
        const errorNode = { ...mockNode, executionState: 'error' as const };
        render(<EditorNode {...defaultProps} node={errorNode} />);
        expect(screen.getByText('Error')).toBeInTheDocument();
    });
});
