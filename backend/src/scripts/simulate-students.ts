
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const _API_URL = process.env.API_URL || 'http://localhost:3000';

async function main() {
  console.log('🚀 Starting Student Simulation...');

  try {
    // 1. Create or get a test tenant
    let tenant = await prisma.tenant.findFirst({ where: { slug: 'simulation-school' } });
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: 'Simulation School',
          slug: 'simulation-school',
          plan: 'ENTERPRISE',
        },
      });
      console.log('✅ Created Tenant:', tenant.name);
    }

    // 2. Create 50 students
    const students = [];
    for (let i = 0; i < 50; i++) {
        const studentEmail = `student${i + 1}@school.edu`;
        let user = await prisma.user.findUnique({ where: { email: studentEmail } });
        
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: studentEmail,
                    passwordHash: 'hashed_password_simulation', // Mock
                    name: `Student ${i + 1}`,
                    role: 'USER',
                    tenantId: tenant.id,
                }
            });
        }
        students.push(user);
    }
    console.log(`✅ Loaded ${students.length} students.`);

    // 3. Simulate workflow submissions
    console.log('🔄 Simulating 100 workflow executions...');
    
    // Create a dummy workflow for testing
    const workflow = await prisma.workflow.create({
        data: {
            name: 'Homework Assignment 1',
            nodes: JSON.stringify([
                { id: '1', type: 'trigger.manual', position: { x: 100, y: 100 }, data: {} },
                { id: '2', type: 'action.code', position: { x: 300, y: 100 }, data: { code: 'return { result: "Pass" };' } }
            ]),
            connections: JSON.stringify([
                { id: 'c1', source: '1', target: '2' }
            ]),
            tenantId: tenant.id,
            userId: students[0].id, // Owner
            isActive: true,
        }
    });

    for (const student of students) {
        // Simulate execution call
        try {
            // Note: In a real scenario we would hit the API
            // await axios.post(`${API_URL}/api/workflows/${workflow.id}/execute`, {}, { headers: { 'Authorization': ... } });
            
            // For now, we manually create execution records to simulate load
            await prisma.execution.create({
                data: {
                    workflowId: workflow.id,
                    userId: student.id,
                    status: Math.random() > 0.1 ? 'SUCCESS' : 'FAILED',
                    trigger: 'MANUAL',
                    startedAt: new Date(),
                    completedAt: new Date(),
                    duration: Math.floor(Math.random() * 500) + 100,
                    metadata: { studentId: student.id, grade: Math.random() * 100 },
                }
            });
        } catch (e) {
            console.error(`Failed execution for ${student.email}`);
        }
    }
    
    console.log('✅ Simulation completed successfully.');

  } catch (error) {
    console.error('❌ Simulation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
