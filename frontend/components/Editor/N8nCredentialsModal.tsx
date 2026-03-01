'use client';

import { useState, useEffect } from 'react';
import { X, Key, Plus, Trash2, Eye, EyeOff, RefreshCw, Loader2, AlertCircle, Check, Shield } from 'lucide-react';
import { apiFetch } from '../../utils/api';

interface N8nCredential {
    id: string;
    name: string;
    type: string;
    createdAt?: string;
    updatedAt?: string;
}

interface N8nCredentialsModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: 'en' | 'es';
}

const translations = {
    en: {
        title: 'n8n Credentials',
        subtitle: 'Manage credentials for your n8n integrations',
        search: 'Search credentials...',
        refresh: 'Refresh',
        loading: 'Loading credentials...',
        noCredentials: 'No credentials found',
        addNew: 'Add New Credential',
        delete: 'Delete',
        type: 'Type',
        name: 'Name',
        created: 'Created',
        actions: 'Actions',
        close: 'Close',
        confirmDelete: 'Are you sure you want to delete this credential?',
        deleteSuccess: 'Credential deleted successfully',
        deleteError: 'Failed to delete credential',
        connectionError: 'Could not connect to n8n',
        credentialTypes: 'Credential Types',
        selectType: 'Select credential type...',
        credentialName: 'Credential Name',
        createCredential: 'Create Credential',
        creating: 'Creating...',
        createSuccess: 'Credential created successfully!',
        createError: 'Failed to create credential',
        cancel: 'Cancel',
    },
    es: {
        title: 'Credenciales n8n',
        subtitle: 'Administra las credenciales para tus integraciones de n8n',
        search: 'Buscar credenciales...',
        refresh: 'Actualizar',
        loading: 'Cargando credenciales...',
        noCredentials: 'No se encontraron credenciales',
        addNew: 'Agregar Nueva Credencial',
        delete: 'Eliminar',
        type: 'Tipo',
        name: 'Nombre',
        created: 'Creado',
        actions: 'Acciones',
        close: 'Cerrar',
        confirmDelete: '¿Estás seguro de que quieres eliminar esta credencial?',
        deleteSuccess: 'Credencial eliminada exitosamente',
        deleteError: 'Error al eliminar credencial',
        connectionError: 'No se pudo conectar a n8n',
        credentialTypes: 'Tipos de Credencial',
        selectType: 'Seleccionar tipo de credencial...',
        credentialName: 'Nombre de Credencial',
        createCredential: 'Crear Credencial',
        creating: 'Creando...',
        createSuccess: '¡Credencial creada exitosamente!',
        createError: 'Error al crear credencial',
        cancel: 'Cancelar',
    },
};

const commonCredentialTypes = [
    { type: 'slackApi', label: 'Slack API' },
    { type: 'discordApi', label: 'Discord API' },
    { type: 'telegramApi', label: 'Telegram API' },
    { type: 'openAiApi', label: 'OpenAI API' },
    { type: 'anthropicApi', label: 'Anthropic API' },
    { type: 'googleApi', label: 'Google API' },
    { type: 'githubApi', label: 'GitHub API' },
    { type: 'notionApi', label: 'Notion API' },
    { type: 'airtableApi', label: 'Airtable API' },
    { type: 'stripeApi', label: 'Stripe API' },
    { type: 'twilioApi', label: 'Twilio API' },
    { type: 'sendGridApi', label: 'SendGrid API' },
    { type: 'mailchimpApi', label: 'Mailchimp API' },
    { type: 'postgresApi', label: 'PostgreSQL' },
    { type: 'mysqlApi', label: 'MySQL' },
    { type: 'mongoDbApi', label: 'MongoDB' },
    { type: 'redisApi', label: 'Redis' },
    { type: 'httpBasicAuth', label: 'HTTP Basic Auth' },
    { type: 'httpHeaderAuth', label: 'HTTP Header Auth' },
    { type: 'oAuth2Api', label: 'OAuth2 API' },
];

export default function N8nCredentialsModal({ isOpen, onClose, lang }: N8nCredentialsModalProps) {
    const t = translations[lang];
    const [credentials, setCredentials] = useState<N8nCredential[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedType, setSelectedType] = useState('');
    const [credentialName, setCredentialName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createSuccess, setCreateSuccess] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchCredentials();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const fetchCredentials = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiFetch('/api/n8n/credentials');
            if (response.ok) {
                const data = await response.json();
                setCredentials(data.data || data || []);
            } else {
                setError(t.connectionError);
            }
        } catch (err) {
            setError(t.connectionError);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!selectedType || !credentialName) return;

        setCreating(true);
        setError(null);
        try {
            const response = await apiFetch('/api/n8n/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: credentialName,
                    type: selectedType,
                    data: {},
                }),
            });

            if (response.ok) {
                setCreateSuccess(true);
                setShowCreateForm(false);
                setSelectedType('');
                setCredentialName('');
                fetchCredentials();
                setTimeout(() => setCreateSuccess(false), 3000);
            } else {
                setError(t.createError);
            }
        } catch (err) {
            setError(t.createError);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await apiFetch(`/api/n8n/credentials/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setCredentials((prev) => prev.filter((c) => c.id !== id));
                setDeleteConfirm(null);
            } else {
                setError(t.deleteError);
            }
        } catch (err) {
            setError(t.deleteError);
        }
    };

    const filteredCredentials = credentials.filter(
        (c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-700 overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Shield className="w-5 h-5 text-orange-500" />
                            {t.title}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">{t.subtitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="p-4 border-b border-slate-700 flex gap-2">
                    <div className="flex-1 relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder={t.search}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                    <button
                        onClick={fetchCredentials}
                        disabled={loading}
                        className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        {t.addNew}
                    </button>
                </div>

                {showCreateForm && (
                    <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-sm text-slate-400 mb-1">{t.credentialTypes}</label>
                                <select
                                    value={selectedType}
                                    onChange={(e) => setSelectedType(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="">{t.selectType}</option>
                                    {commonCredentialTypes.map((ct) => (
                                        <option key={ct.type} value={ct.type}>
                                            {ct.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm text-slate-400 mb-1">{t.credentialName}</label>
                                <input
                                    type="text"
                                    value={credentialName}
                                    onChange={(e) => setCredentialName(e.target.value)}
                                    placeholder="My API Key"
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <button
                                onClick={handleCreate}
                                disabled={creating || !selectedType || !credentialName}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {creating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Plus className="w-4 h-4" />
                                )}
                                {creating ? t.creating : t.createCredential}
                            </button>
                            <button
                                onClick={() => setShowCreateForm(false)}
                                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                            >
                                {t.cancel}
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mx-4 mt-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {createSuccess && (
                    <div className="mx-4 mt-4 flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
                        <Check className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{t.createSuccess}</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                            <span className="ml-3 text-slate-400">{t.loading}</span>
                        </div>
                    ) : filteredCredentials.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <Key className="w-12 h-12 text-slate-600 mb-4" />
                            <p className="text-slate-400">{t.noCredentials}</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-800/50 sticky top-0">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">{t.name}</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">{t.type}</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">{t.created}</th>
                                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">{t.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {filteredCredentials.map((cred) => (
                                    <tr key={cred.id} className="hover:bg-slate-800/30">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Key className="w-4 h-4 text-orange-500" />
                                                <span className="text-white font-medium">{cred.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                                                {cred.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-400">
                                            {cred.createdAt
                                                ? new Date(cred.createdAt).toLocaleDateString()
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {deleteConfirm === cred.id ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-sm text-slate-400">{t.confirmDelete}</span>
                                                    <button
                                                        onClick={() => handleDelete(cred.id)}
                                                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                                                    >
                                                        {t.delete}
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirm(null)}
                                                        className="px-2 py-1 bg-slate-600 text-white rounded text-xs hover:bg-slate-500"
                                                    >
                                                        {t.cancel}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setDeleteConfirm(cred.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="flex justify-end p-4 border-t border-slate-700 bg-slate-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                        {t.close}
                    </button>
                </div>
            </div>
        </div>
    );
}
