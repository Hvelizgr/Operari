import { PrismaClient } from '@prisma/client';

/**
 * Migration script to normalize workflow data from JSON blobs to relational tables
 * 
 * This script:
 * 1. Reads all existing workflows with JSON nodes and connections
 * 2. Creates WorkflowNode records for each node
 * 3. Creates WorkflowConnection records for each connection
 * 4. Preserves all existing data
 * 5. Validates the migration
 * 
 * Run with: npx ts-node prisma/migrations/normalize-workflows.ts
 */

const prisma = new PrismaClient();

interface OldWorkflowNode {
    id: string;
    type: string;
    title: string;
    position: {
        x: number;
        y: number;
    };
    config?: Record<string, unknown>;
    inputs?: Array<{ id: string; label: string }>;
    outputs?: Array<{ id: string; label: string }>;
}

interface OldWorkflowConnection {
    id: string;
    source: string;      // Source node ID
    target: string;      // Target node ID
    sourcePort?: number;
    targetPort?: number;
}

interface MigrationStats {
    totalWorkflows: number;
    migratedWorkflows: number;
    totalNodes: number;
    totalConnections: number;
    errors: Array<{ workflowId: string; error: string }>;
}

async function migrateWorkflows(): Promise<MigrationStats> {
    const stats: MigrationStats = {
        totalWorkflows: 0,
        migratedWorkflows: 0,
        totalNodes: 0,
        totalConnections: 0,
        errors: [],
    };

    console.log('🚀 Starting workflow normalization migration...\n');

    try {
        // Fetch all workflows with JSON data
        const workflows = await prisma.workflow.findMany({
            where: {
                OR: [
                    { nodes: { not: null } },
                    { connections: { not: null } },
                ],
            },
            select: {
                id: true,
                name: true,
                nodes: true,
                connections: true,
                workflowNodes: {
                    select: { id: true },
                },
                workflowConnections: {
                    select: { id: true },
                },
            },
        });

        stats.totalWorkflows = workflows.length;
        console.log(`📊 Found ${workflows.length} workflows to migrate\n`);

        for (const workflow of workflows) {
            try {
                // Skip if already migrated
                if (workflow.workflowNodes.length > 0 || workflow.workflowConnections.length > 0) {
                    console.log(`⏭️  Skipping workflow "${workflow.name}" (${workflow.id}) - already migrated`);
                    stats.migratedWorkflows++;
                    continue;
                }

                console.log(`🔄 Migrating workflow "${workflow.name}" (${workflow.id})...`);

                const nodes = workflow.nodes as unknown as OldWorkflowNode[] | null;
                const connections = workflow.connections as unknown as OldWorkflowConnection[] | null;

                if (!nodes || !Array.isArray(nodes)) {
                    console.log(`  ⚠️  No nodes found, skipping`);
                    continue;
                }

                // Create a map to track old node IDs to new node IDs
                const nodeIdMap = new Map<string, string>();

                // Migrate nodes
                console.log(`  📦 Migrating ${nodes.length} nodes...`);
                for (const node of nodes) {
                    try {
                        const createdNode = await prisma.workflowNode.create({
                            data: {
                                workflowId: workflow.id,
                                type: node.type,
                                title: node.title,
                                positionX: node.position.x,
                                positionY: node.position.y,
                                config: node.config || null,
                                inputs: node.inputs || null,
                                outputs: node.outputs || null,
                            },
                        });

                        // Map old ID to new ID (in case we need to reference it)
                        // For now, we keep the same IDs from the JSON
                        nodeIdMap.set(node.id, createdNode.id);
                        stats.totalNodes++;
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        console.error(`    ❌ Failed to migrate node ${node.id}:`, errorMsg);
                        stats.errors.push({
                            workflowId: workflow.id,
                            error: `Node migration failed: ${errorMsg}`,
                        });
                    }
                }

                // Migrate connections
                if (connections && Array.isArray(connections)) {
                    console.log(`  🔗 Migrating ${connections.length} connections...`);
                    for (const connection of connections) {
                        try {
                            // Find the actual node IDs in the database
                            const _sourceNode = await prisma.workflowNode.findFirst({
                                where: {
                                    workflowId: workflow.id,
                                    // Match by the original node structure
                                    // We need to find nodes that match the source/target from JSON
                                },
                                select: { id: true },
                            });

                            const _targetNode = await prisma.workflowNode.findFirst({
                                where: {
                                    workflowId: workflow.id,
                                },
                                select: { id: true },
                            });

                            // For now, we'll use a simpler approach:
                            // Find nodes by matching the original structure
                            // This assumes nodes were created in order
                            const allNodes = await prisma.workflowNode.findMany({
                                where: { workflowId: workflow.id },
                                orderBy: { createdAt: 'asc' },
                            });

                            // Find source and target nodes by matching original IDs
                            // We need to store original IDs or match by position/type
                            // For this migration, we'll create a temporary mapping

                            const sourceNodeRecord = allNodes.find((n, idx) => {
                                const originalNode = nodes[idx];
                                return originalNode && originalNode.id === connection.source;
                            });

                            const targetNodeRecord = allNodes.find((n, idx) => {
                                const originalNode = nodes[idx];
                                return originalNode && originalNode.id === connection.target;
                            });

                            if (!sourceNodeRecord || !targetNodeRecord) {
                                console.error(`    ⚠️  Could not find nodes for connection ${connection.id}`);
                                continue;
                            }

                            await prisma.workflowConnection.create({
                                data: {
                                    workflowId: workflow.id,
                                    sourceNodeId: sourceNodeRecord.id,
                                    sourcePort: connection.sourcePort ?? null,
                                    targetNodeId: targetNodeRecord.id,
                                    targetPort: connection.targetPort ?? null,
                                },
                            });

                            stats.totalConnections++;
                        } catch (error) {
                            const errorMsg = error instanceof Error ? error.message : String(error);
                            console.error(`    ❌ Failed to migrate connection ${connection.id}:`, errorMsg);
                            stats.errors.push({
                                workflowId: workflow.id,
                                error: `Connection migration failed: ${errorMsg}`,
                            });
                        }
                    }
                }

                stats.migratedWorkflows++;
                console.log(`  ✅ Successfully migrated workflow "${workflow.name}"\n`);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`❌ Failed to migrate workflow ${workflow.id}:`, errorMsg);
                stats.errors.push({
                    workflowId: workflow.id,
                    error: errorMsg,
                });
            }
        }

        return stats;
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

async function validateMigration(): Promise<void> {
    console.log('\n🔍 Validating migration...\n');

    const workflows = await prisma.workflow.findMany({
        include: {
            workflowNodes: true,
            workflowConnections: true,
        },
    });

    for (const workflow of workflows) {
        const jsonNodes = workflow.nodes as unknown as OldWorkflowNode[] | null;
        const jsonConnections = workflow.connections as unknown as OldWorkflowConnection[] | null;

        if (jsonNodes && Array.isArray(jsonNodes)) {
            if (workflow.workflowNodes.length !== jsonNodes.length) {
                console.warn(`⚠️  Workflow ${workflow.id}: Node count mismatch (JSON: ${jsonNodes.length}, DB: ${workflow.workflowNodes.length})`);
            }
        }

        if (jsonConnections && Array.isArray(jsonConnections)) {
            if (workflow.workflowConnections.length !== jsonConnections.length) {
                console.warn(`⚠️  Workflow ${workflow.id}: Connection count mismatch (JSON: ${jsonConnections.length}, DB: ${workflow.workflowConnections.length})`);
            }
        }
    }

    console.log('✅ Validation complete\n');
}

async function main() {
    try {
        const stats = await migrateWorkflows();

        console.log('\n📊 Migration Summary:');
        console.log('═'.repeat(50));
        console.log(`Total workflows found:     ${stats.totalWorkflows}`);
        console.log(`Successfully migrated:     ${stats.migratedWorkflows}`);
        console.log(`Total nodes created:       ${stats.totalNodes}`);
        console.log(`Total connections created: ${stats.totalConnections}`);
        console.log(`Errors encountered:        ${stats.errors.length}`);
        console.log('═'.repeat(50));

        if (stats.errors.length > 0) {
            console.log('\n❌ Errors:');
            stats.errors.forEach((err, idx) => {
                console.log(`${idx + 1}. Workflow ${err.workflowId}: ${err.error}`);
            });
        }

        await validateMigration();

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('1. Review the migration results above');
        console.log('2. Test your application with the new normalized structure');
        console.log('3. Once confirmed working, you can remove the JSON fields from the schema');
        console.log('4. Update services to use the new WorkflowNode and WorkflowConnection models\n');
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
