'use client';

import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { SaveStatus } from '../hooks/useAutosave';

interface SaveStatusIndicatorProps {
    saveStatus: SaveStatus;
    lang: 'en' | 'es';
}

export default function SaveStatusIndicator({ saveStatus, lang }: SaveStatusIndicatorProps) {
    const statusConfig: Record<SaveStatus, {
        icon: typeof Loader2;
        text: string;
        className: string;
        iconClassName: string;
    }> = {
        saving: {
            icon: Loader2,
            text: lang === 'en' ? 'Saving...' : 'Guardando...',
            className: 'text-blue-400',
            iconClassName: 'animate-spin'
        },
        saved: {
            icon: CheckCircle2,
            text: lang === 'en' ? 'Saved' : 'Guardado',
            className: 'text-green-400',
            iconClassName: ''
        },
        error: {
            icon: AlertCircle,
            text: lang === 'en' ? 'Error' : 'Error',
            className: 'text-red-400',
            iconClassName: ''
        },
        conflict: {
            icon: AlertCircle,
            text: lang === 'en' ? 'Conflict' : 'Conflicto',
            className: 'text-yellow-400',
            iconClassName: ''
        }
    };

    const config = statusConfig[saveStatus];
    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-700 ${config.className}`}>
            <Icon size={14} className={config.iconClassName} />
            <span className="text-xs font-medium">{config.text}</span>
        </div>
    );
}
