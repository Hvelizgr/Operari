import {
  renderContactForwardEmail,
  renderInviteEmail,
  renderPasswordResetEmail,
  renderVerificationEmail,
} from '../../services/email-templates';

describe('email-templates', () => {
  describe('renderVerificationEmail', () => {
    it('returns english subject, text, and html when no locale given', () => {
      const r = renderVerificationEmail({
        verifyUrl: 'https://app.cairn.run/verify?token=abc',
        userEmail: 'user@example.com',
      });
      expect(r.subject).toBe('Verify your Cairn email');
      expect(r.text).toContain('https://app.cairn.run/verify?token=abc');
      expect(r.html).toContain('Verify your email');
      expect(r.html).toContain('https://app.cairn.run/verify?token=abc');
      // `<!DOCTYPE` is lower-cased by our renderer — check the declaration exists
      expect(r.html.startsWith('<!DOCTYPE html>')).toBe(true);
      // lang attribute reflects the locale
      expect(r.html).toContain('<html lang="en">');
    });

    it('renders the spanish shell when locale=es', () => {
      const r = renderVerificationEmail({
        verifyUrl: 'https://app.cairn.run/verify?token=abc',
        userEmail: 'user@example.com',
        locale: 'es',
      });
      expect(r.subject).toBe('Verificá tu email de Cairn');
      expect(r.html).toContain('<html lang="es">');
      expect(r.html).toContain('Verificá tu email');
    });
  });

  describe('renderPasswordResetEmail', () => {
    it('includes the expiry copy in both text and html', () => {
      const r = renderPasswordResetEmail({
        resetUrl: 'https://app.cairn.run/reset?token=xyz',
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
        inviteUrl: 'https://app.cairn.run/invite/tok',
        inviterEmail: 'alice@ex.com',
        tenantName: 'Acme SRE',
      });
      expect(r.subject).toContain('Acme SRE');
      expect(r.html).toContain('Acme SRE');
      expect(r.html).toContain('alice@ex.com');
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
