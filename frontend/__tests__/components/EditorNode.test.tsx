import type { WorkflowNode } from '@operari/shared';
import { fireEvent, render } from '@testing-library/react';

import EditorNode from '@/components/Editor/EditorNode';

/**
 * Smoke coverage for the styled div-based EditorNode introduced in
 * the editor refactor. The previous tests asserted a button-style
 * component with full ARIA + executionState + "Success"/"Error" text
 * labels — that API no longer exists. The current component is a
 * canvas graph element with multiple visual variants
 * (controller / limit / trigger / action / job) driven by the node
 * type, with selection/dragging/active state expressed as CSS classes
 * on a `wf_node wf_entity` div, not as ARIA roles.
 *
 * What we pin here:
 *   - the title is rendered
 *   - clicking the node fires onClick(node.id)
 *   - isSelected adds the `selected` class
 *   - status='RUNNING' adds the `wf_active` class
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
  onDragStart: jest.fn(),
  onDrag: jest.fn(),
  onDragEnd: jest.fn(),
  isDragging: false,
  onPortDragStart: jest.fn(),
  isConnectionTarget: false,
  isSelected: false,
  isHighlighted: false,
  onClick: jest.fn(),
  onMove: jest.fn(),
  onContextMenu: jest.fn(),
};

describe('EditorNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the node title', () => {
    const { getByText } = render(<EditorNode {...defaultProps} />);
    expect(getByText('Test step')).toBeInTheDocument();
  });

  it('fires onClick with the node id when the node body is clicked', () => {
    const { container } = render(<EditorNode {...defaultProps} />);
    // The wf_node div is the canonical node element. Pole buttons
    // are excluded from the click handler in commonProps; clicking
    // the wf_node directly is what the canvas does.
    const node = container.querySelector('.wf_node') as HTMLElement;
    expect(node).toBeTruthy();
    fireEvent.click(node);
    expect(defaultProps.onClick).toHaveBeenCalledWith('test-node-1');
  });

  it('adds the `selected` class when isSelected is true', () => {
    const { container } = render(<EditorNode {...defaultProps} isSelected={true} />);
    const node = container.querySelector('.wf_node') as HTMLElement;
    expect(node.className).toContain('selected');
  });

  it('does not add the `selected` class when isSelected is false', () => {
    const { container } = render(<EditorNode {...defaultProps} isSelected={false} />);
    const node = container.querySelector('.wf_node') as HTMLElement;
    expect(node.className).not.toContain('selected');
  });

  it('adds the `wf_active` class when status is RUNNING', () => {
    const { container } = render(<EditorNode {...defaultProps} status="RUNNING" />);
    const node = container.querySelector('.wf_node') as HTMLElement;
    expect(node.className).toContain('wf_active');
  });

  it('renders both an input and an output pole button', () => {
    const { container } = render(<EditorNode {...defaultProps} />);
    const inputPole = container.querySelector('.wf_input_pole, .wf_up_pole');
    const outputPole = container.querySelector('.wf_output_pole, .wf_down_pole');
    expect(inputPole).toBeTruthy();
    expect(outputPole).toBeTruthy();
  });
});
