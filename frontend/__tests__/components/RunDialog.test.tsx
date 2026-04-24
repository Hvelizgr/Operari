import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { RunbookInputDefinition } from '@/components/Editor/RunbookInputsPanel';
import RunDialog, { type DialogRunResult } from '@/components/Workflow/RunDialog';

/**
 * The dialog's form-generation path is already exercised through
 * manual QA — this suite focuses on the server-side error loop:
 * when `onRun` returns a DialogRunResult with status 'invalid_inputs',
 * the dialog must render the messages next to the offending fields
 * and surface a top-level banner, instead of closing.
 */

const sampleInputs: RunbookInputDefinition[] = [
  { name: 'env', type: 'select', options: ['dev', 'prod'], required: true },
  { name: 'retries', type: 'number' },
];

function renderDialog(
  onRun: (input: object) => Promise<DialogRunResult | void> | void = jest.fn()
) {
  return render(
    <RunDialog isOpen={true} onClose={jest.fn()} onRun={onRun} lang="en" inputs={sampleInputs} />
  );
}

describe('RunDialog server-error rendering', () => {
  it('renders per-field issues under the matching field on invalid_inputs', async () => {
    const onRun = jest.fn().mockResolvedValue({
      status: 'invalid_inputs',
      issues: [
        { field: 'env', message: 'env must be one of: dev, prod' },
        { field: 'retries', message: 'retries must be a number' },
      ],
    } satisfies DialogRunResult);

    renderDialog(onRun);

    // Fill the required select so client-side validation passes.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'prod' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run runbook' }));

    await waitFor(() => {
      expect(screen.getByText('env must be one of: dev, prod')).toBeInTheDocument();
      expect(screen.getByText('retries must be a number')).toBeInTheDocument();
    });

    // Top-level banner explains what happened.
    expect(
      screen.getByText('The server rejected these inputs. Fix the fields below.')
    ).toBeInTheDocument();
  });

  it('surfaces unknown-key issues even when the field is not declared', async () => {
    const onRun = jest.fn().mockResolvedValue({
      status: 'invalid_inputs',
      issues: [{ field: 'enivronment', message: 'unknown input "enivronment"' }],
    } satisfies DialogRunResult);

    renderDialog(onRun);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'prod' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run runbook' }));

    expect(await screen.findByText(/unknown input "enivronment"/)).toBeInTheDocument();
  });

  it('shows a generic banner on status=error without field-level messages', async () => {
    const onRun = jest.fn().mockResolvedValue({
      status: 'error',
      message: 'Service unavailable',
    } satisfies DialogRunResult);

    renderDialog(onRun);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'prod' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run runbook' }));

    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
  });

  it('clears previous field errors on a subsequent successful run', async () => {
    const onRun = jest
      .fn()
      .mockResolvedValueOnce({
        status: 'invalid_inputs',
        issues: [{ field: 'env', message: 'env must be one of: dev, prod' }],
      } satisfies DialogRunResult)
      .mockResolvedValueOnce({ status: 'ok' } satisfies DialogRunResult);

    renderDialog(onRun);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'prod' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run runbook' }));
    expect(await screen.findByText('env must be one of: dev, prod')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run runbook' }));
    await waitFor(() =>
      expect(screen.queryByText('env must be one of: dev, prod')).not.toBeInTheDocument()
    );
  });

  it('keeps the dialog open when onRun returns an invalid_inputs result', async () => {
    const onClose = jest.fn();
    const onRun = jest.fn().mockResolvedValue({
      status: 'invalid_inputs',
      issues: [{ field: 'env', message: 'env is required' }],
    } satisfies DialogRunResult);

    render(
      <RunDialog isOpen={true} onClose={onClose} onRun={onRun} lang="en" inputs={sampleInputs} />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'prod' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run runbook' }));

    await waitFor(() => expect(onRun).toHaveBeenCalled());
    // onClose is only called by the dialog when the X button is hit —
    // the dialog stays open after invalid_inputs so the user can fix
    // the fields and retry.
    expect(onClose).not.toHaveBeenCalled();
  });
});
