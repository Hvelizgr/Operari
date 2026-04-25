import {
  renderContactForwardEmail,
  renderInviteEmail,
  renderMonitorAlertEmail,
  renderPasswordResetEmail,
  renderVerificationEmail,
} from '../../services/email-templates';

describe('email-templates', () => {
  describe('renderVerificationEmail', () => {
    it('returns english subject, text, and html when no locale given', () => {
      const r = renderVerificationEmail({
        verifyUrl: 'https://app.nanorun.dev/verify?token=abc',
        userEmail: 'user@example.com',
      });
      expect(r.subject).toBe('Verify your NanoRun email');
      expect(r.text).toContain('https://app.nanorun.dev/verify?token=abc');
      expect(r.html).toContain('Verify your email');
      expect(r.html).toContain('https://app.nanorun.dev/verify?token=abc');
      // `<!DOCTYPE` is lower-cased by our renderer — check the declaration exists
      expect(r.html.startsWith('<!DOCTYPE html>')).toBe(true);
      // lang attribute reflects the locale
      expect(r.html).toContain('<html lang="en">');
    });

    it('renders the spanish shell when locale=es', () => {
      const r = renderVerificationEmail({
        verifyUrl: 'https://app.nanorun.dev/verify?token=abc',
        userEmail: 'user@example.com',
        locale: 'es',
      });
      expect(r.subject).toBe('Verificá tu email de NanoRun');
      expect(r.html).toContain('<html lang="es">');
      expect(r.html).toContain('Verificá tu email');
    });
  });

  describe('renderPasswordResetEmail', () => {
    it('includes the expiry copy in both text and html', () => {
      const r = renderPasswordResetEmail({
        resetUrl: 'https://app.nanorun.dev/reset?token=xyz',
        userEmail: 'user@example.com',
      });
      expect(r.text).toContain('30 minutes');
      expect(r.html).toContain('30 minutes');
      expect(r.html).toContain('Reset password');
    });
  });

  describe('renderInviteEmail', () => {
    it('interpolates tenant and inviter', () => {
      const r = renderInviteEmail({
        inviteUrl: 'https://app.nanorun.dev/invite/tok',
        inviterEmail: 'alice@ex.com',
        tenantName: 'Acme SRE',
      });
      expect(r.subject).toContain('Acme SRE');
      expect(r.html).toContain('Acme SRE');
      expect(r.html).toContain('alice@ex.com');
    });
  });

  describe('renderMonitorAlertEmail', () => {
    it('renders subject + heading with the monitor name interpolated', () => {
      const r = renderMonitorAlertEmail({
        monitorName: 'Payments-API 5xx rate',
        reason: '5xx rate 12% (threshold 5%)',
        contextLine: 'Runbook: payments-sre',
        monitorUrl: 'https://app.nanorun.dev/en/monitors/mon-123',
      });
      expect(r.subject).toBe('[NanoRun] Monitor "Payments-API 5xx rate" is FIRING');
      expect(r.html).toContain('Payments-API 5xx rate');
      expect(r.html).toContain('5xx rate 12% (threshold 5%)');
      expect(r.html).toContain('Runbook: payments-sre');
      // CTA wired through sanitiser so the monitor URL lands intact.
      expect(r.html).toContain('https://app.nanorun.dev/en/monitors/mon-123');
      expect(r.html).toContain('Open monitor');
    });

    it('omits the CTA block when no monitorUrl is provided', () => {
      const r = renderMonitorAlertEmail({
        monitorName: 'DB replica lag',
        reason: 'lag 30s',
      });
      // No button label means the CTA table shouldn't render at all.
      expect(r.html).not.toContain('Open monitor');
      // But the subject + body still carry the essentials.
      expect(r.subject).toContain('DB replica lag');
      expect(r.text).toContain('lag 30s');
    });

    it('renders the spanish locale with the same structure', () => {
      const r = renderMonitorAlertEmail({
        monitorName: 'Pagos-API',
        reason: 'tasa 5xx supera umbral',
        locale: 'es',
      });
      expect(r.subject).toBe('[NanoRun] El monitor "Pagos-API" está FIRING');
      expect(r.html).toContain('Razón');
      expect(r.html).toContain('tasa 5xx supera umbral');
    });

    it('escapes HTML in the monitor name so a crafted name cannot inject markup', () => {
      const r = renderMonitorAlertEmail({
        monitorName: '<script>alert(1)</script>',
        reason: 'ok',
      });
      // The subject is plain text — no escaping needed.
      // In the HTML body the tag bytes must be escaped so the alert
      // email can never render attacker script, even if a tenant has
      // a compromised monitor name.
      expect(r.html).not.toContain('<script>alert(1)</script>');
      expect(r.html).toContain('&lt;script&gt;');
    });
  });

  describe('renderContactForwardEmail', () => {
    it('includes the message and sender in text + html', () => {
      const r = renderContactForwardEmail({
        name: 'Mallory',
        fromEmail: 'm@example.com',
        company: 'Hackers Inc',
        message: 'I found a bug in your auth.',
      });
      expect(r.subject).toBe('[contact] Mallory');
      expect(r.text).toContain('Mallory <m@example.com>');
      expect(r.text).toContain('Hackers Inc');
      expect(r.text).toContain('I found a bug in your auth.');
      expect(r.html).toContain('Hackers Inc');
      expect(r.html).toContain('I found a bug in your auth.');
    });

    it('omits the company row when not provided', () => {
      const r = renderContactForwardEmail({
        name: 'Mallory',
        fromEmail: 'm@example.com',
        message: 'hi',
      });
      expect(r.html).not.toContain('>Company<');
      expect(r.text).not.toContain('Company:');
    });
  });

  describe('security hardening', () => {
    it('escapes HTML in user-supplied content so a malicious name cannot inject markup', () => {
      const r = renderContactForwardEmail({
        name: '<script>alert(1)</script>',
        fromEmail: 'x@ex.com',
        message: '<img src=x onerror=alert(1) />',
      });
      // The raw tag bytes never land as live markup — they're
      // re-emitted as escaped text in a monospace block.
      expect(r.html).not.toContain('<script>alert(1)</script>');
      expect(r.html).not.toContain('<img src=x onerror=alert(1)');
      expect(r.html).toContain('&lt;script&gt;');
      expect(r.html).toContain('&lt;img src=x onerror=alert(1)');
    });

    it('neutralizes a javascript: CTA URL so the branded button never links to it', () => {
      const r = renderPasswordResetEmail({
        resetUrl: 'javascript:alert(1)',
        userEmail: 'user@example.com',
      });
      // The href lands on the sanitizer fallback, not the raw URL.
      expect(r.html).not.toContain('javascript:alert(1)');
      expect(r.html).toMatch(/href="#"/);
    });
  });
});
