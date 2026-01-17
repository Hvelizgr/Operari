
const fs = require('fs');
const path = require('path');

const NODES_BASE_DIR = path.resolve(__dirname, '../others/n8n/packages/nodes-base/nodes');
const OUTPUT_FILE = path.resolve(__dirname, '../backend/prisma/seed-nodes-generated.ts');

function scanNodes(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            scanNodes(filePath, fileList);
        } else {
            if (file.endsWith('.node.ts') || file.endsWith('.node.json')) {
                fileList.push(filePath);
            }
        }
    });
    return fileList;
}

function extractNodeData(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Simple regex parsing implies fragility, but acceptable for this task
    // Looking for structure: description: INodeTypeDescription = { ... }
    // Or JSON content if .json

    let displayName = '';
    let name = '';
    let icon = 'Box'; // Default
    let description = '';
    let group = [];

    if (filePath.endsWith('.json')) {
        try {
            const data = JSON.parse(content);
            displayName = data.displayName;
            name = data.name;
            icon = data.icon;
            description = data.description;
            group = data.group || [];
        } catch (e) {
            return null;
        }
    } else {
        // TypeScript file parsing via Regex
        const displayMatch = content.match(/displayName:\s*'([^']+)'/);
        const nameMatch = content.match(/name:\s*'([^']+)'/);
        const iconMatch = content.match(/icon:\s*'([^']+)'/);
        const descMatch = content.match(/description:\s*'([^']+)'/);
        // Groups often array: group: ['transform']
        const groupMatch = content.match(/group:\s*\[([^\]]+)\]/);

        if (displayMatch) displayName = displayMatch[1];
        if (nameMatch) name = nameMatch[1];
        if (iconMatch) icon = iconMatch[1];
        if (descMatch) description = descMatch[1];
        if (groupMatch) group = groupMatch[1].replace(/'/g, '').split(',').map(s => s.trim());
    }

    if (!name || !displayName) return null;

    // Clean icon: "file:postgres.svg" -> "Database", "fa:calendar" -> "Calendar"
    // Map usage icons to lucide icons broadly
    let lucideIcon = 'Box';
    if (icon) {
        if (icon.includes('database') || icon.includes('postgres') || icon.includes('mysql') || icon.includes('mongo')) lucideIcon = 'Database';
        else if (icon.includes('mail')) lucideIcon = 'Mail';
        else if (icon.includes('slack')) lucideIcon = 'Hash';
        else if (icon.includes('calendar') || icon.includes('schedule')) lucideIcon = 'Calendar';
        else if (icon.includes('clock') || icon.includes('time')) lucideIcon = 'Clock';
        else if (icon.includes('webhook')) lucideIcon = 'Webhook';
        else if (icon.includes('http') || icon.includes('globe')) lucideIcon = 'Globe';
        else if (icon.includes('code')) lucideIcon = 'Code';
        else if (icon.includes('file')) lucideIcon = 'File';
        else if (icon.includes('trigger')) lucideIcon = 'Zap';
        else if (icon.includes('aws')) lucideIcon = 'Cloud';
    }

    // Determine category
    let category = 'utility';
    if (group.includes('trigger')) category = 'triggers';
    else if (name.includes('postgres') || name.includes('mysql') || name.includes('mongo') || name.includes('redis')) category = 'storage';
    else if (name.includes('sheet') || name.includes('doc') || name.includes('airtable')) category = 'productivity';
    else if (name.includes('mail') || name.includes('slack') || name.includes('telegram') || name.includes('discord')) category = 'communication';
    else if (group.includes('transform')) category = 'core';

    // Prefix type with n8n-nodes-base
    const type = `n8n-nodes-base.${name}`;

    return {
        type,
        category,
        icon: lucideIcon,
        color: category === 'triggers' ? 'bg-green-500' : 'bg-blue-500', // Simplify colors
        label: { en: displayName, es: displayName },
        description: { en: description, es: description },
        inputs: [{ name: 'main', type: 'main' }],
        outputs: [{ name: 'main', type: 'main' }],
    };
}

const files = scanNodes(NODES_BASE_DIR);
console.log(`Found ${files.length} node files`);

const nodes = [];
const seenTypes = new Set(); // Prevent duplicates like name='manualTrigger' appearing in multiple files (v1, v2...)

files.forEach(f => {
    const node = extractNodeData(f);
    if (node && !seenTypes.has(node.type)) {
        nodes.push(node);
        seenTypes.add(node.type);
    }
});

console.log(`Extracted ${nodes.length} unique nodes`);

// Generate TS file content
const content = `
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NODES = ${JSON.stringify(nodes, null, 4)};

async function main() {
    console.log('Seeding ${nodes.length} Node Types from Scan...');
    for (const node of NODES) {
        await prisma.nodeType.upsert({
            where: { type: node.type },
            update: {
                category: node.category,
                icon: node.icon,
                color: node.color,
                label: node.label,
                description: node.description,
                inputs: node.inputs,
                outputs: node.outputs,
            },
            create: {
                type: node.type,
                category: node.category,
                icon: node.icon,
                color: node.color,
                label: node.label,
                description: node.description,
                inputs: node.inputs,
                outputs: node.outputs,
            },
        });
    }
    console.log('Node Types seeded successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
`;

fs.writeFileSync(OUTPUT_FILE, content);
console.log(`Generated ${OUTPUT_FILE}`);
