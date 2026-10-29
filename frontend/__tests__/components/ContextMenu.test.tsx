import { fireEvent, render } from '@testing-library/react';

import ContextMenu from '../../components/Common/ContextMenu';

describe('ContextMenu', () => {
  it('closes on Escape', () => {
    const onClose = jest.fn();
    render(<ContextMenu x={10} y={10} lang="en" type="canvas" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const onClose = jest.fn();
    render(<ContextMenu x={10} y={10} lang="en" type="canvas" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on a click outside the menu', () => {
    const onClose = jest.fn();
    render(<ContextMenu x={10} y={10} lang="en" type="canvas" onClose={onClose} />);

    fireEvent.mouseDown(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
