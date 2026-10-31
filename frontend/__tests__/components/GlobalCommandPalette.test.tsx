import { fireEvent, render, screen } from '@testing-library/react';

import GlobalCommandPalette from '@/components/Common/GlobalCommandPalette';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockReset());

describe('GlobalCommandPalette G-prefix navigation', () => {
  it('navigates on G then a mapped key', () => {
    render(<GlobalCommandPalette lang="es" />);
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 't' });
    expect(push).toHaveBeenCalledWith('/es/terminal');

    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'H' });
    expect(push).toHaveBeenLastCalledWith('/es/dashboard');
  });

  it('ignores the sequence while typing in a field', () => {
    render(
      <>
        <GlobalCommandPalette lang="en" />
        <input aria-label="name" />
      </>
    );
    const input = screen.getByLabelText('name');
    fireEvent.keyDown(input, { key: 'g' });
    fireEvent.keyDown(input, { key: 's' });
    expect(push).not.toHaveBeenCalled();
  });

  it('expires the prefix after a pause', () => {
    const now = jest.spyOn(Date, 'now');
    render(<GlobalCommandPalette lang="en" />);
    now.mockReturnValue(1_000);
    fireEvent.keyDown(window, { key: 'g' });
    now.mockReturnValue(5_000);
    fireEvent.keyDown(window, { key: 'r' });
    expect(push).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it('does nothing for an unmapped second key', () => {
    render(<GlobalCommandPalette lang="en" />);
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'z' });
    fireEvent.keyDown(window, { key: 't' });
    expect(push).not.toHaveBeenCalled();
  });
});
