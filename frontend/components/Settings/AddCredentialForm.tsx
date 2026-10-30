'use client';

import { KeyRound, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

import { csrfToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Mode = 'credential' | 'ai';

// Provider ids steps understand; "custom" lets the user type their own.
const CREDENTIAL_KINDS = [
  ['slack', 'Slack bot token'],
  ['pagerduty', 'PagerDuty routing key'],
  ['opsgenie', 'Opsgenie API key'],
  ['github', 'GitHub token'],
  ['gitlab', 'GitLab token'],
  ['jira', 'Jira API token'],
  ['linear', 'Linear API key'],
  ['notion', 'Notion integration token'],
  ['datadog', 'Datadog API key'],
  ['grafana', 'Grafana service account token'],
  ['sentry', 'Sentry auth token'],
  ['cloudflare', 'Cloudflare API token'],
  ['kubernetes', 'Kubernetes service account token'],
  ['postgres', 'Postgres connection string'],
  ['redis', 'Redis URL'],
  ['ssh', 'SSH private key'],
  ['smtp', 'SMTP URL'],
  ['twilio', 'Twilio auth token'],
  ['sendgrid', 'SendGrid API key'],
  ['resend', 'Resend API key'],
  ['telegram', 'Telegram bot token'],
  ['webhook', 'Webhook URL'],
  ['custom', 'Other…'],
] as const;

interface AiPreset {
  id: string;
  label: string;
  provider: 'ai.anthropic' | 'ai.openai' | 'ai.openai-compatible';
  baseUrl?: string;
  model: string;
  noKey?: boolean;
}

// Base URLs of the OpenAI-compatible endpoints each vendor documents.
// Model fields are only placeholders: the user picks what their account has.
const AI_PRESETS: AiPreset[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    provider: 'ai.anthropic',
    model: 'claude-opus-5-5',
  },
  { id: 'openai', label: 'OpenAI', provider: 'ai.openai', model: 'gpt-4o' },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    provider: 'ai.openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-opus-5-5',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    provider: 'ai.openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-pro',
  },
  {
    id: 'groq',
    label: 'Groq',
    provider: 'ai.openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    provider: 'ai.openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-large-latest',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    provider: 'ai.openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    provider: 'ai.openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-4',
  },
  {
    id: 'ollama',
    label: 'Ollama (self-hosted)',
    provider: 'ai.openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.1',
    noKey: true,
  },
  {
    id: 'custom',
    label: 'Other OpenAI-compatible',
    provider: 'ai.openai-compatible',
    baseUrl: '',
    model: '',
  },
];

const TEXT = {
  en: {
    add: 'Add credential',
    addAi: 'Add AI provider',
    kind: 'Type',
    customKind: 'Provider id',
    customHint: 'lowercase, e.g. pagerduty-eu',
    name: 'Name',
    nameHint: 'Shown in the step picker, e.g. "Prod Slack"',
    secret: 'Secret',
    apiKey: 'API key',
    noKeyHint: 'Ollama ignores the key; type anything.',
    baseUrl: 'Base URL',
    model: 'Default model',
    modelHint: 'Steps can override it.',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Saved. Steps can now pick it as a credential.',
    vaultNote: 'Encrypted at rest; steps only ever see a reference.',
  },
  es: {
    add: 'Agregar credencial',
    addAi: 'Agregar proveedor de IA',
    kind: 'Tipo',
    customKind: 'Id del proveedor',
    customHint: 'minúsculas, ej. pagerduty-eu',
    name: 'Nombre',
    nameHint: 'Se ve en el selector de pasos, ej. "Slack prod"',
    secret: 'Secreto',
    apiKey: 'API key',
    noKeyHint: 'Ollama ignora la key; escribí cualquier cosa.',
    baseUrl: 'URL base',
    model: 'Modelo por defecto',
    modelHint: 'Cada paso puede cambiarlo.',
    save: 'Guardar',
    cancel: 'Cancelar',
    saved: 'Guardado. Los pasos ya pueden elegirlo como credencial.',
    vaultNote: 'Se guarda encriptado; los pasos solo ven una referencia.',
  },
} as const;

interface Props {
  lang: 'en' | 'es';
  onSaved: () => void;
}

export default function AddCredentialForm({ lang, onSaved }: Props) {
  const t = TEXT[lang] ?? TEXT.en;
  const [mode, setMode] = useState<Mode | null>(null);
  const [kind, setKind] = useState<string>(CREDENTIAL_KINDS[0][0]);
  const [customKind, setCustomKind] = useState('');
  const [presetId, setPresetId] = useState(AI_PRESETS[0].id);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const preset = AI_PRESETS.find(p => p.id === presetId) ?? AI_PRESETS[0];

  const open = (next: Mode) => {
    setMode(next);
    setMessage(null);
    setName('');
    setSecret('');
    setModel('');
    setBaseUrl(next === 'ai' ? (AI_PRESETS[0].baseUrl ?? '') : '');
  };

  const pickPreset = (id: string) => {
    setPresetId(id);
    setBaseUrl(AI_PRESETS.find(p => p.id === id)?.baseUrl ?? '');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const provider = mode === 'ai' ? preset.provider : kind === 'custom' ? customKind.trim() : kind;
    const metadata =
      mode === 'ai'
        ? {
            preset: preset.id,
            ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
            ...(model.trim() ? { defaultModel: model.trim() } : {}),
          }
        : {};
    try {
      const token = csrfToken();
      const res = await fetch(`${API_BASE}/api/connected-accounts`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-CSRF-Token': token } : {}),
        },
        body: JSON.stringify({ provider, displayName: name.trim() || undefined, secret, metadata }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setMessage({ ok: true, text: t.saved });
      setMode(null);
      onSaved();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const input =
    'w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none';
  const label = 'mb-1 block text-[11px] font-medium text-[var(--text-muted)]';
  const button =
    'flex items-center gap-2 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--accent-color)] disabled:opacity-50';

  return (
    <div className="space-y-2">
      {mode === null && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={() => open('credential')}>
            <KeyRound size={14} />
            {t.add}
          </button>
          <button type="button" className={button} onClick={() => open('ai')}>
            <Sparkles size={14} />
            {t.addAi}
          </button>
        </div>
      )}

      {message && (
        <div
          className={`text-xs ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}
          role="status"
        >
          {message.text}
        </div>
      )}

      {mode !== null && (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-md border border-[var(--panel-border)] p-3"
          aria-label={mode === 'ai' ? t.addAi : t.add}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {mode === 'ai' ? t.addAi : t.add}
            </span>
            <button
              type="button"
              aria-label={t.cancel}
              onClick={() => setMode(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="cred-kind">
                {t.kind}
              </label>
              {mode === 'ai' ? (
                <select
                  id="cred-kind"
                  className={input}
                  value={presetId}
                  onChange={e => pickPreset(e.target.value)}
                >
                  {AI_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  id="cred-kind"
                  className={input}
                  value={kind}
                  onChange={e => setKind(e.target.value)}
                >
                  {CREDENTIAL_KINDS.map(([id, text]) => (
                    <option key={id} value={id}>
                      {text}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {mode === 'credential' && kind === 'custom' && (
              <div>
                <label className={label} htmlFor="cred-custom">
                  {t.customKind}
                </label>
                <input
                  id="cred-custom"
                  className={input}
                  value={customKind}
                  onChange={e => setCustomKind(e.target.value.toLowerCase())}
                  placeholder={t.customHint}
                  pattern="[a-z0-9][a-z0-9._\-]{0,48}"
                  required
                />
              </div>
            )}
            <div>
              <label className={label} htmlFor="cred-name">
                {t.name}
              </label>
              <input
                id="cred-name"
                className={input}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t.nameHint}
                maxLength={120}
              />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="cred-secret">
              {mode === 'ai' ? t.apiKey : t.secret}
            </label>
            {mode === 'credential' && (kind === 'ssh' || kind === 'custom') ? (
              <textarea
                id="cred-secret"
                className={`${input} font-mono`}
                rows={4}
                value={secret}
                onChange={e => setSecret(e.target.value)}
                required
                autoComplete="off"
                spellCheck={false}
              />
            ) : (
              <input
                id="cred-secret"
                type="password"
                className={`${input} font-mono`}
                value={secret}
                onChange={e => setSecret(e.target.value)}
                required
                autoComplete="new-password"
              />
            )}
            {mode === 'ai' && preset.noKey && (
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">{t.noKeyHint}</p>
            )}
          </div>

          {mode === 'ai' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {preset.provider === 'ai.openai-compatible' && (
                <div>
                  <label className={label} htmlFor="cred-base">
                    {t.baseUrl}
                  </label>
                  <input
                    id="cred-base"
                    className={`${input} font-mono`}
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                    placeholder="https://…/v1"
                    required
                  />
                </div>
              )}
              <div>
                <label className={label} htmlFor="cred-model">
                  {t.model}
                </label>
                <input
                  id="cred-model"
                  className={`${input} font-mono`}
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder={preset.model}
                  required={preset.provider !== 'ai.anthropic'}
                />
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">{t.modelHint}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--text-muted)]">{t.vaultNote}</span>
            <button type="submit" disabled={saving} className={button}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t.save}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
