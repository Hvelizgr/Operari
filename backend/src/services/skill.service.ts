import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../config/logger.config';

export interface SkillMetadata {
    name: string;
    description: string;
    version: string;
    author?: string;
    license?: string;
    category?: string;
    tags?: string[];
    references?: string[];
}

export interface SkillDefinition {
    id: string;
    name: string;
    description: string;
    version: string;
    author?: string;
    license?: string;
    category?: string;
    tags?: string[];
    prompt: string;
    rules?: string[];
    metadata?: Record<string, unknown>;
    enabled: boolean;
    path: string;
    loadedAt: Date;
}

export class SkillService {
    private static instance: SkillService;
    private skills: Map<string, SkillDefinition> = new Map();
    private skillsDirectory: string;
    private enabledSkills: Set<string> = new Set();

    private constructor() {
        this.skillsDirectory = path.join(process.cwd(), 'data', 'skills');
        this.ensureSkillsDirectory();
    }

    static getInstance(): SkillService {
        if (!SkillService.instance) {
            SkillService.instance = new SkillService();
        }
        return SkillService.instance;
    }

    private ensureSkillsDirectory(): void {
        if (!fs.existsSync(this.skillsDirectory)) {
            fs.mkdirSync(this.skillsDirectory, { recursive: true });
            logger.info({ directory: this.skillsDirectory }, 'Created skills directory');
        }
    }

    async loadAllSkills(): Promise<SkillDefinition[]> {
        this.skills.clear();

        if (!fs.existsSync(this.skillsDirectory)) {
            return [];
        }

        const entries = fs.readdirSync(this.skillsDirectory, { withFileTypes: true });
        
        for (const entry of entries) {
            if (entry.isDirectory()) {
                try {
                    const skill = await this.loadSkillFromDirectory(path.join(this.skillsDirectory, entry.name));
                    if (skill) {
                        this.skills.set(skill.id, skill);
                    }
                } catch (error) {
                    logger.error({ error, skillDir: entry.name }, 'Failed to load skill');
                }
            }
        }

        logger.info({ count: this.skills.size }, 'Loaded skills');
        return Array.from(this.skills.values());
    }

    private async loadSkillFromDirectory(skillPath: string): Promise<SkillDefinition | null> {
        const skillId = path.basename(skillPath);
        
        const promptPath = path.join(skillPath, 'prompt.md');
        const skillMdPath = path.join(skillPath, 'SKILL.md');
        const metadataPath = path.join(skillPath, 'metadata.json');
        const agentsMdPath = path.join(skillPath, 'AGENTS.md');

        let prompt = '';
        let metadata: SkillMetadata = {
            name: skillId,
            description: `Skill: ${skillId}`,
            version: '1.0.0',
        };

        if (fs.existsSync(skillMdPath)) {
            const skillContent = fs.readFileSync(skillMdPath, 'utf-8');
            const parsed = this.parseSkillMd(skillContent);
            metadata = { ...metadata, ...parsed.frontmatter };
            prompt = parsed.content;
        }

        if (fs.existsSync(promptPath)) {
            prompt = fs.readFileSync(promptPath, 'utf-8');
        }

        if (fs.existsSync(agentsMdPath) && !prompt) {
            prompt = fs.readFileSync(agentsMdPath, 'utf-8');
        }

        if (fs.existsSync(metadataPath)) {
            const jsonContent = fs.readFileSync(metadataPath, 'utf-8');
            try {
                const jsonMeta = JSON.parse(jsonContent);
                metadata = { ...metadata, ...jsonMeta };
            } catch {
                logger.warn({ skillId }, 'Invalid metadata.json');
            }
        }

        const rules: string[] = [];
        const rulesDir = path.join(skillPath, 'rules');
        if (fs.existsSync(rulesDir)) {
            const ruleFiles = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'));
            for (const ruleFile of ruleFiles) {
                const ruleContent = fs.readFileSync(path.join(rulesDir, ruleFile), 'utf-8');
                rules.push(ruleContent);
            }
        }

        if (!prompt && rules.length === 0) {
            logger.warn({ skillId }, 'Skill has no prompt or rules');
            return null;
        }

        return {
            id: skillId,
            name: metadata.name || skillId,
            description: metadata.description || '',
            version: metadata.version || '1.0.0',
            author: metadata.author,
            license: metadata.license,
            category: metadata.category,
            tags: metadata.tags,
            prompt,
            rules,
            metadata: metadata as unknown as Record<string, unknown>,
            enabled: this.enabledSkills.has(skillId),
            path: skillPath,
            loadedAt: new Date(),
        };
    }

    private parseSkillMd(content: string): { frontmatter: Partial<SkillMetadata>; content: string } {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
        const match = content.match(frontmatterRegex);

        if (!match) {
            return { frontmatter: {}, content };
        }

        const frontmatterStr = match[1];
        const bodyContent = content.slice(match[0].length);

        const frontmatter: Record<string, unknown> = {};
        const lines = frontmatterStr.split('\n');
        
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.slice(0, colonIndex).trim();
                let value: unknown = line.slice(colonIndex + 1).trim();
                
                if (value === 'true') value = true;
                else if (value === 'false') value = false;
                else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10);
                else if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
                    value = (value as string).slice(1, -1);
                }
                
                frontmatter[key] = value;
            }
        }

        return { frontmatter: frontmatter as Partial<SkillMetadata>, content: bodyContent.trim() };
    }

    async importSkill(sourcePath: string): Promise<SkillDefinition | null> {
        const skillId = path.basename(sourcePath);
        const targetPath = path.join(this.skillsDirectory, skillId);

        if (fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, { recursive: true });
        }

        this.copyDirectoryRecursive(sourcePath, targetPath);

        const skill = await this.loadSkillFromDirectory(targetPath);
        if (skill) {
            this.skills.set(skill.id, skill);
            logger.info({ skillId }, 'Imported skill');
        }

        return skill;
    }

    private copyDirectoryRecursive(src: string, dest: string): void {
        fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                this.copyDirectoryRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    async createSkill(skillData: {
        name: string;
        description: string;
        prompt: string;
        version?: string;
        author?: string;
        category?: string;
        tags?: string[];
    }): Promise<SkillDefinition> {
        const skillId = this.slugify(skillData.name);
        const skillPath = path.join(this.skillsDirectory, skillId);

        if (fs.existsSync(skillPath)) {
            throw new Error(`Skill ${skillId} already exists`);
        }

        fs.mkdirSync(skillPath, { recursive: true });

        fs.writeFileSync(path.join(skillPath, 'prompt.md'), skillData.prompt);

        const metadata = {
            name: skillData.name,
            description: skillData.description,
            version: skillData.version || '1.0.0',
            author: skillData.author,
            category: skillData.category,
            tags: skillData.tags,
        };
        fs.writeFileSync(path.join(skillPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

        const skill = await this.loadSkillFromDirectory(skillPath);
        if (skill) {
            this.skills.set(skill.id, skill);
        }

        return skill!;
    }

    private slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    getSkill(skillId: string): SkillDefinition | undefined {
        return this.skills.get(skillId);
    }

    getAllSkills(): SkillDefinition[] {
        return Array.from(this.skills.values());
    }

    getEnabledSkills(): SkillDefinition[] {
        return Array.from(this.skills.values()).filter(s => s.enabled);
    }

    enableSkill(skillId: string): boolean {
        const skill = this.skills.get(skillId);
        if (skill) {
            skill.enabled = true;
            this.enabledSkills.add(skillId);
            return true;
        }
        return false;
    }

    disableSkill(skillId: string): boolean {
        const skill = this.skills.get(skillId);
        if (skill) {
            skill.enabled = false;
            this.enabledSkills.delete(skillId);
            return true;
        }
        return false;
    }

    toggleSkill(skillId: string): boolean {
        const skill = this.skills.get(skillId);
        if (skill) {
            skill.enabled = !skill.enabled;
            if (skill.enabled) {
                this.enabledSkills.add(skillId);
            } else {
                this.enabledSkills.delete(skillId);
            }
            return skill.enabled;
        }
        return false;
    }

    deleteSkill(skillId: string): boolean {
        const skill = this.skills.get(skillId);
        if (skill) {
            if (fs.existsSync(skill.path)) {
                fs.rmSync(skill.path, { recursive: true });
            }
            this.skills.delete(skillId);
            this.enabledSkills.delete(skillId);
            return true;
        }
        return false;
    }

    getCombinedPrompt(skillIds?: string[]): string {
        const targetSkills = skillIds 
            ? skillIds.map(id => this.skills.get(id)).filter(Boolean) as SkillDefinition[]
            : this.getEnabledSkills();

        if (targetSkills.length === 0) {
            return '';
        }

        const prompts = targetSkills.map(skill => {
            let content = `## ${skill.name}\n\n${skill.prompt}`;
            if (skill.rules && skill.rules.length > 0) {
                content += '\n\n### Rules\n\n' + skill.rules.join('\n\n---\n\n');
            }
            return content;
        });

        return prompts.join('\n\n---\n\n');
    }

    async updateSkill(skillId: string, updates: Partial<{
        name: string;
        description: string;
        prompt: string;
        version: string;
        category: string;
        tags: string[];
    }>): Promise<SkillDefinition | null> {
        const skill = this.skills.get(skillId);
        if (!skill) return null;

        if (updates.prompt) {
            fs.writeFileSync(path.join(skill.path, 'prompt.md'), updates.prompt);
        }

        const metadataPath = path.join(skill.path, 'metadata.json');
        let metadata: Record<string, unknown> = {};
        
        if (fs.existsSync(metadataPath)) {
            metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        }

        if (updates.name) metadata.name = updates.name;
        if (updates.description) metadata.description = updates.description;
        if (updates.version) metadata.version = updates.version;
        if (updates.category) metadata.category = updates.category;
        if (updates.tags) metadata.tags = updates.tags;

        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        return this.loadSkillFromDirectory(skill.path);
    }

    getSkillsDirectory(): string {
        return this.skillsDirectory;
    }
}
