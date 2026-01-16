'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { LogEntry } from '../../../hooks/useExecutionSocket';

interface LogTerminalProps {
    logs?: LogEntry[];
    isActive?: boolean;
}

export default function LogTerminal({ logs = [], isActive = false }: LogTerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const lastLogCountRef = useRef(0);

    useEffect(() => {
        if (!terminalRef.current || xtermRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0f172a', // slate-900
                foreground: '#cbd5e1', // slate-300
                cursor: '#3b82f6',     // blue-500
            },
            fontSize: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            convertEol: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        term.writeln('\x1b[1;34m[*] NanoFlow Terminal Initialized...\x1b[0m');

        return () => {
            // Only dispose if actually initialized
            if (xtermRef.current) {
                // xtermRef.current.dispose();
            }
        };
    }, []);

    useEffect(() => {
        if (xtermRef.current && logs.length > lastLogCountRef.current) {
            const newLogs = logs.slice(lastLogCountRef.current);
            newLogs.forEach(log => {
                const timestamp = new Date(log.timestamp).toLocaleTimeString();
                const prefix = `\x1b[1;30m[${timestamp}]\x1b[0m `;
                xtermRef.current?.writeln(`${prefix}${log.message}`);
            });
            lastLogCountRef.current = logs.length;
        }
    }, [logs]);

    useEffect(() => {
        const handleResize = () => {
            fitAddonRef.current?.fit();
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="w-full h-full rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shadow-inner">
            <div ref={terminalRef} className="w-full h-full p-2" />
        </div>
    );
}
