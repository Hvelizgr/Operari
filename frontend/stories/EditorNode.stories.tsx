import type { WorkflowNode } from '@operari/shared';
import type { Meta, StoryObj } from '@storybook/react';
import { ReactFlowProvider } from '@xyflow/react';

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
  },
  decorators: [
    Story => (
      <div style={{ position: 'relative', width: '400px', height: '300px', background: '#0f172a' }}>
        <ReactFlowProvider>
          <Story />
        </ReactFlowProvider>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node: mockNode,
    isDragging: false,
    isSelected: false,
    isHighlighted: false,
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
      type: 'operari.database',
      inputs: [{ id: 'in1', label: 'Query' }],
      outputs: [{ id: 'out1', label: 'Results' }],
    },
  },
};
