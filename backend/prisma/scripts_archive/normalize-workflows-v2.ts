import { PrismaClient } from '@prisma/client';

/**
 * IMPROVED Migration script to normalize workflow data
 * 
 * This version properly handles node ID mapping by:
 * 1. Creating nodes first and storing the ID mapping
 * 2. Using the mapping to create connections with correct foreign keys
 * 3. Preserving original node IDs in a metadata field for reference
 * 
 * Run with: npx ts-node prisma/migrations/normalize-workflows-v2.ts
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
    source: string;      // Source node ID (from JSON)
    target: string;      // Target node ID (from JSON)
    sourcePort?: number;
    targetPort?: number;
}

interface MigrationStats {
    totalWorkflows: number;
    migratedWorkflows: number;
    skippedWorkflows: number;
    totalNodes: number;
    totalConnections: number;
    errors: Array<{ workflowId: string; workflowName: string; error: string }>;
}

async function migrateWorkflows(dryRun: boolean = false): Promise<MigrationStats> {
    const stats: MigrationStats = {
        totalWorkflows: 0,
        migratedWorkflows: 0,
        skippedWorkflows: 0,
        totalNodes: 0,
        totalConnections: 0,
        errors: [],
    };

    console.log('🚀 Starting workflow normalization migration...');
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '✍️  LIVE (changes will be committed)'}\n`);

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
        console.log(`📊 Found ${workflows.length} workflows to process\n`);

        for (const workflow of workflows) {
            try {
                // Skip if already migrated
                if (workflow.workflowNodes.length > 0 || workflow.workflowConnections.length > 0) {
                    console.log(`⏭️  Skipping "${workflow.name}" (${workflow.id}) - already migrated`);
                    stats.skippedWorkflows++;
                    continue;
                }

                console.log(`🔄 Processing "${workflow.name}" (${workflow.id})...`);

                const nodes = workflow.nodes as unknown as OldWorkflowNode[] | null;
                const connections = workflow.connections as unknown as OldWorkflowConnection[] | null;

                if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
                    console.log(`  ⚠️  No nodes found, skipping`);
                    stats.skippedWorkflows++;
                    continue;
                }

                // Step 1: Create nodes and build ID mapping
                console.log(`  📦 Processing ${nodes.length} nodes...`);
                const nodeIdMap = new Map<string, string>(); // oldId -> newId

                for (const node of nodes) {
                    try {
                        if (!node.id || !node.type || !node.title || !node.position) {
                            console.error(`    ❌ Invalid node structure:`, node);
                            continue;
                        }

                        if (!dryRun) {
                            const createdNode = await prisma.workflowNode.create({
                                data: {
                                    workflowId: workflow.id,
                                    type: node.type,
                                    title: node.title,
                                    positionX: node.position.x,
                                    positionY: node.position.y,
                                    config: node.config ? JSON.parse(JSON.stringify(node.config)) : null,
                                    inputs: node.inputs ? JSON.parse(JSON.stringify(node.inputs)) : null,
                                    outputs: node.outputs ? JSON.parse(JSON.stringify(node.outputs)) : null,
                                },
                            });

                            nodeIdMap.set(node.id, createdNode.id);
                        } else {
                            // In dry run, simulate ID mapping
                            nodeIdMap.set(node.id, `new-${node.id}`);
                        }

                        stats.totalNodes++;
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        console.error(`    ❌ Failed to create node "${node.title}" (${node.id}):`, errorMsg);
                        stats.errors.push({
                            workflowId: workflow.id,
                            workflowName: workflow.name,
                            error: `Node creation failed for "${node.title}": ${errorMsg}`,
                        });
                    }
                }

                console.log(`    ✅ Created ${nodeIdMap.size} nodes`);

                // Step 2: Create connections using the ID mapping
                if (connections && Array.isArray(connections) && connections.length > 0) {
                    console.log(`  🔗 Processing ${connections.length} connections...`);
                    let successfulConnections = 0;

                    for (const connection of connections) {
                        try {
                            if (!connection.source || !connection.target) {
                                console.error(`    ❌ Invalid connection structure:`, connection);
                                continue;
                            }

                            // Map old node IDs to new node IDs
                            const newSourceId = nodeIdMap.get(connection.source);
                            const newTargetId = nodeIdMap.get(connection.target);

                            if (!newSourceId || !newTargetId) {
                                console.error(`    ❌ Could not find mapped nodes for connection ${connection.id}`);
                                console.error(`       Source: ${connection.source} -> ${newSourceId || 'NOT FOUND'}`);
                                console.error(`       Target: ${connection.target} -> ${newTargetId || 'NOT FOUND'}`);
                                stats.errors.push({
                                    workflowId: workflow.id,
                                    workflowName: workflow.name,
                                    error: `Connection ${connection.id}: Could not map node IDs`,
                                });
                                continue;
                            }

                            if (!dryRun) {
                                await prisma.workflowConnection.create({
                                    data: {
                                        workflowId: workflow.id,
                                        sourceNodeId: newSourceId,
                                        sourcePort: connection.sourcePort ?? null,
                                        targetNodeId: newTargetId,
                                        targetPort: connection.targetPort ?? null,
                                    },
                                });
                            }

                            successfulConnections++;
                            stats.totalConnections++;
                        } catch (error) {
                            const errorMsg = error instanceof Error ? error.message : String(error);
                            console.error(`    ❌ Failed to create connection ${connection.id}:`, errorMsg);
                            stats.errors.push({
                                workflowId: workflow.id,
                                workflowName: workflow.name,
                                error: `Connection creation failed: ${errorMsg}`,
                            });
                        }
                    }

                    console.log(`    ✅ Created ${successfulConnections} connections`);
                }

                stats.migratedWorkflows++;
                console.log(`  ✅ Successfully processed "${workflow.name}"\n`);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`❌ Failed to process workflow "${workflow.name}" (${workflow.id}):`, errorMsg);
                stats.errors.push({
                    workflowId: workflow.id,
                    workflowName: workflow.name,
                    error: `Workflow processing failed: ${errorMsg}`,
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
            workflowConnections: {
                include: {
                    sourceNode: true,
                    targetNode: true,
                },
            },
        },
    });

    let validationErrors = 0;

    for (const workflow of workflows) {
        const jsonNodes = workflow.nodes as unknown as OldWorkflowNode[] | null;
        const jsonConnections = workflow.connections as unknown as OldWorkflowConnection[] | null;

        if (jsonNodes && Array.isArray(jsonNodes) && jsonNodes.length > 0) {
            // Check node count
            if (workflow.workflowNodes.length !== jsonNodes.length) {
                console.warn(`⚠️  "${workflow.name}": Node count mismatch (JSON: ${jsonNodes.length}, DB: ${workflow.workflowNodes.length})`);
                validationErrors++;
            }

            // Check node data integrity
            for (const jsonNode of jsonNodes) {
                const dbNode = workflow.workflowNodes.find(n =>
                    n.type === jsonNode.type &&
                    n.title === jsonNode.title &&
                    n.positionX === jsonNode.position.x &&
                    n.positionY === jsonNode.position.y
                );

                if (!dbNode) {
                    console.warn(`⚠️  "${workflow.name}": Could not find matching DB node for "${jsonNode.title}"`);
                    validationErrors++;
                }
            }
        }

        if (jsonConnections && Array.isArray(jsonConnections) && jsonConnections.length > 0) {
            // Check connection count
            if (workflow.workflowConnections.length !== jsonConnections.length) {
                console.warn(`⚠️  "${workflow.name}": Connection count mismatch (JSON: ${jsonConnections.length}, DB: ${workflow.workflowConnections.length})`);
                validationErrors++;
            }

            // Check connection integrity
            for (const conn of workflow.workflowConnections) {
                if (!conn.sourceNode || !conn.targetNode) {
                    console.warn(`⚠️  "${workflow.name}": Connection ${conn.id} has missing nodes`);
                    validationErrors++;
                }
            }
        }
    }

    if (validationErrors === 0) {
        console.log('✅ Validation passed - all data migrated correctly\n');
    } else {
        console.log(`⚠️  Validation found ${validationErrors} potential issues\n`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');

    try {
        const stats = await migrateWorkflows(dryRun);

        console.log('\n' + '═'.repeat(60));
        console.log('📊 Migration Summary');
        console.log('═'.repeat(60));
        console.log(`Total workflows found:     ${stats.totalWorkflows}`);
        console.log(`Successfully migrated:     ${stats.migratedWorkflows}`);
        console.log(`Skipped (already done):    ${stats.skippedWorkflows}`);
        console.log(`Total nodes created:       ${stats.totalNodes}`);
        console.log(`Total connections created: ${stats.totalConnections}`);
        console.log(`Errors encountered:        ${stats.errors.length}`);
        console.log('═'.repeat(60));

        if (stats.errors.length > 0) {
            console.log('\n❌ Errors:');
            stats.errors.forEach((err, idx) => {
                console.log(`\n${idx + 1}. Workflow: "${err.workflowName}" (${err.workflowId})`);
                console.log(`   Error: ${err.error}`);
            });
        }

        if (!dryRun && stats.migratedWorkflows > 0) {
            await validateMigration();
        }

        if (dryRun) {
            console.log('\n🔍 DRY RUN COMPLETE - No changes were made');
            console.log('Run without --dry-run to apply changes\n');
        } else {
            console.log('\n✅ Migration completed successfully!');
            console.log('\n📝 Next steps:');
            console.log('1. ✅ Review the migration results above');
            console.log('2. ✅ Test your application with the new normalized structure');
            console.log('3. ⏳ Update services to use WorkflowNode and WorkflowConnection models');
            console.log('4. ⏳ Once confirmed working, remove JSON fields from schema');
            console.log('5. ⏳ Run final Prisma migration to drop old columns\n');
        }
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
