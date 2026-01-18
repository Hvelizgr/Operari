'use client';

import { CredentialsManager } from '@/components/Credentials/CredentialsManager';
import { Key } from 'lucide-react';

export default function CredentialsPage() {
    return (
        <div className="p-6 h-full flex flex-col">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white/90">
                <Key className="text-blue-500" /> Credentials Management
            </h1>
            <div className="flex-1 min-h-0 bg-default-50/10 rounded-xl p-1">
                <CredentialsManager />
            </div>
        </div>
    );
}
