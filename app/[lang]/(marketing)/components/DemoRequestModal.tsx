'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import { content } from '@/app/[lang]/content/en';

type DemoRequestModalProps = {
    isOpen: boolean;
    onClose: () => void;
    content: typeof content.modal;
};

export default function DemoRequestModal({ isOpen, onClose, content }: DemoRequestModalProps) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
    const [email, setEmail] = useState('');

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStatus('idle');
            setEmail('');
        }
    }, [isOpen]);

    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setStatus('loading');

        // Simulate API call
        setTimeout(() => {
            setStatus('success');
        }, 1500);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 transition-all"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden pointer-events-auto relative"
                        >
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="p-8">
                                <AnimatePresence mode="wait">
                                    {status === 'success' ? (
                                        <motion.div
                                            key="success"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-center py-8"
                                        >
                                            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                                <CheckCircle className="w-8 h-8" />
                                            </div>
                                            <h3 className="text-2xl font-bold mb-2">{content.successTitle}</h3>
                                            <p className="text-muted-foreground mb-8">{content.successDesc}</p>
                                            <button
                                                onClick={onClose}
                                                className="w-full h-12 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors"
                                            >
                                                {content.successButton}
                                            </button>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="form"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                        >
                                            <h2 className="text-2xl font-bold mb-2">{content.title}</h2>
                                            <p className="text-muted-foreground mb-8">{content.subtitle}</p>

                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div className="space-y-2">
                                                    <label htmlFor="email" className="text-sm font-medium text-foreground">
                                                        Email
                                                    </label>
                                                    <input
                                                        id="email"
                                                        type="email"
                                                        required
                                                        placeholder={content.placeholder}
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        disabled={status === 'loading'}
                                                        className="w-full h-12 px-4 rounded-lg bg-secondary/30 border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50 text-foreground"
                                                    />
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={status === 'loading'}
                                                    className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                                >
                                                    {status === 'loading' ? (
                                                        <>
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                            {content.processing}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {content.button}
                                                            <ArrowRight className="w-4 h-4" />
                                                        </>
                                                    )}
                                                </button>
                                            </form>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
