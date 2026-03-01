import OpenAI from 'openai';

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer';
export type TTSModel = 'tts-1' | 'tts-1-hd';
export type AudioFormat = 'mp3' | 'opus' | 'aac' | 'flac';

export interface TTSOptions {
    model?: TTSModel;
    voice?: TTSVoice;
    speed?: number;
    responseFormat?: AudioFormat;
}

export interface STTOptions {
    model?: string;
    language?: string;
    prompt?: string;
    temperature?: number;
}

export class SpeechService {
    private static instance: SpeechService;
    private openai: OpenAI | null = null;

    private constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
    }

    public static getInstance(): SpeechService {
        if (!SpeechService.instance) {
            SpeechService.instance = new SpeechService();
        }
        return SpeechService.instance;
    }

    async textToSpeech(
        text: string,
        options: TTSOptions = {}
    ): Promise<Buffer> {
        if (!this.openai) {
            throw new Error('OpenAI API key not configured');
        }

        const {
            model = 'tts-1',
            voice = 'alloy',
            speed = 1.0,
            responseFormat = 'mp3',
        } = options;

        if (text.length > 4096) {
            throw new Error('Text exceeds maximum length of 4096 characters');
        }

        if (speed < 0.25 || speed > 4.0) {
            throw new Error('Speed must be between 0.25 and 4.0');
        }

        const response = await this.openai.audio.speech.create({
            model,
            voice,
            input: text,
            speed,
            response_format: responseFormat,
        });

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    async speechToText(
        audioBuffer: Buffer,
        filename: string,
        options: STTOptions = {}
    ): Promise<{ text: string; language?: string; duration?: number }> {
        if (!this.openai) {
            throw new Error('OpenAI API key not configured');
        }

        const {
            model = 'whisper-1',
            language,
            prompt,
            temperature = 0,
        } = options;

        const file = new File([new Uint8Array(audioBuffer)], filename, {
            type: this.getMimeType(filename),
        });

        const response = await this.openai.audio.transcriptions.create({
            file,
            model,
            language,
            prompt,
            temperature,
            response_format: 'verbose_json',
        });

        return {
            text: response.text,
            language: response.language,
            duration: response.duration,
        };
    }

    async translateAudio(
        audioBuffer: Buffer,
        filename: string,
        options: Omit<STTOptions, 'language'> = {}
    ): Promise<{ text: string }> {
        if (!this.openai) {
            throw new Error('OpenAI API key not configured');
        }

        const { model = 'whisper-1', prompt, temperature = 0 } = options;

        const file = new File([new Uint8Array(audioBuffer)], filename, {
            type: this.getMimeType(filename),
        });

        const response = await this.openai.audio.translations.create({
            file,
            model,
            prompt,
            temperature,
        });

        return { text: response.text };
    }

    private getMimeType(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
            mp3: 'audio/mpeg',
            mp4: 'audio/mp4',
            m4a: 'audio/m4a',
            wav: 'audio/wav',
            webm: 'audio/webm',
            ogg: 'audio/ogg',
            flac: 'audio/flac',
        };
        return mimeTypes[ext || ''] || 'audio/mpeg';
    }

    isConfigured(): boolean {
        return this.openai !== null;
    }
}
