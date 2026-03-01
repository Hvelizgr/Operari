'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Minimize2, Maximize2, ThumbsUp, ThumbsDown, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';

export interface ChatWidgetConfig {
    workflowId: string;
    apiUrl: string;
    title?: string;
    placeholder?: string;
    primaryColor?: string;
    position?: 'bottom-right' | 'bottom-left';
    initialMessage?: string;
    lang?: 'en' | 'es';
    enableTTS?: boolean;
    enableSTT?: boolean;
    ttsVoice?: 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer';
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    feedback?: 'positive' | 'negative' | null;
    audioUrl?: string;
}

const translations = {
    en: {
        title: 'Chat',
        placeholder: 'Type a message...',
        initialMessage: 'Hello! How can I help you today?',
        send: 'Send',
        recording: 'Recording...',
        stopRecording: 'Stop recording',
        startRecording: 'Start voice input',
        playAudio: 'Play response',
        stopAudio: 'Stop audio',
        generatingAudio: 'Generating audio...',
    },
    es: {
        title: 'Chat',
        placeholder: 'Escribe un mensaje...',
        initialMessage: '¡Hola! ¿En qué puedo ayudarte hoy?',
        send: 'Enviar',
        recording: 'Grabando...',
        stopRecording: 'Detener grabación',
        startRecording: 'Entrada de voz',
        playAudio: 'Reproducir respuesta',
        stopAudio: 'Detener audio',
        generatingAudio: 'Generando audio...',
    },
};

export function ChatWidget({
    workflowId,
    apiUrl,
    title,
    placeholder,
    primaryColor = '#3b82f6',
    position = 'bottom-right',
    initialMessage,
    lang = 'en',
    enableTTS = false,
    enableSTT = false,
    ttsVoice = 'alloy',
}: ChatWidgetConfig) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTTSLoading, setIsTTSLoading] = useState<string | null>(null);
    const [playingAudio, setPlayingAudio] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const t = translations[lang];

    const positionClasses = position === 'bottom-right' 
        ? 'right-4 sm:right-6' 
        : 'left-4 sm:left-6';

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{
                id: 'init',
                role: 'assistant',
                content: initialMessage || t.initialMessage,
                timestamp: new Date(),
            }]);
        }
    }, [isOpen, initialMessage, t.initialMessage, messages.length]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = useCallback(async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch(`${apiUrl}/api/workflows/${workflowId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    input: { message: userMessage.content },
                    mode: 'chat',
                }),
            });

            const data = await response.json();
            
            setMessages(prev => [...prev, {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.output?.message || data.result || 'Sorry, I could not process your request.',
                timestamp: new Date(),
            }]);
        } catch {
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: 'Connection error. Please try again.',
                timestamp: new Date(),
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, apiUrl, workflowId]);

    const submitFeedback = useCallback(async (messageId: string, feedback: 'positive' | 'negative') => {
        setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, feedback } : msg
        ));
        
        try {
            await fetch(`${apiUrl}/api/ai/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId,
                    workflowId,
                    feedback,
                    timestamp: new Date().toISOString(),
                }),
            });
        } catch (error) {
            console.error('Failed to submit feedback:', error);
        }
    }, [apiUrl, workflowId]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.webm');
                formData.append('language', lang === 'es' ? 'es' : 'en');

                try {
                    const response = await fetch(`${apiUrl}/api/ai/stt`, {
                        method: 'POST',
                        body: formData,
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.text) {
                            setInput(data.text);
                        }
                    }
                } catch (error) {
                    console.error('STT error:', error);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Failed to start recording:', error);
        }
    }, [apiUrl, lang]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    const playTTS = useCallback(async (messageId: string, text: string) => {
        if (playingAudio === messageId) {
            audioRef.current?.pause();
            setPlayingAudio(null);
            return;
        }

        setIsTTSLoading(messageId);
        
        try {
            const response = await fetch(`${apiUrl}/api/ai/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    voice: ttsVoice,
                    model: 'tts-1',
                }),
            });

            if (response.ok) {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                
                if (audioRef.current) {
                    audioRef.current.pause();
                }
                
                const audio = new Audio(audioUrl);
                audioRef.current = audio;
                
                audio.onended = () => {
                    setPlayingAudio(null);
                    URL.revokeObjectURL(audioUrl);
                };
                
                audio.play();
                setPlayingAudio(messageId);
            }
        } catch (error) {
            console.error('TTS error:', error);
        } finally {
            setIsTTSLoading(null);
        }
    }, [apiUrl, playingAudio, ttsVoice]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-4 sm:bottom-6 ${positionClasses} z-50 p-4 rounded-full shadow-lg transition-transform hover:scale-110`}
                style={{ backgroundColor: primaryColor }}
                aria-label="Open chat"
            >
                <MessageCircle className="w-6 h-6 text-white" />
            </button>
        );
    }

    return (
        <div 
            className={`fixed bottom-4 sm:bottom-6 ${positionClasses} z-50 w-[calc(100vw-2rem)] sm:w-96 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 overflow-hidden transition-all`}
            style={{ maxHeight: isMinimized ? '48px' : '500px' }}
        >
            <div 
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <span className="font-medium text-white">{title || t.title}</span>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                        className="p-1 hover:bg-white/20 rounded"
                    >
                        {isMinimized ? <Maximize2 className="w-4 h-4 text-white" /> : <Minimize2 className="w-4 h-4 text-white" />}
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                        className="p-1 hover:bg-white/20 rounded"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    <div className="h-80 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                                        msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-br-md'
                                            : 'bg-slate-800 text-slate-200 rounded-bl-md'
                                    }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                                {msg.role === 'assistant' && msg.id !== 'init' && (
                                    <div className="flex items-center gap-1 mt-1 ml-1">
                                        {enableTTS && (
                                            <button
                                                onClick={() => playTTS(msg.id, msg.content)}
                                                className={`p-1 rounded transition-colors ${
                                                    playingAudio === msg.id
                                                        ? 'text-blue-400 bg-blue-400/20'
                                                        : 'text-slate-500 hover:text-blue-400 hover:bg-slate-700'
                                                }`}
                                                title={playingAudio === msg.id ? t.stopAudio : t.playAudio}
                                                disabled={isTTSLoading === msg.id}
                                            >
                                                {isTTSLoading === msg.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : playingAudio === msg.id ? (
                                                    <VolumeX size={14} />
                                                ) : (
                                                    <Volume2 size={14} />
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => submitFeedback(msg.id, 'positive')}
                                            className={`p-1 rounded transition-colors ${
                                                msg.feedback === 'positive'
                                                    ? 'text-green-400 bg-green-400/20'
                                                    : 'text-slate-500 hover:text-green-400 hover:bg-slate-700'
                                            }`}
                                            title={lang === 'en' ? 'Helpful' : 'Útil'}
                                            disabled={msg.feedback !== undefined && msg.feedback !== null}
                                        >
                                            <ThumbsUp size={14} />
                                        </button>
                                        <button
                                            onClick={() => submitFeedback(msg.id, 'negative')}
                                            className={`p-1 rounded transition-colors ${
                                                msg.feedback === 'negative'
                                                    ? 'text-red-400 bg-red-400/20'
                                                    : 'text-slate-500 hover:text-red-400 hover:bg-slate-700'
                                            }`}
                                            title={lang === 'en' ? 'Not helpful' : 'No útil'}
                                            disabled={msg.feedback !== undefined && msg.feedback !== null}
                                        >
                                            <ThumbsDown size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 px-4 py-2 rounded-2xl rounded-bl-md">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 border-t border-slate-700">
                        <div className="flex items-center gap-2">
                            {enableSTT && (
                                <button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`p-2 rounded-lg transition-colors ${
                                        isRecording 
                                            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                                            : 'bg-slate-700 hover:bg-slate-600'
                                    }`}
                                    title={isRecording ? t.stopRecording : t.startRecording}
                                    disabled={isLoading}
                                >
                                    {isRecording ? (
                                        <MicOff className="w-5 h-5 text-white" />
                                    ) : (
                                        <Mic className="w-5 h-5 text-white" />
                                    )}
                                </button>
                            )}
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isRecording ? t.recording : (placeholder || t.placeholder)}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isLoading || isRecording}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={isLoading || !input.trim()}
                                className="p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: primaryColor }}
                                aria-label={t.send}
                            >
                                <Send className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export function generateEmbedScript(config: ChatWidgetConfig): string {
    return `<script>
(function() {
  var config = ${JSON.stringify(config)};
  var script = document.createElement('script');
  script.src = config.apiUrl + '/widget.js';
  script.onload = function() {
    window.NanoFlowChat.init(config);
  };
  document.body.appendChild(script);
})();
</script>`;
}

export function generateEmbedIframe(config: ChatWidgetConfig): string {
    const params = new URLSearchParams({
        workflowId: config.workflowId,
        primaryColor: config.primaryColor || '#3b82f6',
        position: config.position || 'bottom-right',
        lang: config.lang || 'en',
        ...(config.title && { title: config.title }),
        ...(config.initialMessage && { initialMessage: config.initialMessage }),
        ...(config.enableTTS && { enableTTS: 'true' }),
        ...(config.enableSTT && { enableSTT: 'true' }),
        ...(config.ttsVoice && { ttsVoice: config.ttsVoice }),
    });
    
    return `<iframe 
  src="${config.apiUrl}/embed/chat?${params.toString()}"
  style="position:fixed;bottom:0;${config.position === 'bottom-left' ? 'left' : 'right'}:0;border:none;width:400px;height:600px;z-index:9999;"
  allow="clipboard-write; microphone"
></iframe>`;
}
