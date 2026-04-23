import type { Meta, StoryObj } from '@storybook/react';
import { ThemeToggle } from '../components/Common';
import { AccessibilityProvider } from '../context/AccessibilityContext';

const meta: Meta<typeof ThemeToggle> = {
  title: 'Components/ThemeToggle',
  component: ThemeToggle,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    lang: { control: 'select', options: ['en', 'es'] },
  },
  decorators: [
    Story => (
      <AccessibilityProvider>
        <div style={{ padding: '2rem', background: '#0f172a' }}>
          <Story />
        </div>
      </AccessibilityProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const English: Story = {
  args: {
    lang: 'en',
  },
};

export const Spanish: Story = {
  args: {
    lang: 'es',
  },
};
