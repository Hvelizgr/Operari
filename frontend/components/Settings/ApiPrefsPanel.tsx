'use client';

import { Cookie, Eye, FileJson, History, Send, Shield, Timer } from 'lucide-react';

import { type HttpMethod, useApiPrefs } from '@/lib/userPrefs';

import { NumberSlider, Pills, TextInput, Toggle } from './userPrefsPrimitives';

const STRINGS = {
  en: {
    title: 'API tester',
    subtitle: 'Defaults applied to every request you fire from /http-tester.',
    timeoutLabel: 'Default request timeout',
    timeoutHint: 'Cancel a request that runs longer than this. Per-request override still wins.',
    prettyJsonLabel: 'Pretty-print JSON responses',
    prettyJsonHint: 'Indent JSON bodies. Off = raw single-line text.',
    showHeadersLabel: 'Show response headers',
    showHeadersHint: 'Open the Headers tab automatically when a response arrives.',
    historyCapLabel: 'Request history retention',
    historyCapHint: 'How many past requests to keep in the local history sidebar.',
    methodLabel: 'Default HTTP method',
    methodHint: 'Method selected when you open the tester.',
    contentTypeLabel: 'Default Content-Type',
    contentTypeHint: 'Auto-populated on requests with a body.',
    acceptLabel: 'Default Accept header',
    acceptHint: 'Auto-populated on every request.',
    cookiesLabel: 'Persist cookies between requests',
    cookiesHint:
      'Cookie jar that survives across calls (like Postman). Off = each request is fresh.',
    redirectsLabel: 'Follow redirects',
    redirectsHint: 'When off, 3xx responses are returned as-is and not chased.',
    selfSignedLabel: 'Allow self-signed certs',
    selfSignedHint:
      'Browser-side this is up to your OS trust store. The flag is read by backend-driven calls only.',
    on: 'On',
    off: 'Off',
  },
  es: {
    title: 'Probador de API',
    subtitle: 'Defaults aplicados a cada request que disparás desde /http-tester.',
    timeoutLabel: 'Timeout por defecto',
    timeoutHint: 'Cancela el request si tarda más de esto. Override por-request siempre gana.',
    prettyJsonLabel: 'Formatear respuestas JSON',
    prettyJsonHint: 'Indenta los bodies JSON. Apagado = texto crudo en una línea.',
    showHeadersLabel: 'Mostrar headers de respuesta',
    showHeadersHint: 'Abre el tab Headers automáticamente al recibir una respuesta.',
    historyCapLabel: 'Tamaño del historial',
    historyCapHint: 'Cuántos requests anteriores guarda la barra lateral.',
    methodLabel: 'Método HTTP por defecto',
    methodHint: 'Método seleccionado al abrir el tester.',
    contentTypeLabel: 'Content-Type por defecto',
    contentTypeHint: 'Auto-poblado en requests con body.',
    acceptLabel: 'Accept header por defecto',
    acceptHint: 'Auto-poblado en cada request.',
    cookiesLabel: 'Persistir cookies entre requests',
    cookiesHint:
      'Cookie jar que sobrevive entre llamadas (como Postman). Apagado = cada request es fresco.',
    redirectsLabel: 'Seguir redirects',
    redirectsHint: 'Apagado: las respuestas 3xx vuelven sin seguirse.',
    selfSignedLabel: 'Aceptar certificados self-signed',
    selfSignedHint:
      'En el browser lo decide tu trust store del sistema. El flag lo lee el backend cuando hace el call.',
    on: 'Encendido',
    off: 'Apagado',
  },
} as const;

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

export default function ApiPrefsPanel({ lang }: { lang: 'en' | 'es' }) {
  const t = STRINGS[lang];
  const [prefs, setPrefs] = useApiPrefs();

  return (
    <section className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <header className="mb-3 flex items-center gap-2">
        <Send size={16} className="text-emerald-400" />
        <h2 className="text-sm font-semibold">{t.title}</h2>
      </header>
      <p className="mb-4 text-xs text-[var(--text-muted)]">{t.subtitle}</p>

      <div className="space-y-3">
        <NumberSlider
          icon={<Timer size={12} />}
          label={t.timeoutLabel}
          hint={t.timeoutHint}
          value={prefs.defaultTimeoutMs}
          min={1000}
          max={120_000}
          step={1000}
          format={n => `${(n / 1000).toFixed(0)}s`}
          onChange={n => setPrefs({ defaultTimeoutMs: n })}
        />
        <Toggle
          icon={<FileJson size={12} />}
          label={t.prettyJsonLabel}
          hint={t.prettyJsonHint}
          value={prefs.prettyPrintJson}
          onChange={v => setPrefs({ prettyPrintJson: v })}
          on={t.on}
          off={t.off}
        />
        <Toggle
          icon={<Eye size={12} />}
          label={t.showHeadersLabel}
          hint={t.showHeadersHint}
          value={prefs.showResponseHeaders}
          onChange={v => setPrefs({ showResponseHeaders: v })}
          on={t.on}
          off={t.off}
        />
        <NumberSlider
          icon={<History size={12} />}
          label={t.historyCapLabel}
          hint={t.historyCapHint}
          value={prefs.historyCap}
          min={10}
          max={500}
          step={10}
          onChange={n => setPrefs({ historyCap: n })}
        />
        <Pills
          icon={<Send size={12} />}
          label={t.methodLabel}
          hint={t.methodHint}
          value={prefs.defaultMethod}
          options={HTTP_METHODS.map(m => ({ id: m, label: m }))}
          onChange={v => setPrefs({ defaultMethod: v })}
        />
        <TextInput
          label={t.contentTypeLabel}
          hint={t.contentTypeHint}
          value={prefs.defaultContentType}
          placeholder="application/json"
          onChange={v => setPrefs({ defaultContentType: v })}
        />
        <TextInput
          label={t.acceptLabel}
          hint={t.acceptHint}
          value={prefs.defaultAcceptHeader}
          placeholder="application/json"
          onChange={v => setPrefs({ defaultAcceptHeader: v })}
        />
        <Toggle
          icon={<Cookie size={12} />}
          label={t.cookiesLabel}
          hint={t.cookiesHint}
          value={prefs.preserveCookies}
          onChange={v => setPrefs({ preserveCookies: v })}
          on={t.on}
          off={t.off}
        />
        <Toggle
          icon={<Send size={12} />}
          label={t.redirectsLabel}
          hint={t.redirectsHint}
          value={prefs.followRedirects}
          onChange={v => setPrefs({ followRedirects: v })}
          on={t.on}
          off={t.off}
        />
        <Toggle
          icon={<Shield size={12} />}
          label={t.selfSignedLabel}
          hint={t.selfSignedHint}
          value={prefs.allowSelfSignedCerts}
          onChange={v => setPrefs({ allowSelfSignedCerts: v })}
          on={t.on}
          off={t.off}
        />
      </div>
    </section>
  );
}
