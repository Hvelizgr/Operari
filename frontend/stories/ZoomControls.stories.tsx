import type { Meta, StoryObj } from '@storybook/react';

import { ZoomControls } from '../components/Navigation';

const meta: Meta<typeof ZoomControls> = {
  title: 'Components/ZoomControls',
  component: ZoomControls,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    zoom: { control: { type: 'range', min: 0.1, max: 2, step: 0.1 } },
    lang: { control: 'select', options: ['en', 'es'] },
  },
  decorators: [
    Story => (
      <div style={{ position: 'relative', width: '200px', height: '300px', background: '#0f172a' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    zoom: 1,
    onZoomIn: () => {},
    onZoomOut: () => {},
    onFitView: () => {},
    onResetZoom: () => {},
    lang: 'en',
  },
};

export const ZoomedIn: Story = {
  args: {
    ...Default.args,
    zoom: 1.5,
  },
};

export const ZoomedOut: Story = {
  args: {
    ...Default.args,
    zoom: 0.5,
  },
};

export const Spanish: Story = {
  args: {
    ...Default.args,
    lang: 'es',
  },
};
