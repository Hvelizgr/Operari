
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const N8N_NODES_BASE = path.resolve(process.cwd(), '../others/n8n/packages/nodes-base/nodes');
const N8N_LANGCHAIN_BASE = path.resolve(process.cwd(), '../others/n8n/packages/@n8n/nodes-langchain/nodes');

async function importNodes() {
    console.log('Starting n8n nodes import...');

    let count = 0;

    // Helper for recursive scan
    async function scanDir(dirPath: string, typeGroup: 'Standard' | 'AI') {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                if (['test', 'v1', 'v2', '__tests__', 'node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
                await scanDir(fullPath, typeGroup);
            } else if (entry.isFile() && (entry.name.endsWith('.node.ts') || entry.name.endsWith('.node.json'))) {
                await processNodeFile(fullPath, typeGroup);
                count++;
            }
        }
    }

    if (fs.existsSync(N8N_NODES_BASE)) {
        await scanDir(N8N_NODES_BASE, 'Standard');
    }
    if (fs.existsSync(N8N_LANGCHAIN_BASE)) {
        await scanDir(N8N_LANGCHAIN_BASE, 'AI');
    }

    console.log(`Import completed. Processed ${count} node files.`);
}

function _camelToTitleCase(text: string) {
    if (!text) return '';
    const result = text.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1).trim();
}

async function processNodeFile(filePath: string, typeGroup: 'Standard' | 'AI') {
    const content = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(filePath);

    // Extract Display Name
    let displayName = filename.replace('.node.ts', '').replace('.node.json', '');
    const nameMatch = content.match(/displayName:\s*'([^']+)'/) || content.match(/"displayName":\s*"([^"]+)"/);
    if (nameMatch) displayName = nameMatch[1];

    // Extract Description
    let description = '';
    const descMatch = content.match(/description:\s*'([^']+)'/) || content.match(/"description":\s*"([^"]+)"/);
    if (descMatch) description = descMatch[1];

    // Extract Icon
    const iconMatch = content.match(/icon:\s*'([^']+)'/) || content.match(/"icon":\s*"([^"]+)"/);
    let icon = iconMatch ? iconMatch[1] : 'Box';
    if (icon.startsWith('file:')) icon = icon.replace('file:', '').replace('.svg', '');
    if (icon.includes(':')) icon = icon.split(':').pop() || 'Box';
    // Capitalize first letter to match Lucide names if possible
    icon = icon.charAt(0).toUpperCase() + icon.slice(1);

    // Extract Color
    const colorMatch = content.match(/color:\s*'([^']+)'/) || content.match(/"color":\s*"([^"]+)"/);
    let color = colorMatch ? colorMatch[1] : (typeGroup === 'AI' ? 'purple-500' : 'slate-500');
    // Ensure it's a tailwind-compatible class if it's just a hex or name
    if (!color.startsWith('bg-')) color = `bg-${color}`;

    // Construct a type ID
    let typeId = filename.replace('.node.ts', '').replace('.node.json', '');
    if (!typeId.startsWith('n8n-nodes-base.')) {
        typeId = `n8n-nodes-base.${typeId}`;
    }

    // Category Logic
    let category = 'integrations';
    const lowerFilename = filename.toLowerCase();
    const isTrigger = lowerFilename.includes('trigger') ||
        content.includes('group: [\'trigger\']') ||
        content.includes('group: ["trigger"]') ||
        content.includes('"group": ["trigger"]');

    if (typeGroup === 'AI') {
        category = 'ai';
    } else if (isTrigger) {
        category = 'triggers';
    } else {
        // Try to get service name from path
        const parts = filePath.split(path.sep);
        const nodesIdx = parts.lastIndexOf('nodes');
        if (nodesIdx !== -1 && parts.length > nodesIdx + 1) {
            // Find path between 'nodes/' and the file itself
            const subParts = parts.slice(nodesIdx + 1, -1);
            if (subParts.length > 0) {
                const root = subParts[0].toLowerCase();
                const coreNodes = ['httprequest', 'code', 'function', 'set', 'if', 'switch', 'merge', 'wait', 'stop', 'execute', 'base'];
                if (coreNodes.includes(root)) {
                    category = 'core';
                } else {
                    category = 'integrations/' + subParts.map(p => p.toLowerCase()).join('/');
                }
            } else {
                category = 'core';
            }
        }
    }

    // Subtitle
    let subtitle = `n8n ${displayName} Node`; // Initialize with fallback
    const subtitleMatch = content.match(/subtitle:\s*['"]([^'"]+)['"]/);
    if (subtitleMatch) {
        subtitle = subtitleMatch[1];
    }

    try {
        await prisma.nodeType.upsert({
            where: { type: typeId },
            update: {
                category,
                label: { en: displayName, es: displayName },
                description: { en: description, es: description },
                subtitle: { en: subtitle, es: subtitle },
                icon,
                color,
            },
            create: {
                type: typeId,
                category,
                icon,
                color,
                label: { en: displayName, es: displayName },
                description: { en: description, es: description },
                subtitle: { en: subtitle, es: subtitle },
                inputs: ["main"],
                outputs: ["main"],
                properties: []
            }
        });
    } catch (e) {
        // console.error(`Failed to import ${displayName}:`, e);
    }
}

importNodes().finally(() => prisma.$disconnect());
