import { fireEvent, render } from '@testing-library/react';

import CommandPalette from '../../components/Editor/CommandPalette';

describe('CommandPalette', () => {
  it('closes on Escape', () => {
    const onClose = jest.fn();
    render(
      <CommandPalette
        isOpen
        onClose={onClose}
        lang="en"
        actions={[{ id: 'a', label: 'Do it', action: jest.fn() } as never]}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
