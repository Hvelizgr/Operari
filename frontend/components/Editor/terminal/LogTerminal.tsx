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
                background: '#09090b', // zinc-950/black
                foreground: '#cbd5e1', // slate-300
                cursor: '#a855f7',     // purple-500
                selectionBackground: 'rgba(168, 85, 247, 0.3)',
                black: '#09090b',
                red: '#ef4444',
                green: '#22c55e',
                yellow: '#eab308',
                blue: '#3b82f6',
                magenta: '#a855f7',
                cyan: '#06b6d4',
                white: '#f8fafc',
            },
            fontSize: 13,
            lineHeight: 1.4,
            fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
            convertEol: true,
            rows: 20
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
        <div className="w-full h-full rounded-b-xl overflow-hidden border-t-0 border border-white/5 bg-[#09090b]">
            <div ref={terminalRef} className="w-full h-full p-2 custom-scrollbar" />
        </div>
    );
}
