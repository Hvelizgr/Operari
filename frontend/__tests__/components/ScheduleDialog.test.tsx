import { fireEvent, render, screen } from '@testing-library/react';

import ScheduleDialog from '@/components/Runbook/ScheduleDialog';

/**
 * ScheduleDialog is the dedicated TopBar-triggered wrapper around
 * CronPicker (UX-audit #18 — "Schedule UI más visible"). Tests
 * cover the open/close wiring, cron change propagation through the
 * shared CronPicker, click-outside + X dismiss, and i18n.
 */

describe('ScheduleDialog', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ScheduleDialog
        isOpen={false}
        onClose={jest.fn()}
        lang="en"
        value={null}
        onChange={jest.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the dialog with the title and description when open', () => {
    render(
      <ScheduleDialog
        isOpen={true}
        onClose={jest.fn()}
        lang="en"
        value={null}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('Schedule this runbook')).toBeInTheDocument();
    // Description anchors the trade-off the operator should know about
    // before committing to a cron.
    expect(screen.getByText(/Runs fire automatically on this cron/)).toBeInTheDocument();
  });

  it('embeds a CronPicker that propagates preset clicks via onChange', () => {
    const onChange = jest.fn();
    render(
      <ScheduleDialog
        isOpen={true}
        onClose={jest.fn()}
        lang="en"
        value={null}
        onChange={onChange}
      />
    );
    // CronPicker renders "Hourly" as one of its preset buttons.
    fireEvent.click(screen.getByText('Hourly'));
    expect(onChange).toHaveBeenCalledWith('0 * * * *');
  });

  it('onChange reflects an off preset by emitting null (unscheduled)', () => {
    const onChange = jest.fn();
    render(
      <ScheduleDialog
        isOpen={true}
        onClose={jest.fn()}
        lang="en"
        value="0 * * * *"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText('Off'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('closes via the X icon', () => {
    const onClose = jest.fn();
    render(
      <ScheduleDialog isOpen={true} onClose={onClose} lang="en" value={null} onChange={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via the Done button', () => {
    const onClose = jest.fn();
    render(
      <ScheduleDialog isOpen={true} onClose={onClose} lang="en" value={null} onChange={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on click outside (backdrop)', () => {
    const onClose = jest.fn();
    render(
      <ScheduleDialog isOpen={true} onClose={onClose} lang="en" value={null} onChange={jest.fn()} />
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the inner panel is clicked (stopPropagation)', () => {
    const onClose = jest.fn();
    render(
      <ScheduleDialog isOpen={true} onClose={onClose} lang="en" value={null} onChange={jest.fn()} />
    );
    // Clicking the title inside the panel should not bubble to the
    // backdrop onClick.
    fireEvent.click(screen.getByText('Schedule this runbook'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders Spanish copy when lang=es', () => {
    render(
      <ScheduleDialog
        isOpen={true}
        onClose={jest.fn()}
        lang="es"
        value={null}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('Programar este runbook')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument();
  });
});
