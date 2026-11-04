import { fireEvent, render, screen } from '@testing-library/react';

import { DateTimeField, JsonField, KeyValueField } from '../../components/Node/FormFields';

describe('JsonField', () => {
  it('flags invalid JSON but not text with a template', () => {
    const { rerender } = render(
      <JsonField lang="en" value='{"a": 1' onChange={() => undefined} className="" />
    );
    expect(screen.getByText('Not valid JSON')).toBeInTheDocument();
    rerender(
      <JsonField lang="en" value='{"a": {{vars.x}}}' onChange={() => undefined} className="" />
    );
    expect(screen.queryByText('Not valid JSON')).not.toBeInTheDocument();
  });

  it('shows an object value as formatted JSON', () => {
    render(<JsonField lang="en" value={{ a: 1 }} onChange={() => undefined} className="" />);
    expect(screen.getByRole('textbox')).toHaveValue('{\n  "a": 1\n}');
  });
});

describe('KeyValueField', () => {
  it('edits rows into an object and leaves out empty keys', () => {
    const onChange = jest.fn();
    render(
      <KeyValueField
        lang="en"
        value={{ Accept: 'application/json' }}
        onChange={onChange}
        className=""
      />
    );
    expect(screen.getByDisplayValue('Accept')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const keys = screen.getAllByRole('textbox', { name: 'Key' });
    fireEvent.change(keys[1], { target: { value: 'X-Trace' } });
    expect(onChange).toHaveBeenLastCalledWith({ Accept: 'application/json', 'X-Trace': '' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(onChange).toHaveBeenLastCalledWith({ 'X-Trace': '' });
  });

  it('reads a JSON string value, as older steps stored headers', () => {
    render(
      <KeyValueField
        lang="en"
        value='{"Authorization":"Bearer x"}'
        onChange={() => undefined}
        className=""
      />
    );
    expect(screen.getByDisplayValue('Authorization')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bearer x')).toBeInTheDocument();
  });
});

describe('DateTimeField', () => {
  it('writes the picked local time as ISO and keeps typed expressions', () => {
    const onChange = jest.fn();
    render(<DateTimeField lang="en" value="{{vars.when}}" onChange={onChange} className="" />);
    expect(screen.getByDisplayValue('{{vars.when}}')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Pick date and time'), {
      target: { value: '2026-11-04T09:30' },
    });
    expect(onChange).toHaveBeenLastCalledWith(new Date('2026-11-04T09:30').toISOString());
  });
});
