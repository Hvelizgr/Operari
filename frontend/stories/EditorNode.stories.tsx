import type { WorkflowNode } from '@cairn/shared';
import type { Meta, StoryObj } from '@storybook/react';

import EditorNode from '../components/Editor/EditorNode';

const mockNode: WorkflowNode = {
  id: 'story-node-1',
  position: { x: 50, y: 50 },
  title: 'Webhook Trigger',
  type: 'Webhook',
  inputs: [{ id: 'in1', label: 'Input' }],
  outputs: [
    { id: 'out1', label: 'Success' },
    { id: 'out2', label: 'Error' },
  ],
};

const meta: Meta<typeof EditorNode> = {
  title: 'Components/EditorNode',
  component: EditorNode,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    isDragging: { control: 'boolean' },
    isSelected: { control: 'boolean' },
    isHighlighted: { control: 'boolean' },
    isConnectionTarget: { control: 'boolean' },
  },
  decorators: [
    Story => (
      <div style={{ position: 'relative', width: '400px', height: '300px', background: '#0f172a' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node: mockNode,
    onDragStart: () => {},
    onDrag: () => {},
    onDragEnd: () => {},
    isDragging: false,
    isSelected: false,
    isHighlighted: false,
    isConnectionTarget: false,
    onSelect: () => {},
    onDelete: () => {},
  },
};

export const Selected: Story = {
  args: {
    ...Default.args,
    isSelected: true,
  },
};

export const Highlighted: Story = {
  args: {
    ...Default.args,
    isHighlighted: true,
  },
};

export const Running: Story = {
  args: {
    ...Default.args,
    node: { ...mockNode, executionState: 'running' },
  },
};

export const Success: Story = {
  args: {
    ...Default.args,
    node: { ...mockNode, executionState: 'success' },
  },
};

export const Error: Story = {
  args: {
    ...Default.args,
    node: { ...mockNode, executionState: 'error' },
  },
};

export const ConnectionTarget: Story = {
  args: {
    ...Default.args,
    isConnectionTarget: true,
  },
};

export const EmailNode: Story = {
  args: {
    ...Default.args,
    node: {
      ...mockNode,
      id: 'email-node',
      title: 'Send Email',
      type: 'Email',
      inputs: [
        { id: 'in1', label: 'Content' },
        { id: 'in2', label: 'Recipients' },
      ],
      outputs: [{ id: 'out1', label: 'Sent' }],
    },
  },
};

export const DatabaseNode: Story = {
  args: {
    ...Default.args,
    node: {
      ...mockNode,
      id: 'db-node',
      title: 'Query Database',
      type: 'Database',
      inputs: [{ id: 'in1', label: 'Query' }],
      outputs: [{ id: 'out1', label: 'Results' }],
    },
  },
};
