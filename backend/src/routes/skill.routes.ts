import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { SkillService } from '../services/skill.service';
import * as path from 'path';
import * as fs from 'fs';
import multer from 'multer';
import AdmZip from 'adm-zip';

const router = Router();
const skillService = SkillService.getInstance();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP files are allowed'));
        }
    },
});

router.get('/', authenticate, async (req, res) => {
    try {
        await skillService.loadAllSkills();
        const skills = skillService.getAllSkills();
        res.json(skills);
    } catch (error) {
        console.error('Failed to list skills:', error);
        res.status(500).json({ error: 'Failed to list skills' });
    }
});

router.get('/enabled', authenticate, async (req, res) => {
    try {
        const skills = skillService.getEnabledSkills();
        res.json(skills);
    } catch (error) {
        console.error('Failed to get enabled skills:', error);
        res.status(500).json({ error: 'Failed to get enabled skills' });
    }
});

router.get('/:skillId', authenticate, async (req, res) => {
    try {
        const skillId = req.params.skillId as string;
        const skill = skillService.getSkill(skillId);
        if (!skill) {
            return res.status(404).json({ error: 'Skill not found' });
        }
        res.json(skill);
    } catch (error) {
        console.error('Failed to get skill:', error);
        res.status(500).json({ error: 'Failed to get skill' });
    }
});

const createSkillSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000),
    prompt: z.string().min(1),
    version: z.string().optional(),
    author: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
});

router.post('/', authenticate, async (req, res) => {
    try {
        const data = createSkillSchema.parse(req.body);
        const skill = await skillService.createSkill(data);
        res.status(201).json(skill);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Failed to create skill:', error);
        res.status(500).json({ error: 'Failed to create skill' });
    }
});

router.post('/import', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const tempDir = path.join(process.cwd(), 'data', 'temp', `skill_import_${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        try {
            const zip = new AdmZip(req.file.buffer);
            zip.extractAllTo(tempDir, true);

            const entries = fs.readdirSync(tempDir, { withFileTypes: true });
            const importedSkills = [];

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const skillPath = path.join(tempDir, entry.name);
                    const skill = await skillService.importSkill(skillPath);
                    if (skill) {
                        importedSkills.push(skill);
                    }
                }
            }

            if (importedSkills.length === 0) {
                const skill = await skillService.importSkill(tempDir);
                if (skill) {
                    importedSkills.push(skill);
                }
            }

            res.json({ imported: importedSkills });
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    } catch (error) {
        console.error('Failed to import skill:', error);
        res.status(500).json({ error: 'Failed to import skill' });
    }
});

router.post('/import-from-path', authenticate, async (req, res) => {
    try {
        const { sourcePath } = req.body;
        
        if (!sourcePath || typeof sourcePath !== 'string') {
            return res.status(400).json({ error: 'Source path is required' });
        }

        if (!fs.existsSync(sourcePath)) {
            return res.status(400).json({ error: 'Source path does not exist' });
        }

        const stat = fs.statSync(sourcePath);
        if (!stat.isDirectory()) {
            return res.status(400).json({ error: 'Source path must be a directory' });
        }

        const skill = await skillService.importSkill(sourcePath);
        if (!skill) {
            return res.status(400).json({ error: 'Invalid skill directory' });
        }

        res.json(skill);
    } catch (error) {
        console.error('Failed to import skill from path:', error);
        res.status(500).json({ error: 'Failed to import skill from path' });
    }
});

const updateSkillSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).optional(),
    prompt: z.string().min(1).optional(),
    version: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
});

router.put('/:skillId', authenticate, async (req, res) => {
    try {
        const skillId = req.params.skillId as string;
        const data = updateSkillSchema.parse(req.body);
        const skill = await skillService.updateSkill(skillId, data);
        
        if (!skill) {
            return res.status(404).json({ error: 'Skill not found' });
        }
        
        res.json(skill);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Failed to update skill:', error);
        res.status(500).json({ error: 'Failed to update skill' });
    }
});

router.post('/:skillId/enable', authenticate, async (req, res) => {
    try {
        const skillId = req.params.skillId as string;
        const success = skillService.enableSkill(skillId);
        if (!success) {
            return res.status(404).json({ error: 'Skill not found' });
        }
        res.json({ enabled: true });
    } catch (error) {
        console.error('Failed to enable skill:', error);
        res.status(500).json({ error: 'Failed to enable skill' });
    }
});

router.post('/:skillId/disable', authenticate, async (req, res) => {
    try {
        const skillId = req.params.skillId as string;
        const success = skillService.disableSkill(skillId);
        if (!success) {
            return res.status(404).json({ error: 'Skill not found' });
        }
        res.json({ enabled: false });
    } catch (error) {
        console.error('Failed to disable skill:', error);
        res.status(500).json({ error: 'Failed to disable skill' });
    }
});

router.post('/:skillId/toggle', authenticate, async (req, res) => {
    try {
        const skillId = req.params.skillId as string;
        const enabled = skillService.toggleSkill(skillId);
        const skill = skillService.getSkill(skillId);
        if (!skill) {
            return res.status(404).json({ error: 'Skill not found' });
        }
        res.json({ enabled });
    } catch (error) {
        console.error('Failed to toggle skill:', error);
        res.status(500).json({ error: 'Failed to toggle skill' });
    }
});

router.delete('/:skillId', authenticate, async (req, res) => {
    try {
        const skillId = req.params.skillId as string;
        const success = skillService.deleteSkill(skillId);
        if (!success) {
            return res.status(404).json({ error: 'Skill not found' });
        }
        res.json({ deleted: true });
    } catch (error) {
        console.error('Failed to delete skill:', error);
        res.status(500).json({ error: 'Failed to delete skill' });
    }
});

router.post('/combined-prompt', authenticate, async (req, res) => {
    try {
        const { skillIds } = req.body;
        const prompt = skillService.getCombinedPrompt(skillIds);
        res.json({ prompt });
    } catch (error) {
        console.error('Failed to get combined prompt:', error);
        res.status(500).json({ error: 'Failed to get combined prompt' });
    }
});

router.post('/reload', authenticate, async (req, res) => {
    try {
        const skills = await skillService.loadAllSkills();
        res.json({ reloaded: skills.length, skills });
    } catch (error) {
        console.error('Failed to reload skills:', error);
        res.status(500).json({ error: 'Failed to reload skills' });
    }
});

export default router;
