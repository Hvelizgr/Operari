import OpenAI from 'openai';

const GRAPH_FIELD_SEP = '<SEP>';
const DEFAULT_ENTITY_TYPES = ['organization', 'person', 'location', 'event', 'concept', 'technology'];

export interface Entity {
    name: string;
    type: string;
    description: string;
    sourceChunks: string[];
}

export interface Relationship {
    source: string;
    target: string;
    description: string;
    strength: number;
    keywords: string[];
    sourceChunks: string[];
}

export interface KnowledgeGraph {
    entities: Entity[];
    relationships: Relationship[];
    metadata: {
        documentId: string;
        extractedAt: Date;
        totalChunks: number;
        language: string;
    };
}

const GRAPH_EXTRACTION_PROMPT = `
-Goal-
Given a text document, identify all entities and relationships among them.

-Steps-
1. Identify all entities. For each entity extract:
- entity_name: Name of the entity, capitalized
- entity_type: One of: [{entity_types}]
- entity_description: Description of the entity

Format: ("entity"|<entity_name>|<entity_type>|<entity_description>)

2. Identify all relationships between entities:
- source_entity: source entity name
- target_entity: target entity name
- relationship_description: why they are related
- relationship_strength: numeric score 1-10

Format: ("relationship"|<source_entity>|<target_entity>|<relationship_description>|<relationship_strength>)

3. Return all entities and relationships, one per line.

-Text-
{input_text}

-Output-
`;

const SUMMARIZE_PROMPT = `
Summarize the following descriptions into a single coherent description.
Include all key information and resolve any contradictions.
Use {language} as output language.

Entity: {entity_name}
Descriptions: {descriptions}

Summary:
`;

export class GraphRAGService {
    private static instance: GraphRAGService;
    private openai: OpenAI | null = null;
    private entityTypes: string[];

    private constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
        this.entityTypes = DEFAULT_ENTITY_TYPES;
    }

    public static getInstance(): GraphRAGService {
        if (!GraphRAGService.instance) {
            GraphRAGService.instance = new GraphRAGService();
        }
        return GraphRAGService.instance;
    }

    setEntityTypes(types: string[]) {
        this.entityTypes = types;
    }

    async extractFromText(
        text: string,
        documentId: string,
        language: string = 'English'
    ): Promise<KnowledgeGraph> {
        if (!this.openai) {
            throw new Error('OpenAI API key not configured');
        }

        const chunks = this.splitIntoChunks(text, 4000);
        const allEntities: Map<string, Entity> = new Map();
        const allRelationships: Map<string, Relationship> = new Map();

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkId = `chunk_${i}`;

            try {
                const { entities, relationships } = await this.extractFromChunk(chunk, chunkId, language);
                
                for (const entity of entities) {
                    const existing = allEntities.get(entity.name.toLowerCase());
                    if (existing) {
                        existing.description = `${existing.description}${GRAPH_FIELD_SEP}${entity.description}`;
                        existing.sourceChunks.push(...entity.sourceChunks);
                    } else {
                        allEntities.set(entity.name.toLowerCase(), entity);
                    }
                }

                for (const rel of relationships) {
                    const key = `${rel.source.toLowerCase()}->${rel.target.toLowerCase()}`;
                    const existing = allRelationships.get(key);
                    if (existing) {
                        existing.description = `${existing.description}${GRAPH_FIELD_SEP}${rel.description}`;
                        existing.strength = Math.max(existing.strength, rel.strength);
                        existing.sourceChunks.push(...rel.sourceChunks);
                        existing.keywords.push(...rel.keywords);
                    } else {
                        allRelationships.set(key, rel);
                    }
                }
            } catch (error) {
                console.error(`Error extracting from chunk ${i}:`, error);
            }
        }

        const mergedEntities = await this.mergeEntities(Array.from(allEntities.values()), language);
        const mergedRelationships = await this.mergeRelationships(Array.from(allRelationships.values()), language);

        return {
            entities: mergedEntities,
            relationships: mergedRelationships,
            metadata: {
                documentId,
                extractedAt: new Date(),
                totalChunks: chunks.length,
                language,
            },
        };
    }

    private splitIntoChunks(text: string, maxChunkSize: number): string[] {
        const chunks: string[] = [];
        const paragraphs = text.split(/\n\n+/);
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            if (currentChunk.length + paragraph.length > maxChunkSize) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = paragraph;
            } else {
                currentChunk += '\n\n' + paragraph;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    private async extractFromChunk(
        chunk: string,
        chunkId: string,
        _language: string
    ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
        const prompt = GRAPH_EXTRACTION_PROMPT
            .replace('{entity_types}', this.entityTypes.join(', '))
            .replace('{input_text}', chunk);

        const response = await this.openai!.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 4000,
        });

        const output = response.choices[0]?.message?.content || '';
        return this.parseExtractionOutput(output, chunkId);
    }

    private parseExtractionOutput(
        output: string,
        chunkId: string
    ): { entities: Entity[]; relationships: Relationship[] } {
        const entities: Entity[] = [];
        const relationships: Relationship[] = [];

        const lines = output.split('\n').filter(line => line.trim());

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('("entity"') || trimmed.startsWith('(entity')) {
                const entity = this.parseEntityLine(trimmed, chunkId);
                if (entity) entities.push(entity);
            } else if (trimmed.startsWith('("relationship"') || trimmed.startsWith('(relationship')) {
                const rel = this.parseRelationshipLine(trimmed, chunkId);
                if (rel) relationships.push(rel);
            }
        }

        return { entities, relationships };
    }

    private parseEntityLine(line: string, chunkId: string): Entity | null {
        try {
            const match = line.match(/\("?entity"?\|([^|]+)\|([^|]+)\|([^)]+)\)/i);
            if (!match) return null;

            return {
                name: match[1].trim().replace(/^"|"$/g, ''),
                type: match[2].trim().replace(/^"|"$/g, '').toLowerCase(),
                description: match[3].trim().replace(/^"|"$/g, ''),
                sourceChunks: [chunkId],
            };
        } catch {
            return null;
        }
    }

    private parseRelationshipLine(line: string, chunkId: string): Relationship | null {
        try {
            const match = line.match(/\("?relationship"?\|([^|]+)\|([^|]+)\|([^|]+)\|(\d+)\)/i);
            if (!match) return null;

            return {
                source: match[1].trim().replace(/^"|"$/g, ''),
                target: match[2].trim().replace(/^"|"$/g, ''),
                description: match[3].trim().replace(/^"|"$/g, ''),
                strength: parseInt(match[4], 10) || 5,
                keywords: [],
                sourceChunks: [chunkId],
            };
        } catch {
            return null;
        }
    }

    private async mergeEntities(entities: Entity[], language: string): Promise<Entity[]> {
        const merged: Entity[] = [];

        for (const entity of entities) {
            const descriptions = entity.description.split(GRAPH_FIELD_SEP);
            if (descriptions.length > 3) {
                entity.description = await this.summarizeDescriptions(entity.name, descriptions, language);
            } else {
                entity.description = descriptions.join(' ');
            }
            entity.sourceChunks = [...new Set(entity.sourceChunks)];
            merged.push(entity);
        }

        return merged;
    }

    private async mergeRelationships(relationships: Relationship[], language: string): Promise<Relationship[]> {
        const merged: Relationship[] = [];

        for (const rel of relationships) {
            const descriptions = rel.description.split(GRAPH_FIELD_SEP);
            if (descriptions.length > 3) {
                rel.description = await this.summarizeDescriptions(
                    `${rel.source} -> ${rel.target}`,
                    descriptions,
                    language
                );
            } else {
                rel.description = descriptions.join(' ');
            }
            rel.sourceChunks = [...new Set(rel.sourceChunks)];
            rel.keywords = [...new Set(rel.keywords)];
            merged.push(rel);
        }

        return merged;
    }

    private async summarizeDescriptions(
        entityName: string,
        descriptions: string[],
        language: string
    ): Promise<string> {
        if (!this.openai) return descriptions.join(' ');

        const prompt = SUMMARIZE_PROMPT
            .replace('{entity_name}', entityName)
            .replace('{descriptions}', descriptions.join('\n- '))
            .replace('{language}', language);

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2,
                max_tokens: 500,
            });

            return response.choices[0]?.message?.content || descriptions.join(' ');
        } catch {
            return descriptions.join(' ');
        }
    }

    isConfigured(): boolean {
        return this.openai !== null;
    }

    toD3Format(graph: KnowledgeGraph): { nodes: any[]; links: any[] } {
        const nodeMap = new Map<string, number>();
        const nodes: any[] = [];
        const links: any[] = [];

        graph.entities.forEach((entity, index) => {
            nodeMap.set(entity.name.toLowerCase(), index);
            nodes.push({
                id: index,
                name: entity.name,
                type: entity.type,
                description: entity.description,
                group: this.getGroupByType(entity.type),
            });
        });

        graph.relationships.forEach(rel => {
            const sourceIndex = nodeMap.get(rel.source.toLowerCase());
            const targetIndex = nodeMap.get(rel.target.toLowerCase());
            
            if (sourceIndex !== undefined && targetIndex !== undefined) {
                links.push({
                    source: sourceIndex,
                    target: targetIndex,
                    description: rel.description,
                    strength: rel.strength,
                });
            }
        });

        return { nodes, links };
    }

    private getGroupByType(type: string): number {
        const groups: Record<string, number> = {
            person: 1,
            organization: 2,
            location: 3,
            event: 4,
            concept: 5,
            technology: 6,
        };
        return groups[type.toLowerCase()] || 0;
    }
}
