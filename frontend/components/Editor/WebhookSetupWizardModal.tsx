'use client';

import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { useState } from 'react';

import { useEscapeKey } from '@/hooks/useEscapeKey';

interface WebhookSetupWizardModalProps {
  open: boolean;
  onClose: () => void;
  lang: 'en' | 'es';
  source: 'sentry' | 'datadog' | 'github' | 'custom';
  url: string;
  secret: string | null;
}

const STRINGS = {
  en: {
    title: 'Setup wizard',
    closeLabel: 'Close',
    copy: 'Copy',
    copied: 'Copied',
    urlLabel: 'Webhook URL',
    secretLabel: 'Signing secret',
    secretMissing:
      'No HMAC secret on this webhook. Anyone who learns the URL can fire it. Recreate with the signed-secret option for production.',
    openProvider: 'Open provider docs',
    sentry: {
      header: 'Wire this to a Sentry alert',
      steps: [
        '1. In Sentry: Settings → Integrations → "Internal Integrations" → New Internal Integration.',
        '2. Permissions: grant "Issue & Event: Read". Webhooks: paste the URL above; alerts will be sent there.',
        '3. Save and copy the integration\'s "Client Secret" — but DO NOT use it. Operari uses its OWN signing secret (above) which Sentry posts under the X-Sentry-Hook-Signature header.',
        '4. In Operari, leave the secret as is. Operari verifies HMAC SHA-256 on every incoming request.',
        '5. To trigger this runbook from a Sentry Issue Alert, edit the alert rule and add this Internal Integration to the "Send a notification via" actions.',
      ],
      docsUrl: 'https://docs.sentry.io/product/integrations/integration-platform/webhooks/',
      varsHint:
        'On a fired alert the runbook receives vars.alert.title, vars.alert.url, vars.alert.severity, plus Sentry-specific vars.issue_id, vars.exception_type, vars.stacktrace_frames, vars.transaction.',
    },
    datadog: {
      header: 'Wire this to a Datadog monitor',
      steps: [
        '1. In Datadog: Integrations → Webhooks → New (or Manage Connections → Webhook).',
        '2. Name: "operari-runbook-<runbook-name>". URL: paste the URL above.',
        '3. Custom Headers: add `X-Datadog-Signature: $hmac_sha256($payload, "<the secret above>")`. Datadog signs payloads with this header so Operari can verify HMAC SHA-256.',
        '4. Payload: leave the default; Operari accepts both monitor and event shapes.',
        '5. Reference the webhook in your monitor message with @webhook-operari-runbook-<runbook-name>. The monitor will fire this runbook on alert / no_data / warning transitions.',
      ],
      docsUrl: 'https://docs.datadoghq.com/integrations/webhooks/',
      varsHint:
        'On a fired monitor the runbook receives vars.alert.title, vars.alert.url, vars.alert.severity (mapped from priority P1/P2/P3), plus vars.monitor_id, vars.monitor_query, vars.threshold, vars.current_value.',
    },
    github: {
      header: 'Wire this to a GitHub repository',
      steps: [
        '1. In the GitHub repo (or org): Settings → Webhooks → Add webhook.',
        '2. Payload URL: paste the URL above. Content type: application/json.',
        '3. Secret: paste the signing secret above. GitHub will sign every delivery with HMAC SHA-256 under X-Hub-Signature-256.',
        '4. SSL verification: enable. Events: pick the events you want to trigger this runbook on (push, release, deployment, issue_comment, etc.).',
        "5. Add webhook. GitHub will send a ping; Operari ack's with 200 OK if signature verifies.",
      ],
      docsUrl: 'https://docs.github.com/en/webhooks',
      varsHint:
        'Variables exposed depend on the event. Most events expose vars.repository, vars.sender, and the event-specific top-level fields (e.g. vars.pull_request, vars.commits, vars.release).',
    },
    custom: {
      header: 'Custom HTTP source',
      steps: [
        '1. Configure your sender to POST JSON to the URL above.',
        '2. To enable HMAC verification, sign the request body with HMAC SHA-256 using the signing secret and put the hex digest in one of: X-Hub-Signature-256 (with the `sha256=` prefix), X-Sentry-Hook-Signature, X-Datadog-Signature, or X-Webhook-Signature.',
        '3. Operari will reject the call with 401 if the secret is set and the signature does not match. With no secret on the webhook, signature verification is skipped — only do that for short-lived testing.',
        '4. The full request body is exposed to the runbook as vars.payload, plus shorthand vars for known shapes.',
      ],
      docsUrl: null,
      varsHint:
        'The whole request body is forwarded as vars.payload. If your sender follows the Sentry / Datadog / GitHub envelope, those parsers run automatically.',
    },
  },
  es: {
    title: 'Asistente de configuración',
    closeLabel: 'Cerrar',
    copy: 'Copiar',
    copied: 'Copiado',
    urlLabel: 'URL del webhook',
    secretLabel: 'Secreto de firma',
    secretMissing:
      'Este webhook no tiene secreto HMAC. Cualquiera con la URL puede dispararlo. Recreá con la opción de firma para producción.',
    openProvider: 'Abrir docs del proveedor',
    sentry: {
      header: 'Conectar con una alerta de Sentry',
      steps: [
        '1. En Sentry: Settings → Integrations → "Internal Integrations" → New Internal Integration.',
        '2. Permisos: dale "Issue & Event: Read". Webhooks: pegá la URL de arriba; las alertas se enviarán ahí.',
        '3. Guardá la integración y copiá su "Client Secret" — pero NO lo uses. Operari usa SU PROPIO secreto de firma (el de arriba), que Sentry manda en el header X-Sentry-Hook-Signature.',
        '4. En Operari, dejá el secreto como está. Operari verifica HMAC SHA-256 en cada request.',
        '5. Para disparar este runbook desde un Issue Alert de Sentry, editá la regla de alerta y agregá esta Internal Integration en las acciones "Send a notification via".',
      ],
      docsUrl: 'https://docs.sentry.io/product/integrations/integration-platform/webhooks/',
      varsHint:
        'Cuando dispara, el runbook recibe vars.alert.title, vars.alert.url, vars.alert.severity, más vars específicos de Sentry: vars.issue_id, vars.exception_type, vars.stacktrace_frames, vars.transaction.',
    },
    datadog: {
      header: 'Conectar con un monitor de Datadog',
      steps: [
        '1. En Datadog: Integrations → Webhooks → New (o Manage Connections → Webhook).',
        '2. Nombre: "operari-runbook-<nombre-del-runbook>". URL: pegá la URL de arriba.',
        '3. Custom Headers: agregá `X-Datadog-Signature: $hmac_sha256($payload, "<el secreto de arriba>")`. Datadog firma los payloads con este header para que Operari verifique HMAC SHA-256.',
        '4. Payload: dejá el default; Operari acepta tanto formatos de monitor como de event.',
        '5. Referenciá el webhook en el mensaje del monitor con @webhook-operari-runbook-<nombre>. El monitor dispara este runbook en transiciones alert / no_data / warning.',
      ],
      docsUrl: 'https://docs.datadoghq.com/integrations/webhooks/',
      varsHint:
        'Cuando dispara, el runbook recibe vars.alert.title, vars.alert.url, vars.alert.severity (mapeado desde priority P1/P2/P3), más vars.monitor_id, vars.monitor_query, vars.threshold, vars.current_value.',
    },
    github: {
      header: 'Conectar con un repo de GitHub',
      steps: [
        '1. En el repo (o la org) de GitHub: Settings → Webhooks → Add webhook.',
        '2. Payload URL: pegá la URL de arriba. Content type: application/json.',
        '3. Secret: pegá el secreto de firma de arriba. GitHub firma cada entrega con HMAC SHA-256 en X-Hub-Signature-256.',
        '4. SSL verification: enable. Events: elegí los eventos que disparan este runbook (push, release, deployment, issue_comment, etc.).',
        '5. Add webhook. GitHub manda un ping; Operari responde 200 OK si la firma verifica.',
      ],
      docsUrl: 'https://docs.github.com/es/webhooks',
      varsHint:
        'Las variables expuestas dependen del evento. La mayoría exponen vars.repository, vars.sender, y los campos top-level del evento (ej. vars.pull_request, vars.commits, vars.release).',
    },
    custom: {
      header: 'Fuente HTTP genérica',
      steps: [
        '1. Configurá tu emisor para hacer POST de JSON a la URL de arriba.',
        '2. Para habilitar verificación HMAC, firmá el body con HMAC SHA-256 usando el secreto, y poné el hex digest en uno de: X-Hub-Signature-256 (con el prefijo `sha256=`), X-Sentry-Hook-Signature, X-Datadog-Signature, o X-Webhook-Signature.',
        '3. Operari rechaza el request con 401 si hay secreto configurado y la firma no coincide. Sin secreto, la verificación se saltea — usalo solo para pruebas cortas.',
        '4. El body completo se expone al runbook como vars.payload, más vars de shorthand para shapes conocidos.',
      ],
      docsUrl: null,
      varsHint:
        'El body entero se forwardea como vars.payload. Si tu emisor sigue el envelope de Sentry / Datadog / GitHub, esos parsers corren automáticamente.',
    },
  },
} as const;

export default function WebhookSetupWizardModal({
  open,
  onClose,
  lang,
  source,
  url,
  secret,
}: WebhookSetupWizardModalProps) {
  useEscapeKey(open, onClose);
  const t = STRINGS[lang];
  const provider = t[source];
  const [copied, setCopied] = useState<'url' | 'secret' | null>(null);

  if (!open) return null;

  const copy = async (kind: 'url' | 'secret', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard API failure (insecure context, no permission). Fall
      // back to a no-op — the operator can still select + copy manually.
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--panel-border)] px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
              {t.title}
            </div>
            <h3 className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
              {provider.header}
            </h3>
          </div>
          <button
            type="button"
            aria-label={t.closeLabel}
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--weathered,#262626)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t.urlLabel}
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded border border-[var(--panel-border)] bg-[var(--weathered,#1a1a1a)] px-2 py-1.5 font-mono text-[11px] text-[var(--text-primary)]">
                {url}
              </code>
              <button
                type="button"
                onClick={() => copy('url', url)}
                className="inline-flex items-center gap-1 rounded border border-[var(--panel-border)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-color)] hover:text-[var(--text-primary)]"
              >
                {copied === 'url' ? <Check size={11} /> : <Copy size={11} />}
                {copied === 'url' ? t.copied : t.copy}
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t.secretLabel}
            </div>
            {secret ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded border border-[var(--panel-border)] bg-[var(--weathered,#1a1a1a)] px-2 py-1.5 font-mono text-[11px] text-[var(--text-primary)]">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={() => copy('secret', secret)}
                  className="inline-flex items-center gap-1 rounded border border-[var(--panel-border)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-color)] hover:text-[var(--text-primary)]"
                >
                  {copied === 'secret' ? <Check size={11} /> : <Copy size={11} />}
                  {copied === 'secret' ? t.copied : t.copy}
                </button>
              </div>
            ) : (
              <div className="rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
                {t.secretMissing}
              </div>
            )}
          </div>

          <ol className="space-y-2 text-xs leading-relaxed text-[var(--text-primary)]">
            {provider.steps.map((step, i) => (
              <li
                key={i}
                className="rounded border border-[var(--panel-border)] bg-[var(--panel-bg-subtle,transparent)] px-3 py-2"
              >
                {step}
              </li>
            ))}
          </ol>

          <div className="bg-[var(--weathered,#1a1a1a)]/40 rounded border border-[var(--panel-border)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
            {provider.varsHint}
          </div>

          {provider.docsUrl && (
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-color)] hover:underline"
            >
              {t.openProvider}
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
