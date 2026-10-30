import { render, screen } from '@testing-library/react';

import DynamicNodeForm, { type Property } from '../../components/Node/DynamicNodeForm';

jest.mock('../../components/Node/SecretPicker', () => () => null);
jest.mock('../../components/Node/ExpressionBuilder', () => () => null);

const properties: Property[] = [
  {
    name: 'action',
    displayName: 'Action',
    type: 'options',
    default: 'parse',
    options: [
      { name: 'Parse', value: 'parse' },
      { name: 'Query', value: 'query' },
    ],
  },
  { name: 'value', displayName: 'Value', type: 'string', required: true },
  {
    name: 'path',
    displayName: 'JSONPath',
    type: 'string',
    displayOptions: { show: { action: ['query'] } },
  },
];

const renderForm = (values: Record<string, unknown>) =>
  render(
    <DynamicNodeForm
      properties={properties}
      values={values}
      onChange={jest.fn()}
      nodes={[]}
      connections={[]}
    />
  );

describe('DynamicNodeForm conditional fields', () => {
  it('hides a field while the untouched selector sits on its default', () => {
    renderForm({});
    expect(screen.queryByText('JSONPath')).toBeNull();
  });

  it('shows it once the selector picks a matching value', () => {
    renderForm({ action: 'query' });
    expect(screen.getByText('JSONPath')).toBeTruthy();
  });

  it('marks required fields', () => {
    renderForm({});
    expect(screen.getByText('Value').textContent).toContain('*');
  });
});
