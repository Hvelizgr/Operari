'use client';

import '@xterm/xterm/css/xterm.css';

import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { Circle, RotateCcw, ShieldCheck, SquareTerminal } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Status = 'connecting' | 'open' | 'closed' | 'error';

const TEXT = {
  en: {
    title: 'Terminal',
    connecting: 'Connecting…',
    open: 'Connected',
    closed: 'Session ended',
    error: 'Unavailable',
    newSession: 'New session',
    recorded: 'Sessions are recorded and audited',
    runner: { local: 'host shell', docker: 'container' } as Record<string, string>,
    ended: (reason: string, code: number | null) =>
      `Session ended (${reason}${code !== null ? `, exit ${code}` : ''}).`,
    errors: {
      unauthorized: 'Your session expired. Sign in again.',
      permission_denied: 'Your role does not include terminal access (terminal:open).',
      terminal_disabled: 'The terminal is disabled for this workspace on this server.',
      bad_origin: 'This origin is not allowed to open a terminal.',
      fallback: 'Could not reach the terminal service.',
    } as Record<string, string>,
  },
  es: {
    title: 'Terminal',
    connecting: 'Conectando…',
    open: 'Conectada',
    closed: 'Sesión terminada',
    error: 'No disponible',
    newSession: 'Nueva sesión',
    recorded: 'Las sesiones se graban y quedan en la auditoría',
    runner: { local: 'shell del host', docker: 'contenedor' } as Record<string, string>,
    ended: (reason: string, code: number | null) =>
      `Sesión terminada (${reason}${code !== null ? `, código ${code}` : ''}).`,
    errors: {
      unauthorized: 'Tu sesión expiró. Vuelve a iniciar sesión.',
      permission_denied: 'Tu rol no incluye acceso a la terminal (terminal:open).',
      terminal_disabled: 'La terminal está desactivada para este espacio en este servidor.',
      bad_origin: 'Este origen no puede abrir una terminal.',
      fallback: 'No se pudo conectar con el servicio de terminal.',
    } as Record<string, string>,
  },
};

const STATUS_COLOR: Record<Status, string> = {
  connecting: 'text-amber-400',
  open: 'text-emerald-400',
  closed: 'text-zinc-500',
  error: 'text-red-400',
};

export default function TerminalCanvas({ lang }: { lang: 'en' | 'es' }) {
  const t = TEXT[lang] ?? TEXT.en;
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [runner, setRunner] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const restart = useCallback(() => setAttempt(n => n + 1), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    setStatus('connecting');
    setRunner(null);
    setMessage(null);

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: { background: '#09090b', foreground: '#e4e4e7', cursor: '#3ecf8e' },
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();

    const socket: Socket = io(`${API_BASE}/terminal`, {
      withCredentials: true,
      transports: ['websocket'],
      reconnection: false,
    });

    socket.on('connect', () => socket.emit('open', { cols: term.cols, rows: term.rows }));
    socket.on('opened', (info: { runner: string }) => {
      setRunner(info.runner);
      setStatus('open');
      term.focus();
    });
    socket.on('output', (data: string) => term.write(data));
    socket.on('exit', (info: { exitCode: number | null; reason: string }) => {
      setStatus('closed');
      term.write(`\r\n\x1b[2m${t.ended(info.reason, info.exitCode)}\x1b[0m\r\n`);
    });
    socket.on('terminal_error', (info: { message: string }) => {
      setStatus('error');
      setMessage(info.message);
    });
    socket.on('connect_error', (err: Error & { data?: { code?: string } }) => {
      setStatus('error');
      const code = err.data?.code;
      setMessage((code && t.errors[code]) || t.errors.fallback);
    });
    socket.on('disconnect', () => setStatus(s => (s === 'open' ? 'closed' : s)));

    const input = term.onData(data => socket.emit('input', data));
    const resize = term.onResize(({ cols, rows }) => socket.emit('resize', { cols, rows }));

    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // The host can be detached mid-resize during navigation.
      }
    });
    observer.observe(host);

    return () => {
      observer.disconnect();
      input.dispose();
      resize.dispose();
      socket.emit('close');
      socket.disconnect();
      term.dispose();
    };
    // `t` only changes with `lang`, which remounts the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col bg-zinc-950 text-zinc-200">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-3 sm:px-4">
        <SquareTerminal size={16} className="text-primary/70" />
        <span className="text-sm font-semibold text-white">{t.title}</span>
        <span className={`flex items-center gap-1 text-[11px] ${STATUS_COLOR[status]}`}>
          <Circle size={8} fill="currentColor" />
          {t[status]}
        </span>
        {runner && (
          <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            {t.runner[runner] ?? runner}
          </span>
        )}
        <span className="ml-auto hidden items-center gap-1 text-[11px] text-zinc-500 sm:flex">
          <ShieldCheck size={12} />
          {t.recorded}
        </span>
        {(status === 'closed' || status === 'error') && (
          <button
            type="button"
            onClick={restart}
            className="ml-2 flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
          >
            <RotateCcw size={12} />
            {t.newSession}
          </button>
        )}
      </div>

      {message && (
        <div
          role="alert"
          className="border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-xs text-red-300"
        >
          {message}
        </div>
      )}

      <div className="min-h-0 flex-1 p-2">
        <div ref={hostRef} className="h-full w-full" data-testid="terminal-host" />
      </div>
    </div>
  );
}
