'use client';

import { Loader2, Package, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { type FileRejection, useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

import { useAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Tenant-scoped plugin install panel.
 *
 * Backend status (per `pendiente.md` 🟠): the install endpoint
 * (`POST /api/tenants/plugins/install`, multipart tarball) is not yet
 * shipped. The runtime layout (`OPERARI_PLUGINS_DIR/tenants/<id>/<slug>/`)
 * + tenant-scoped registry are already in place per ADR 0006. This
 * panel ships the front-end so when the endpoint lands the wiring is
 * one fetch swap. Today the upload POST returns 501 and we surface a
 * descriptive toast — admins see the affordance, the file gets
 * validated client-side, and the contract is documented.
 *
 * Validation we do client-side (cheap + immediate feedback):
 *   - File extension `.tar.gz` / `.tgz`
 *   - Max size 10MB (a plugin tarball is typically <500KB)
 *   - Single file at a time (no batch install)
 *
 * Validation deferred to backend (signature verification, manifest
 * schema, hot-reload safety): unenforceable from the browser anyway.
 */

interface PluginRow {
  /** Slug from the plugin's `operari.json`. */
  slug: string;
  /** Human-readable name from the manifest. */
  name: string;
  /** Semver version string. */
  version: string;
  /** ISO timestamp when the tenant installed it. */
  installedAt: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

interface PluginsPanelProps {
  lang: 'en' | 'es';
}

export default function PluginsPanel({ lang }: PluginsPanelProps) {
  const { session } = useAuth();
  const isAdmin = session?.user.role === 'ADMIN';

  const [plugins, setPlugins] = useState<PluginRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingSlug, setRemovingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t =
    lang === 'es'
      ? {
          title: 'Plugins instalados',
          hint: 'Subí un tarball (.tar.gz) con un plugin custom para este workspace. El tarball debe tener un `operari.json` válido en la raíz.',
          empty: 'Sin plugins instalados todavía.',
          drop: 'Arrastrá un .tar.gz o hacé click para seleccionar',
          dropActive: 'Soltá el archivo para subir',
          uploading: 'Subiendo…',
          remove: 'Quitar',
          removing: 'Quitando…',
          confirmRemove:
            '¿Desinstalar este plugin? Los runbooks que usan sus step types fallarán en la próxima corrida.',
          installed: 'Plugin instalado',
          removed: 'Plugin quitado',
          notAdmin: 'Solo los admins del tenant pueden instalar plugins.',
          rejectedExt: 'El archivo debe ser .tar.gz o .tgz',
          rejectedSize: 'El archivo no puede superar los 10MB',
          uploadFailed: 'No se pudo subir el plugin',
          loadFailed: 'No se pudieron cargar los plugins',
          notImplemented:
            'El endpoint de instalación todavía no está disponible (item 🟠 pendiente).',
        }
      : {
          title: 'Installed plugins',
          hint: 'Upload a tarball (.tar.gz) containing a custom plugin for this workspace. The tarball must have a valid `operari.json` at the root.',
          empty: 'No plugins installed yet.',
          drop: 'Drag a .tar.gz here or click to choose a file',
          dropActive: 'Drop to upload',
          uploading: 'Uploading…',
          remove: 'Remove',
          removing: 'Removing…',
          confirmRemove:
            'Uninstall this plugin? Runbooks that use its step types will fail on the next run.',
          installed: 'Plugin installed',
          removed: 'Plugin removed',
          notAdmin: 'Only tenant admins can install plugins.',
          rejectedExt: 'File must be .tar.gz or .tgz',
          rejectedSize: 'File cannot exceed 10MB',
          uploadFailed: 'Could not upload the plugin',
          loadFailed: 'Could not load plugins',
          notImplemented: 'The install endpoint is not yet available (🟠 pending item).',
        };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/tenants/plugins`, { credentials: 'include' });
      if (res.status === 404 || res.status === 501) {
        // Endpoint not yet implemented — render an empty list so the
        // panel still demonstrates the upload UX without throwing.
        setPlugins([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data?: PluginRow[] };
      setPlugins(body.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    if (!isAdmin) return;
    void refresh();
  }, [isAdmin, refresh]);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append('plugin', file);
        const res = await fetch(`${API_BASE}/api/tenants/plugins/install`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        if (res.status === 501 || res.status === 404) {
          // Endpoint stub — surface a clear message instead of a
          // generic failure so the admin knows it's not their fault.
          toast.message(t.notImplemented);
          return;
        }
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(body || `HTTP ${res.status}`);
        }
        toast.success(t.installed);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : t.uploadFailed;
        setError(message);
        toast.error(`${t.uploadFailed}: ${message.slice(0, 80)}`);
      } finally {
        setUploading(false);
      }
    },
    [refresh, t.installed, t.notImplemented, t.uploadFailed]
  );

  const handleDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        const reason = rejections[0]?.errors[0]?.code;
        if (reason === 'file-too-large') toast.error(t.rejectedSize);
        else toast.error(t.rejectedExt);
        return;
      }
      const file = accepted[0];
      if (!file) return;
      void upload(file);
    },
    [upload, t.rejectedExt, t.rejectedSize]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleDrop,
    multiple: false,
    maxSize: MAX_BYTES,
    // react-dropzone validates by MIME type by default which is
    // unreliable for tarballs (browsers report 'application/x-gzip',
    // 'application/gzip', or empty). We validate by extension via
    // the `validator` prop instead so the operator sees the same
    // result regardless of browser quirks.
    validator: file => {
      const name = file.name.toLowerCase();
      if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) return null;
      return { code: 'file-invalid-type', message: 'Must be .tar.gz or .tgz' };
    },
    disabled: !isAdmin || uploading,
  });

  const handleRemove = useCallback(
    async (slug: string) => {
      if (typeof window !== 'undefined' && !window.confirm(t.confirmRemove)) return;
      setRemovingSlug(slug);
      try {
        const res = await fetch(`${API_BASE}/api/tenants/plugins/${encodeURIComponent(slug)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.status === 501 || res.status === 404) {
          toast.message(t.notImplemented);
          return;
        }
        if (!res.ok && res.status !== 204) {
          throw new Error(`HTTP ${res.status}`);
        }
        toast.success(t.removed);
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error';
        toast.error(message);
      } finally {
        setRemovingSlug(null);
      }
    },
    [refresh, t.confirmRemove, t.notImplemented, t.removed]
  );

  if (!isAdmin) {
    return <p className="text-[11px] text-[var(--text-muted)]">{t.notAdmin}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--text-muted)]">{t.hint}</p>

      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          isDragActive
            ? 'bg-[var(--accent-color)]/5 border-[var(--accent-color)]'
            : 'hover:border-[var(--accent-color)]/60 border-[var(--panel-border)]'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
        ) : (
          <Upload size={20} className="text-[var(--text-muted)]" />
        )}
        <span className="text-sm text-[var(--text-primary)]">
          {uploading ? t.uploading : isDragActive ? t.dropActive : t.drop}
        </span>
        {!uploading && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              open();
            }}
            className="text-[11px] text-[var(--accent-color)] underline-offset-2 hover:underline"
          >
            {lang === 'es' ? 'Elegir archivo' : 'Choose file'}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-300">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && plugins === null ? (
        <div className="text-xs text-[var(--text-muted)]">…</div>
      ) : plugins && plugins.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)]">{t.empty}</div>
      ) : plugins ? (
        <ul className="divide-y divide-[var(--panel-border)] rounded-md border border-[var(--panel-border)]">
          {plugins.map(p => (
            <li key={p.slug} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <Package size={14} className="shrink-0 text-[var(--text-muted)]" />
                <div className="min-w-0">
                  <div className="truncate text-[var(--text-primary)]">{p.name}</div>
                  <div className="truncate font-mono text-[10px] text-[var(--text-muted)]">
                    {p.slug} · v{p.version}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(p.slug)}
                disabled={removingSlug === p.slug}
                className="flex shrink-0 items-center gap-1 rounded border border-rose-500/40 px-2 py-1 text-[11px] text-rose-300 transition-colors hover:border-rose-400 hover:text-rose-200 disabled:opacity-50"
              >
                {removingSlug === p.slug ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Trash2 size={11} />
                )}
                {removingSlug === p.slug ? t.removing : t.remove}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
