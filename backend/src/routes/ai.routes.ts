import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../server';
import { z } from 'zod';
import multer from 'multer';
import { SpeechService } from '../services/ai/speech.service';
import { GraphRAGService } from '../services/ai/graphrag.service';

const router = Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }
});

router.post('/generate', authenticate, AIController.generate);
router.post('/generate-deploy', authenticate, AIController.generateAndDeploy);
router.get('/thinking-process/:sessionId', authenticate, AIController.getThinkingProcess);
router.delete('/thinking-process/:sessionId', authenticate, AIController.clearThinkingProcess);
router.post('/suggest-config', authenticate, AIController.suggestConfig);
router.post('/debug', authenticate, AIController.debugWorkflow);
router.post('/ask-node', authenticate, AIController.askAboutNode);
router.post('/explain-error', authenticate, AIController.explainError);
router.post('/suggest-next-node', authenticate, AIController.suggestNextNode);
router.post('/generate-docs', authenticate, AIController.generateDocumentation);
router.post('/predict-failures', authenticate, AIController.predictFailures);
router.post('/suggest-optimizations', authenticate, AIController.suggestOptimizations);

const ttsSchema = z.object({
    text: z.string().min(1).max(4096),
    voice: z.enum(['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer']).optional(),
    model: z.enum(['tts-1', 'tts-1-hd']).optional(),
    speed: z.number().min(0.25).max(4.0).optional(),
    format: z.enum(['mp3', 'opus', 'aac', 'flac']).optional(),
});

router.post('/tts', async (req, res) => {
    try {
        const data = ttsSchema.parse(req.body);
        const speechService = SpeechService.getInstance();
        
        if (!speechService.isConfigured()) {
            return res.status(503).json({ error: 'Speech service not configured. Set OPENAI_API_KEY.' });
        }

        const audioBuffer = await speechService.textToSpeech(data.text, {
            voice: data.voice,
            model: data.model,
            speed: data.speed,
            responseFormat: data.format,
        });

        const format = data.format || 'mp3';
        res.set({
            'Content-Type': `audio/${format === 'mp3' ? 'mpeg' : format}`,
            'Content-Length': audioBuffer.length,
        });
        res.send(audioBuffer);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('TTS error:', error);
        res.status(500).json({ error: 'Failed to generate speech' });
    }
});

router.post('/stt', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const speechService = SpeechService.getInstance();
        
        if (!speechService.isConfigured()) {
            return res.status(503).json({ error: 'Speech service not configured. Set OPENAI_API_KEY.' });
        }

        const language = req.body.language as string | undefined;
        const prompt = req.body.prompt as string | undefined;

        const result = await speechService.speechToText(
            req.file.buffer,
            req.file.originalname || 'audio.webm',
            { language, prompt }
        );

        res.json(result);
    } catch (error) {
        console.error('STT error:', error);
        res.status(500).json({ error: 'Failed to transcribe audio' });
    }
});

router.post('/translate-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const speechService = SpeechService.getInstance();
        
        if (!speechService.isConfigured()) {
            return res.status(503).json({ error: 'Speech service not configured. Set OPENAI_API_KEY.' });
        }

        const result = await speechService.translateAudio(
            req.file.buffer,
            req.file.originalname || 'audio.webm'
        );

        res.json(result);
    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ error: 'Failed to translate audio' });
    }
});

const feedbackSchema = z.object({
    messageId: z.string(),
    workflowId: z.string(),
    feedback: z.enum(['positive', 'negative']),
    timestamp: z.string().optional(),
});

router.post('/feedback', async (req, res) => {
    try {
        const data = feedbackSchema.parse(req.body);
        
        await prisma.aIFeedback.create({
            data: {
                messageId: data.messageId,
                workflowId: data.workflowId,
                feedback: data.feedback,
                createdAt: data.timestamp ? new Date(data.timestamp) : new Date(),
            },
        });

        res.json({ success: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Feedback error:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

router.get('/feedback/stats', authenticate, async (req, res) => {
    try {
        const { workflowId } = req.query;
        
        const stats = await prisma.aIFeedback.groupBy({
            by: ['feedback'],
            where: workflowId ? { workflowId: workflowId as string } : undefined,
            _count: true,
        });

        const result = {
            positive: stats.find(s => s.feedback === 'positive')?._count || 0,
            negative: stats.find(s => s.feedback === 'negative')?._count || 0,
        };

        res.json(result);
    } catch (error) {
        console.error('Feedback stats error:', error);
        res.status(500).json({ error: 'Failed to get feedback stats' });
    }
});

const graphExtractSchema = z.object({
    text: z.string().min(1),
    documentId: z.string().optional(),
    language: z.string().optional(),
    entityTypes: z.array(z.string()).optional(),
});

router.post('/graph-extract', async (req, res) => {
    try {
        const data = graphExtractSchema.parse(req.body);
        const graphService = GraphRAGService.getInstance();
        
        if (!graphService.isConfigured()) {
            return res.status(503).json({ error: 'GraphRAG service not configured. Set OPENAI_API_KEY.' });
        }

        if (data.entityTypes) {
            graphService.setEntityTypes(data.entityTypes);
        }

        const graph = await graphService.extractFromText(
            data.text,
            data.documentId || `doc_${Date.now()}`,
            data.language || 'English'
        );

        res.json(graph);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('GraphRAG extract error:', error);
        res.status(500).json({ error: 'Failed to extract knowledge graph' });
    }
});

router.post('/graph-extract/d3', async (req, res) => {
    try {
        const data = graphExtractSchema.parse(req.body);
        const graphService = GraphRAGService.getInstance();
        
        if (!graphService.isConfigured()) {
            return res.status(503).json({ error: 'GraphRAG service not configured. Set OPENAI_API_KEY.' });
        }

        if (data.entityTypes) {
            graphService.setEntityTypes(data.entityTypes);
        }

        const graph = await graphService.extractFromText(
            data.text,
            data.documentId || `doc_${Date.now()}`,
            data.language || 'English'
        );

        const d3Data = graphService.toD3Format(graph);
        res.json({ ...d3Data, metadata: graph.metadata });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('GraphRAG D3 extract error:', error);
        res.status(500).json({ error: 'Failed to extract knowledge graph' });
    }
});

export default router;
