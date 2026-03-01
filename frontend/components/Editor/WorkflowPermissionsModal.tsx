'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Trash2, Loader2, Search, User } from 'lucide-react';

interface WorkflowPermission {
    id: string;
    workflowId: string;
    userId: string;
    level: 'READ' | 'WRITE' | 'ADMIN';
    user: {
        id: string;
        name: string | null;
        email: string;
    };
}

interface WorkflowPermissionsModalProps {
    lang: 'en' | 'es';
    workflowId: string;
    onClose: () => void;
}

export default function WorkflowPermissionsModal({
    lang,
    workflowId,
    onClose
}: WorkflowPermissionsModalProps) {
    const [permissions, setPermissions] = useState<WorkflowPermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newLevel, setNewLevel] = useState<'READ' | 'WRITE' | 'ADMIN'>('READ');
    const [error, setError] = useState<string | null>(null);

    const t = {
        title: lang === 'en' ? 'Workflow Permissions' : 'Permisos del Flujo',
        subtitle: lang === 'en' ? 'Manage who can view and edit this workflow.' : 'Gestiona quién puede ver y editar este flujo.',
        user: lang === 'en' ? 'User' : 'Usuario',
        access: lang === 'en' ? 'Access Level' : 'Nivel de Acceso',
        actions: lang === 'en' ? 'Actions' : 'Acciones',
        add: lang === 'en' ? 'Add User' : 'Añadir Usuario',
        emailPlaceholder: lang === 'en' ? 'Enter user email...' : 'Introduce el email del usuario...',
        save: lang === 'en' ? 'Save' : 'Guardar',
        remove: lang === 'en' ? 'Remove' : 'Eliminar',
        levels: {
            READ: lang === 'en' ? 'Read' : 'Lectura',
            WRITE: lang === 'en' ? 'Write' : 'Escritura',
            ADMIN: lang === 'en' ? 'Admin' : 'Administrador'
        }
    };

    useEffect(() => {
        fetchPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workflowId]);

    const fetchPermissions = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workflows/${workflowId}/permissions`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setPermissions(data);
            }
        } catch (err) {
            console.error('Failed to fetch permissions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPermission = async () => {
        if (!newUserEmail) return;
        try {
            setAdding(true);
            setError(null);
            
            // First find user by email (this would need an endpoint, assuming we have one or adding logic to handle email in backend)
            // For now, the backend expects userId. In a real app, we'd search users.
            // Let's assume we have a search endpoint or we can just send email to backend.
            
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workflows/${workflowId}/permissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ email: newUserEmail, level: newLevel }) // Backend will need to resolve email to userId
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to add permission');
            }

            setNewUserEmail('');
            fetchPermissions();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setAdding(false);
        }
    };

    const handleRemovePermission = async (userId: string) => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workflows/${workflowId}/permissions/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok) {
                fetchPermissions();
            }
        } catch (err) {
            console.error('Failed to remove permission:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#09090b] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Shield className="text-blue-500" size={24} />
                            {t.title}
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">{t.subtitle}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Add User Section */}
                    <div className="flex flex-wrap gap-3 mb-8 bg-white/5 p-4 rounded-xl border border-white/10">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <input 
                                type="email"
                                value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)}
                                placeholder={t.emailPlaceholder}
                                className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <select 
                            value={newLevel}
                            onChange={(e) => setNewLevel(e.target.value as any)}
                            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value="READ">{t.levels.READ}</option>
                            <option value="WRITE">{t.levels.WRITE}</option>
                            <option value="ADMIN">{t.levels.ADMIN}</option>
                        </select>
                        <button 
                            onClick={handleAddPermission}
                            disabled={adding || !newUserEmail}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        >
                            {adding ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                            {t.add}
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Permissions List */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
                                <Loader2 className="animate-spin" size={32} />
                                <span className="text-sm">Loading permissions...</span>
                            </div>
                        ) : permissions.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 italic text-sm">
                                No permissions defined yet.
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="pb-3 px-2">{t.user}</th>
                                        <th className="pb-3 px-2">{t.access}</th>
                                        <th className="pb-3 px-2 text-right">{t.actions}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {permissions.map((p) => (
                                        <tr key={p.id} className="group">
                                            <td className="py-3 px-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                                                        {p.user.name?.[0] || p.user.email[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-white">{p.user.name || 'Anonymous User'}</div>
                                                        <div className="text-xs text-gray-500">{p.user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-2">
                                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                                                    p.level === 'ADMIN' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                    p.level === 'WRITE' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                }`}>
                                                    {t.levels[p.level]}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-right">
                                                <button 
                                                    onClick={() => handleRemovePermission(p.userId)}
                                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                    title={t.remove}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-white/5 p-6 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
