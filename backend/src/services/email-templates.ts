/**
 * Zero-dependency transactional email templates.
 *
 * Every function in this module returns { subject, text, html }
 * pairs ready to hand to `sendEmail`. We intentionally avoid
 * react-email / mjml — they add a build step and dozens of
 * transitive deps for five templates.
 *
 * The HTML is table-based by deliberate choice:
 *   - Gmail, Outlook 2016, Yahoo Mail, and Apple Mail still parse
 *     `<table role="presentation">` more reliably than flex/grid.
 *   - Inline styles survive every client's style-stripper.
 *   - No `<link rel="stylesheet">` (Outlook rejects it).
 *   - System font stack so we never reach for a font file.
 *
 * Every call site passes a locale ('en' | 'es'). The bilingual
 * strings live in STRINGS below, paired one-for-one with an
 * English fallback so partial translations never leak untranslated
 * keys into production.
 */

export type EmailLocale = 'en' | 'es';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface PasswordResetParams {
  resetUrl: string;
  userEmail: string;
  locale?: EmailLocale;
}

export interface VerificationParams {
  verifyUrl: string;
  userEmail: string;
  locale?: EmailLocale;
}

export interface InviteParams {
  inviteUrl: string;
  inviterEmail: string;
  tenantName: string;
  locale?: EmailLocale;
}

export interface ContactForwardParams {
  name: string;
  fromEmail: string;
  company?: string | null;
  message: string;
  locale?: EmailLocale;
}

export interface MonitorAlertParams {
  monitorName: string;
  reason: string;
  /** Optional extra context (tenant/runbook name) surfaced directly
   *  in the body so the on-call engineer knows *which* runbook is
   *  misbehaving without opening the dashboard. */
  contextLine?: string;
  /** Link to the monitor detail page in the app. Omitted renders an
   *  alert email with no CTA button — still deliverable. */
  monitorUrl?: string;
  locale?: EmailLocale;
}

// ─────────────────────────────────────────────────────────────
// Public renderers — one per call site.
// ─────────────────────────────────────────────────────────────

export function renderPasswordResetEmail(p: PasswordResetParams): RenderedEmail {
  const t = STRINGS[p.locale ?? 'en'].passwordReset;
  return {
    subject: t.subject,
    text: [t.heading, '', t.body, '', p.resetUrl, '', t.expiry, '', t.ignoreLine].join('\n'),
    html: renderShell({
      locale: p.locale ?? 'en',
      preheader: t.preheader,
      heading: t.heading,
      lead: t.body,
      ctaLabel: t.cta,
      ctaUrl: p.resetUrl,
      metaLines: [t.expiry, t.ignoreLine],
    }),
  };
}

export function renderVerificationEmail(p: VerificationParams): RenderedEmail {
  const t = STRINGS[p.locale ?? 'en'].verification;
  return {
    subject: t.subject,
    text: [t.heading, '', t.body, '', p.verifyUrl, '', t.expiry].join('\n'),
    html: renderShell({
      locale: p.locale ?? 'en',
      preheader: t.preheader,
      heading: t.heading,
      lead: t.body,
      ctaLabel: t.cta,
      ctaUrl: p.verifyUrl,
      metaLines: [t.expiry],
    }),
  };
}

export function renderInviteEmail(p: InviteParams): RenderedEmail {
  const t = STRINGS[p.locale ?? 'en'].invite;
  const heading = fill(t.heading, { tenantName: p.tenantName });
  const body = fill(t.body, { inviterEmail: p.inviterEmail, tenantName: p.tenantName });
  return {
    subject: fill(t.subject, { tenantName: p.tenantName }),
    text: [heading, '', body, '', p.inviteUrl, '', t.expiry].join('\n'),
    html: renderShell({
      locale: p.locale ?? 'en',
      preheader: fill(t.preheader, { tenantName: p.tenantName }),
      heading,
      lead: body,
      ctaLabel: t.cta,
      ctaUrl: p.inviteUrl,
      metaLines: [t.expiry],
    }),
  };
}

export function renderMonitorAlertEmail(p: MonitorAlertParams): RenderedEmail {
  const t = STRINGS[p.locale ?? 'en'].monitorAlert;
  const heading = fill(t.heading, { monitorName: p.monitorName });
  const metaRows: Array<[string, string]> = [
    [t.monitorLabel, p.monitorName],
    [t.reasonLabel, p.reason],
  ];
  if (p.contextLine) metaRows.push([t.contextLabel, p.contextLine]);

  const textLines = [
    heading,
    '',
    `${t.monitorLabel}: ${p.monitorName}`,
    `${t.reasonLabel}: ${p.reason}`,
    ...(p.contextLine ? [`${t.contextLabel}: ${p.contextLine}`] : []),
    '',
    ...(p.monitorUrl ? [p.monitorUrl, ''] : []),
    t.footerLine,
  ];

  return {
    subject: fill(t.subject, { monitorName: p.monitorName }),
    text: textLines.join('\n'),
    html: renderShell({
      locale: p.locale ?? 'en',
      preheader: fill(t.preheader, { monitorName: p.monitorName }),
      heading,
      metaRows,
      ...(p.monitorUrl
        ? {
            ctaLabel: t.cta,
            ctaUrl: p.monitorUrl,
          }
        : {}),
      metaLines: [t.footerLine],
    }),
  };
}

export function renderContactForwardEmail(p: ContactForwardParams): RenderedEmail {
  const t = STRINGS[p.locale ?? 'en'].contact;
  const heading = fill(t.heading, { name: p.name });
  // Contact messages are forwarded inline — the operator reading
  // them wants the message front-and-center, not a CTA. Render a
  // compact layout with the sender meta + the raw body in a
  // monospace card.
  const metaRows: Array<[string, string]> = [[t.fromLabel, `${p.name} <${p.fromEmail}>`]];
  if (p.company) metaRows.push([t.companyLabel, p.company]);

  return {
    subject: fill(t.subject, { name: p.name }),
    text: [heading, '', ...metaRows.map(([k, v]) => `${k}: ${v}`), '', p.message].join('\n'),
    html: renderShell({
      locale: p.locale ?? 'en',
      preheader: fill(t.preheader, { name: p.name }),
      heading,
      metaRows,
      messageBlock: p.message,
    }),
  };
}

// ─────────────────────────────────────────────────────────────
// Shared HTML shell
// ─────────────────────────────────────────────────────────────

interface ShellParams {
  locale: EmailLocale;
  preheader: string;
  heading: string;
  lead?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  metaLines?: string[];
  metaRows?: Array<[string, string]>;
  messageBlock?: string;
}

/**
 * Brand constants. Kept in-file instead of imported from frontend
 * because the backend has no bundler — a cross-package import from
 * globals.css is not reachable.
 */
const BRAND = {
  name: 'NanoRun',
  emerald: '#3ecf8e',
  ink: '#0a0a0a',
  text: '#1e293b',
  subtext: '#64748b',
  card: '#ffffff',
  border: '#e2e8f0',
  bg: '#f8fafc',
  mono: "'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif",
} as const;

const ALLOWED_CTA_PROTOCOLS = ['https:', 'http:'];

function renderShell(p: ShellParams): string {
  const safeCtaUrl = p.ctaUrl ? sanitizeUrl(p.ctaUrl) : null;
  const footer = STRINGS[p.locale].footer;

  const leadBlock = p.lead
    ? `<p style="margin:0 0 28px;font:400 16px/1.55 ${BRAND.sans};color:${BRAND.text};">${escapeHtml(p.lead)}</p>`
    : '';

  const ctaBlock =
    safeCtaUrl && p.ctaLabel
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
  <tr>
    <td align="left" bgcolor="${BRAND.emerald}" style="border-radius:10px;">
      <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer"
         style="display:inline-block;padding:14px 26px;font:600 15px/1 ${BRAND.sans};color:${BRAND.ink};text-decoration:none;border-radius:10px;">
        ${escapeHtml(p.ctaLabel)}
      </a>
    </td>
  </tr>
</table>
<p style="margin:0 0 28px;font:400 12px/1.5 ${BRAND.mono};color:${BRAND.subtext};word-break:break-all;">
  ${escapeHtml(safeCtaUrl)}
</p>`
      : '';

  const metaLinesBlock = (p.metaLines ?? [])
    .map(
      line =>
        `<p style="margin:0 0 8px;font:400 13px/1.5 ${BRAND.sans};color:${BRAND.subtext};">${escapeHtml(line)}</p>`
    )
    .join('');

  const metaRowsBlock = (p.metaRows ?? [])
    .map(
      ([k, v]) =>
        `<tr>
  <td style="padding:6px 0;font:600 12px/1.5 ${BRAND.sans};color:${BRAND.subtext};text-transform:uppercase;letter-spacing:0.08em;width:110px;vertical-align:top;">${escapeHtml(k)}</td>
  <td style="padding:6px 0;font:400 14px/1.5 ${BRAND.sans};color:${BRAND.text};">${escapeHtml(v)}</td>
</tr>`
    )
    .join('');

  const metaRowsTable = metaRowsBlock
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 20px;border-collapse:collapse;">
${metaRowsBlock}
</table>`
    : '';

  const messageBlockHtml = p.messageBlock
    ? `<div style="padding:16px 18px;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:10px;font:400 14px/1.55 ${BRAND.mono};color:${BRAND.text};white-space:pre-wrap;">
${escapeHtml(p.messageBlock)}
</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="${p.locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${escapeHtml(p.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:${BRAND.sans};">
<!-- Preheader (hidden, shown as preview text in inbox list) -->
<div style="display:none !important;max-height:0;overflow:hidden;opacity:0;color:transparent;">
  ${escapeHtml(p.preheader)}
</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${BRAND.bg};">
  <tr>
    <td align="center" style="padding:40px 20px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;width:100%;">
        <tr>
          <td align="left" style="padding:0 0 28px;">
            ${renderLogoLockup()}
          </td>
        </tr>
        <tr>
          <td style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;padding:36px 36px 32px;">
            <h1 style="margin:0 0 16px;font:700 22px/1.3 ${BRAND.sans};color:${BRAND.ink};letter-spacing:-0.01em;">
              ${escapeHtml(p.heading)}
            </h1>
            ${leadBlock}
            ${metaRowsTable}
            ${messageBlockHtml}
            ${ctaBlock}
            ${metaLinesBlock}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 8px 0;">
            <p style="margin:0;font:400 12px/1.5 ${BRAND.sans};color:${BRAND.subtext};">
              ${escapeHtml(footer.tagline)}
            </p>
            <p style="margin:8px 0 0;font:400 12px/1.5 ${BRAND.sans};color:${BRAND.subtext};">
              <a href="https://nanorun.dev" style="color:${BRAND.subtext};text-decoration:underline;">nanorun.dev</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function renderLogoLockup(): string {
  // Inline SVG mark + wordmark. Inline so no external asset load —
  // email clients block remote images by default (privacy mode), and
  // a wordmark that doesn't render leaves the email looking broken.
  //
  // The mark is the same DNA-helix used in-app (DNAMark.tsx):
  //   - two strands crossing at top, middle, bottom
  //   - circles at the crossings = runbook steps
  // Reproduced as a static string here because the backend has no JSX
  // pipeline; any update to the in-app SVG should be mirrored here.
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="padding-right:10px;vertical-align:middle;">
      <div style="width:32px;height:32px;border:1px solid ${BRAND.emerald}55;background:${BRAND.emerald}1f;border-radius:8px;text-align:center;line-height:32px;">
        <span style="display:inline-block;transform:translateY(2px);">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M 16 2 C 8 6, 8 12, 16 16 C 24 20, 24 26, 16 30" stroke="${BRAND.emerald}" stroke-width="2" stroke-linecap="round" fill="none" />
            <path d="M 16 2 C 24 6, 24 12, 16 16 C 8 20, 8 26, 16 30" stroke="${BRAND.ink}" stroke-width="2" stroke-linecap="round" fill="none" />
            <circle cx="16" cy="2" r="1.6" fill="${BRAND.emerald}" />
            <circle cx="16" cy="16" r="1.8" fill="${BRAND.emerald}" />
            <circle cx="16" cy="30" r="1.6" fill="${BRAND.emerald}" />
          </svg>
        </span>
      </div>
    </td>
    <td style="vertical-align:middle;font:700 18px/1 ${BRAND.sans};color:${BRAND.ink};letter-spacing:-0.01em;">
      ${BRAND.name}
    </td>
  </tr>
</table>`;
}

// ─────────────────────────────────────────────────────────────
// Bilingual copy
// ─────────────────────────────────────────────────────────────

const STRINGS = {
  en: {
    passwordReset: {
      subject: 'Reset your NanoRun password',
      preheader: 'Open the link inside — valid for 30 minutes.',
      heading: 'Reset your password',
      body: 'Someone (hopefully you) asked to reset the password on your NanoRun account. Click the button below to pick a new one.',
      cta: 'Reset password',
      expiry: 'This link expires in 30 minutes.',
      ignoreLine: "Didn't request this? You can ignore this email — your password hasn't changed.",
    },
    verification: {
      subject: 'Verify your NanoRun email',
      preheader: 'One click to finish setting up your workspace.',
      heading: 'Verify your email',
      body: 'Confirm this is your inbox so you can receive invites, alerts, and audit exports from NanoRun.',
      cta: 'Verify email',
      expiry: 'This link is valid for 7 days.',
    },
    invite: {
      subject: "You're invited to {tenantName} on NanoRun",
      preheader: '{tenantName} added you as a teammate.',
      heading: 'Join {tenantName}',
      body: '{inviterEmail} invited you to collaborate on runbooks in the {tenantName} workspace.',
      cta: 'Accept invite',
      expiry: 'This invite expires in 7 days.',
    },
    contact: {
      subject: '[contact] {name}',
      preheader: 'New message from the NanoRun contact form.',
      heading: 'New message from {name}',
      fromLabel: 'From',
      companyLabel: 'Company',
    },
    monitorAlert: {
      subject: '[NanoRun] Monitor "{monitorName}" is FIRING',
      preheader: 'Monitor {monitorName} just transitioned to FIRING.',
      heading: 'Monitor "{monitorName}" is FIRING',
      monitorLabel: 'Monitor',
      reasonLabel: 'Reason',
      contextLabel: 'Context',
      cta: 'Open monitor',
      footerLine: 'Open NanoRun to acknowledge or silence this alert.',
    },
    footer: {
      tagline: 'NanoRun · runbook automation for on-call engineers.',
    },
  },
  es: {
    passwordReset: {
      subject: 'Restablecé tu contraseña de NanoRun',
      preheader: 'Abrí el link adentro — válido 30 minutos.',
      heading: 'Restablecé tu contraseña',
      body: 'Alguien (esperamos que vos) pidió restablecer la contraseña de tu cuenta NanoRun. Hacé clic en el botón para elegir una nueva.',
      cta: 'Restablecer contraseña',
      expiry: 'Este link vence en 30 minutos.',
      ignoreLine: '¿No lo pediste? Podés ignorar este email — tu contraseña no cambió.',
    },
    verification: {
      subject: 'Verificá tu email de NanoRun',
      preheader: 'Un clic para terminar de configurar tu workspace.',
      heading: 'Verificá tu email',
      body: 'Confirmá que este es tu inbox para recibir invitaciones, alertas y exports de auditoría desde NanoRun.',
      cta: 'Verificar email',
      expiry: 'Este link es válido por 7 días.',
    },
    invite: {
      subject: 'Te invitaron a {tenantName} en NanoRun',
      preheader: '{tenantName} te sumó como compañero/a.',
      heading: 'Unite a {tenantName}',
      body: '{inviterEmail} te invitó a colaborar con runbooks en el workspace {tenantName}.',
      cta: 'Aceptar invitación',
      expiry: 'La invitación vence en 7 días.',
    },
    contact: {
      subject: '[contacto] {name}',
      preheader: 'Nuevo mensaje desde el form de contacto de NanoRun.',
      heading: 'Nuevo mensaje de {name}',
      fromLabel: 'De',
      companyLabel: 'Empresa',
    },
    monitorAlert: {
      subject: '[NanoRun] El monitor "{monitorName}" está FIRING',
      preheader: 'El monitor {monitorName} acaba de transicionar a FIRING.',
      heading: 'El monitor "{monitorName}" está FIRING',
      monitorLabel: 'Monitor',
      reasonLabel: 'Razón',
      contextLabel: 'Contexto',
      cta: 'Abrir monitor',
      footerLine: 'Abrí NanoRun para reconocer o silenciar esta alerta.',
    },
    footer: {
      tagline: 'NanoRun · automatización de runbooks para on-call.',
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, c => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

/**
 * Whitelist the CTA URL to http(s) so a malicious template variable
 * (e.g. `javascript:alert(1)`) can never become a clickable link in
 * a branded email that reads as first-party.
 */
function sanitizeUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    return ALLOWED_CTA_PROTOCOLS.includes(parsed.protocol) ? parsed.toString() : '#';
  } catch {
    return '#';
  }
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}
