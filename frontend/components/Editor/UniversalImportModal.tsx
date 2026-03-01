'use client';

import { useState, useRef } from 'react';
import { X, Upload, Download, FileJson, AlertCircle, Check, Loader2, Info } from 'lucide-react';
import { apiFetch } from '../../utils/api';

interface UniversalImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (nodes: any[], connections: any) => void;
    lang: 'en' | 'es';
}

const translations = {
    en: {
        title: 'Universal Import',
        subtitle: 'Import workflows from Zapier, Make (Integromat), or n8n files',
        dropzone: 'Click or drag JSON file to import',
        importing: 'Analyzing and transforming...',
        success: 'Import successful!',
        error: 'Transformation failed. Ensure the JSON format is correct.',
        invalidFile: 'Invalid JSON file.',
        zapier: 'Zapier Zap',
        make: 'Make Blueprint',
        n8n: 'n8n Workflow',
        selectType: 'Detected Format:',
        cancel: 'Cancel',
        import: 'Confirm Import',
        tip: 'NanoFlow will try to map external modules to the best compatible native nodes.',
    },
    es: {
        title: 'Importación Universal',
        subtitle: 'Importa flujos desde archivos de Zapier, Make (Integromat) o n8n',
        dropzone: 'Haz clic o arrastra un archivo JSON para importar',
        importing: 'Analizando y transformando...',
        success: '¡Importación exitosa!',
        error: 'Error en la transformación. Asegúrate de que el JSON sea correcto.',
        invalidFile: 'Archivo JSON inválido.',
        zapier: 'Zap de Zapier',
        make: 'Blueprint de Make',
        n8n: 'Workflow de n8n',
        selectType: 'Formato Detectado:',
        cancel: 'Cancelar',
        import: 'Confirmar Importación',
        tip: 'NanoFlow intentará mapear los módulos externos a los mejores nodos nativos compatibles.',
    },
};

export default function UniversalImportModal({ isOpen, onClose, onImport, lang }: UniversalImportModalProps) {
    const t = translations[lang];
    const [file, setFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState<any>(null);
    const [detectedType, setDetectedType] = useState<'zapier' | 'make' | 'n8n' | null>(null);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            processFile(selectedFile);
        }
    };

    const processFile = (selectedFile: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                setFile(selectedFile);
                setFileContent(json);
                setError(null);

                // Detect format
                if (json.steps && Array.isArray(json.steps)) {
                    setDetectedType('zapier');
                } else if (json.flow && Array.isArray(json.flow)) {
                    setDetectedType('make');
                } else if (json.nodes && Array.isArray(json.nodes)) {
                    setDetectedType('n8n');
                } else {
                    setDetectedType(null);
                    setError(t.invalidFile);
                }
            } catch (err) {
                setError(t.invalidFile);
            }
        };
        reader.readAsText(selectedFile);
    };

    const handleImport = async () => {
        if (!fileContent || !detectedType) return;

        setImporting(true);
        setError(null);

        try {
            let endpoint = '';
            if (detectedType === 'zapier') endpoint = '/api/import/zapier';
            else if (detectedType === 'make') endpoint = '/api/import/make';
            else {
                // n8n direct handling
                onImport(fileContent.nodes || [], fileContent.connections || {});
                finishSuccess();
                return;
            }

            const response = await apiFetch(endpoint, {
                method: 'POST',
                body: JSON.stringify(fileContent),
            });

            if (response.ok) {
                const result = await response.json();
                onImport(result.data.nodes, result.data.connections);
                finishSuccess();
            } else {
                setError(t.error);
            }
        } catch (err) {
            setError(t.error);
        } finally {
            setImporting(false);
        }
    };

    const finishSuccess = () => {
        setSuccess(true);
        setTimeout(() => {
            onClose();
            // Reset for next time
            setFile(null);
            setFileContent(null);
            setDetectedType(null);
            setSuccess(false);
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#09090b] rounded-2xl shadow-2xl w-full max-w-lg border border-white/10 overflow-hidden ring-1 ring-white/5">
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Download className="w-5 h-5 text-blue-500" />
                            {t.title}
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">{t.subtitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {!file ? (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                const droppedFile = e.dataTransfer.files[0];
                                if (droppedFile) processFile(droppedFile);
                            }}
                            className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group"
                        >
                            <Upload className="w-10 h-10 text-gray-500 group-hover:text-blue-500 mx-auto mb-4 transition-colors" />
                            <p className="text-gray-400 group-hover:text-gray-200">{t.dropzone}</p>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                accept=".json" 
                                className="hidden" 
                            />
                        </div>
                    ) : (
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 rounded-lg">
                                        <FileJson className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white truncate max-w-[200px]">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setFile(null); setDetectedType(null); }}
                                    className="text-xs text-gray-500 hover:text-white"
                                >
                                    {t.cancel}
                                </button>
                            </div>

                            {detectedType && (
                                <div className="flex items-center gap-2 text-sm text-gray-300 bg-white/5 p-2 rounded-lg">
                                    <span className="text-gray-500">{t.selectType}</span>
                                    <span className="font-bold text-blue-400">
                                        {detectedType === 'zapier' ? t.zapier : detectedType === 'make' ? t.make : t.n8n}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg text-gray-400 text-xs italic">
                        <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                        <span>{t.tip}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        {success && (
                            <div className="flex items-center gap-2 text-green-400 text-sm font-medium animate-in fade-in slide-in-from-left-2">
                                <Check size={16} />
                                {t.success}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                        >
                            {t.cancel}
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!detectedType || importing || success}
                            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-600/20"
                        >
                            {importing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {t.importing}
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    {t.import}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
