import Queue from 'bull';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function inspectQueue() {
    console.log('🔍 Inspecting Workflow Queue...');
    console.log(`📡 Redis URL: ${REDIS_URL}`);

    const queue = new Queue('workflow-executions', REDIS_URL);

    try {
        const counts = await queue.getJobCounts();
        console.log('\n📊 Job Counts:');
        console.table(counts);

        const failedJobs = await queue.getFailed();
        if (failedJobs.length > 0) {
            console.log(`\n❌ Found ${failedJobs.length} failed jobs:`);
            failedJobs.forEach(job => {
                console.log(`   - Job ${job.id}: ${job.failedReason}`);
                console.log(`     Data: ${JSON.stringify(job.data).substring(0, 100)}...`);
            });
        } else {
            console.log('\n✅ No failed jobs found.');
        }

        const activeJobs = await queue.getActive();
        if (activeJobs.length > 0) {
            console.log(`\n🏃 Found ${activeJobs.length} active jobs:`);
            activeJobs.forEach(job => {
                const data = job.data as any;
                console.log(`   - Job ${job.id}: Workflow ${data.params?.workflowId}`);
            });
        }

    } catch (error) {
        console.error('❌ Error inspecting queue:', error);
    } finally {
        await queue.close();
        process.exit(0);
    }
}

inspectQueue();
