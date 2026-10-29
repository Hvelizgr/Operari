import type { WorkflowNode } from '@operari/shared';
import { render as rtlRender, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactElement } from 'react';

import EditorNode from '@/components/Editor/EditorNode';

/**
 * Smoke coverage for the canvas card. Click/drag/connect are owned by
 * React Flow, so the card only needs a ReactFlowProvider for its
 * <Handle> poles. Selection and run state are expressed as CSS classes
 * on the card (which carries the hover tooltip as its `title`).
 */

const mockNode: WorkflowNode = {
  id: 'test-node-1',
  position: { x: 100, y: 100 },
  title: 'Test step',
  type: 'shell',
  inputs: [{ id: 'in1', label: 'Input' }],
  outputs: [{ id: 'out1', label: 'Output' }],
};

const defaultProps = {
  node: mockNode,
  isDragging: false,
  isSelected: false,
  isHighlighted: false,
};

const render = (ui: ReactElement) => rtlRender(<ReactFlowProvider>{ui}</ReactFlowProvider>);
const getCard = () => screen.getByTitle(/^Test step type: shell/);

describe('EditorNode', () => {
  it('renders the node title', () => {
    render(<EditorNode {...defaultProps} />);
    expect(screen.getByText('Test step')).toBeInTheDocument();
  });

  it('adds the `selected` class when isSelected is true', () => {
    render(<EditorNode {...defaultProps} isSelected={true} />);
    expect(getCard()).toHaveClass('selected');
  });

  it('does not add the `selected` class when isSelected is false', () => {
    render(<EditorNode {...defaultProps} isSelected={false} />);
    expect(getCard()).not.toHaveClass('selected');
  });

  it('adds the `wf_active` class when status is RUNNING', () => {
    render(<EditorNode {...defaultProps} status="RUNNING" />);
    expect(getCard()).toHaveClass('wf_active');
  });

  it('renders the input and output poles as React Flow handles', () => {
    render(<EditorNode {...defaultProps} />);
    expect(screen.getByLabelText('Input')).toHaveAttribute('data-handleid', 'in-0');
    expect(screen.getByLabelText('Output')).toHaveAttribute('data-handleid', 'out-0');
  });

  it('renders one output handle per declared output on multi-port nodes', () => {
    const node: WorkflowNode = {
      ...mockNode,
      type: 'approval',
      outputs: [
        { id: 'approved', label: 'approved' },
        { id: 'rejected', label: 'rejected' },
      ],
    };
    render(<EditorNode {...defaultProps} node={node} />);
    expect(screen.getByLabelText('Output: approved')).toHaveAttribute('data-handleid', 'out-0');
    expect(screen.getByLabelText('Output: rejected')).toHaveAttribute('data-handleid', 'out-1');
  });
});
