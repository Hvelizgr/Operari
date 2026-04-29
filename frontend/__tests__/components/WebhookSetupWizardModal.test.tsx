import { fireEvent, render, screen } from '@testing-library/react';

import WebhookSetupWizardModal from '@/components/Editor/WebhookSetupWizardModal';

const realClipboard = (navigator as unknown as { clipboard?: { writeText: () => Promise<void> } })
  .clipboard;

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: realClipboard,
    writable: true,
  });
  jest.clearAllMocks();
});

function installClipboard(): jest.Mock {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
    writable: true,
  });
  return writeText;
}

describe('WebhookSetupWizardModal', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <WebhookSetupWizardModal
        open={false}
        onClose={() => {}}
        lang="en"
        source="sentry"
        url="https://example.test/webhook/abc"
        secret="s3cret"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Sentry-specific instructions and the URL/secret', () => {
    render(
      <WebhookSetupWizardModal
        open
        onClose={() => {}}
        lang="en"
        source="sentry"
        url="https://example.test/webhook/abc"
        secret="s3cret"
      />
    );

    expect(screen.getByText(/wire this to a sentry alert/i)).toBeInTheDocument();
    expect(screen.getByText('https://example.test/webhook/abc')).toBeInTheDocument();
    expect(screen.getByText('s3cret')).toBeInTheDocument();
    expect(screen.getByText(/X-Sentry-Hook-Signature/i)).toBeInTheDocument();
  });

  it('renders Datadog-specific instructions', () => {
    render(
      <WebhookSetupWizardModal
        open
        onClose={() => {}}
        lang="en"
        source="datadog"
        url="https://example.test/webhook/abc"
        secret="s3cret"
      />
    );

    expect(screen.getByText(/wire this to a datadog monitor/i)).toBeInTheDocument();
    expect(screen.getByText(/X-Datadog-Signature/i)).toBeInTheDocument();
  });

  it('warns when no secret is set', () => {
    render(
      <WebhookSetupWizardModal
        open
        onClose={() => {}}
        lang="en"
        source="sentry"
        url="https://example.test/webhook/abc"
        secret={null}
      />
    );

    expect(screen.getByText(/no hmac secret/i)).toBeInTheDocument();
  });

  it('copies the URL to the clipboard on click', async () => {
    const writeText = installClipboard();
    render(
      <WebhookSetupWizardModal
        open
        onClose={() => {}}
        lang="en"
        source="sentry"
        url="https://example.test/webhook/abc"
        secret="s3cret"
      />
    );

    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    fireEvent.click(copyButtons[0]);

    expect(writeText).toHaveBeenCalledWith('https://example.test/webhook/abc');
  });

  it('fires onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <WebhookSetupWizardModal
        open
        onClose={onClose}
        lang="en"
        source="sentry"
        url="https://example.test/webhook/abc"
        secret="s3cret"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders Spanish strings when lang=es', () => {
    render(
      <WebhookSetupWizardModal
        open
        onClose={() => {}}
        lang="es"
        source="github"
        url="https://example.test/webhook/abc"
        secret="s3cret"
      />
    );

    expect(screen.getByText(/conectar con un repo de github/i)).toBeInTheDocument();
  });
});
