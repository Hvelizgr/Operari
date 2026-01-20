/**
 * Script to generate n8n nodes cache with properties
 * Run: npx ts-node scripts/generate-n8n-cache.ts
 *
 * This script reads n8n node definitions from the local n8n package
 * and generates a cache file with all node metadata and properties.
 */

import * as fs from 'fs';
import * as path from 'path';

interface NodeProperty {
    name: string;
    displayName: string;
    type: string;
    default?: any;
    description?: string;
    options?: { name: string; value: string }[];
    typeOptions?: Record<string, any>;
    required?: boolean;
}

interface NodeDefinition {
    name: string;
    displayName: string;
    description?: string;
    icon?: string;
    group?: string[];
    version?: number;
    inputs?: string[];
    outputs?: string[];
    properties?: NodeProperty[];
    codex?: {
        categories?: string[];
    };
}

// Path to n8n nodes-base package
const N8N_NODES_PATH = path.resolve(__dirname, '../../others/n8n/packages/nodes-base/nodes');
const CACHE_OUTPUT_PATH = path.resolve(__dirname, '../data/cache/n8n-nodes.json');

// Regex patterns for extracting node metadata from TypeScript files
const PATTERNS = {
    displayName: /displayName:\s*['"`](.+?)['"`]/,
    name: /name:\s*['"`](.+?)['"`]/,
    icon: /icon:\s*['"`](.+?)['"`]/,
    description: /description:\s*['"`](.+?)['"`]/,
    group: /group:\s*\[([^\]]+)\]/,
    version: /version:\s*(\d+)/,
    defaultVersion: /defaultVersion:\s*(\d+)/,
    inputs: /inputs:\s*\[([^\]]+)\]/,
    outputs: /outputs:\s*\[([^\]]+)\]/,
};

// Extract string array from pattern match
function extractStringArray(content: string, pattern: RegExp): string[] {
    const match = content.match(pattern);
    if (!match) return [];

    const values = match[1]
        .split(',')
        .map(s => s.trim().replace(/['"`]/g, ''))
        .filter(s => s.length > 0);

    return values;
}

// Parse properties section from TypeScript file
function extractProperties(content: string): NodeProperty[] {
    const properties: NodeProperty[] = [];

    // Find the properties array section
    const propsMatch = content.match(/properties:\s*\[([\s\S]*?)\n\t\]/);
    if (!propsMatch) return properties;

    const propsContent = propsMatch[1];

    // Simple extraction of property objects
    const propRegex = /\{\s*(?:displayName|name):/g;
    const propStarts: number[] = [];
    let match;

    while ((match = propRegex.exec(propsContent)) !== null) {
        propStarts.push(match.index);
    }

    for (let i = 0; i < Math.min(propStarts.length, 20); i++) { // Limit to first 20 properties
        const start = propStarts[i];
        const end = propStarts[i + 1] || propsContent.length;
        const propStr = propsContent.slice(start, end);

        try {
            const nameMatch = propStr.match(/name:\s*['"`](\w+)['"`]/);
            const displayNameMatch = propStr.match(/displayName:\s*['"`]([^'"`]+)['"`]/);
            const typeMatch = propStr.match(/type:\s*['"`](\w+)['"`]/);
            const defaultMatch = propStr.match(/default:\s*['"`]?([^,\n\}]+?)['"`]?\s*[,\n\}]/);
            const descMatch = propStr.match(/description:\s*['"`]([^'"`]+)['"`]/);

            if (nameMatch && displayNameMatch && typeMatch) {
                const prop: NodeProperty = {
                    name: nameMatch[1],
                    displayName: displayNameMatch[1],
                    type: typeMatch[1],
                };

                if (defaultMatch) {
                    let defaultVal = defaultMatch[1].trim();
                    if (defaultVal === 'true') prop.default = true;
                    else if (defaultVal === 'false') prop.default = false;
                    else if (!isNaN(Number(defaultVal))) prop.default = Number(defaultVal);
                    else prop.default = defaultVal;
                }

                if (descMatch) {
                    prop.description = descMatch[1];
                }

                // Extract options for 'options' type
                if (typeMatch[1] === 'options') {
                    const optionsMatch = propStr.match(/options:\s*\[([\s\S]*?)\]/);
                    if (optionsMatch) {
                        const options: { name: string; value: string }[] = [];
                        const optionRegex = /name:\s*['"`]([^'"`]+)['"`][\s\S]*?value:\s*['"`]([^'"`]+)['"`]/g;
                        let optMatch;
                        while ((optMatch = optionRegex.exec(optionsMatch[1])) !== null) {
                            options.push({ name: optMatch[1], value: optMatch[2] });
                        }
                        if (options.length > 0) {
                            prop.options = options;
                        }
                    }
                }

                properties.push(prop);
            }
        } catch (e) {
            // Skip malformed properties
        }
    }

    return properties;
}

// Parse a single .node.ts file
function parseNodeFile(filePath: string): NodeDefinition | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check if it's a node type definition
        if (!content.includes('INodeType') && !content.includes('INodeTypeDescription')) {
            return null;
        }

        const nameMatch = content.match(PATTERNS.name);
        const displayNameMatch = content.match(PATTERNS.displayName);

        if (!nameMatch || !displayNameMatch) {
            return null;
        }

        const node: NodeDefinition = {
            name: nameMatch[1],
            displayName: displayNameMatch[1],
        };

        // Extract optional fields
        const descMatch = content.match(PATTERNS.description);
        if (descMatch) node.description = descMatch[1];

        const iconMatch = content.match(PATTERNS.icon);
        if (iconMatch) node.icon = iconMatch[1];

        node.group = extractStringArray(content, PATTERNS.group);

        const versionMatch = content.match(PATTERNS.version) || content.match(PATTERNS.defaultVersion);
        if (versionMatch) node.version = parseInt(versionMatch[1]);

        node.inputs = extractStringArray(content, PATTERNS.inputs) || ['main'];
        node.outputs = extractStringArray(content, PATTERNS.outputs) || ['main'];

        // Extract properties
        node.properties = extractProperties(content);

        // Try to get categories from .node.json if exists
        const jsonPath = filePath.replace('.node.ts', '.node.json');
        if (fs.existsSync(jsonPath)) {
            try {
                const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
                if (jsonContent.categories) {
                    node.codex = { categories: jsonContent.categories };
                }
            } catch (e) {
                // Ignore JSON parse errors
            }
        }

        return node;
    } catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
        return null;
    }
}

// Scan directory recursively for node files
function scanNodesDirectory(dir: string): NodeDefinition[] {
    const nodes: NodeDefinition[] = [];

    if (!fs.existsSync(dir)) {
        console.error(`Directory not found: ${dir}`);
        return nodes;
    }

    function scan(currentDir: string) {
        const files = fs.readdirSync(currentDir);

        for (const file of files) {
            const fullPath = path.join(currentDir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scan(fullPath);
            } else if (file.endsWith('.node.ts') && !file.includes('.test.')) {
                const node = parseNodeFile(fullPath);
                if (node) {
                    nodes.push(node);
                    console.log(`  Parsed: ${node.displayName} (${node.properties?.length || 0} properties)`);
                }
            }
        }
    }

    scan(dir);
    return nodes;
}

// Main execution
async function main() {
    console.log('=== n8n Nodes Cache Generator ===\n');
    console.log(`Scanning: ${N8N_NODES_PATH}`);
    console.log(`Output: ${CACHE_OUTPUT_PATH}\n`);

    // Ensure cache directory exists
    const cacheDir = path.dirname(CACHE_OUTPUT_PATH);
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Scan and parse nodes
    console.log('Scanning node files...\n');
    const nodes = scanNodesDirectory(N8N_NODES_PATH);

    // Remove duplicates by name
    const uniqueNodes = Array.from(
        new Map(nodes.map(n => [n.name, n])).values()
    );

    // Sort alphabetically
    uniqueNodes.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Write cache file
    fs.writeFileSync(CACHE_OUTPUT_PATH, JSON.stringify(uniqueNodes, null, 2));

    console.log(`\n=== Summary ===`);
    console.log(`Total nodes parsed: ${uniqueNodes.length}`);
    console.log(`Nodes with properties: ${uniqueNodes.filter(n => n.properties && n.properties.length > 0).length}`);
    console.log(`Cache saved to: ${CACHE_OUTPUT_PATH}`);
}

main().catch(console.error);
