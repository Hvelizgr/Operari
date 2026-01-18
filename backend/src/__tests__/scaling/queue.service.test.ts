import { QueueService } from '../../scaling/queue.service';
import Queue from 'bull';

// Mock Bull
jest.mock('bull');

describe('QueueService', () => {
    let queueService: QueueService;
    const mockQueue = {
        add: jest.fn(),
        process: jest.fn(),
        on: jest.fn(),
        getJob: jest.fn(),
        clean: jest.fn(),
        close: jest.fn(),
        client: { status: 'ready' },
        count: jest.fn().mockReturnValue(0) // Mock count for double-init check
    };

    beforeEach(() => {
        // Reset singleton instance (hacky but needed for singleton testing if it doesn't have a reset)
        // Since it's a private static, we might just test the instance behavior or rely on fresh require if needed.
        // For now, let's assume we get the instance. 
        // Note: In real scenarios, adding a resetInstance method for testing is helpful.
        (Queue as unknown as jest.Mock).mockReturnValue(mockQueue);
        
        // We can't easily reset the private static instance in TS without ts-ignore or mapped types.
        // So we'll test the public API behaviors on the existing instance.
        queueService = QueueService.getInstance();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be a singleton', () => {
        const instance1 = QueueService.getInstance();
        const instance2 = QueueService.getInstance();
        expect(instance1).toBe(instance2);
    });

    it('should enqueue execution correctly', async () => {
        const params = {
            workflowId: 'wf-123',
            userId: 'user-1',
            trigger: 'MANUAL' as any
        };

        const mockJob = { id: 'job-1' };
        mockQueue.add.mockResolvedValue(mockJob);

        const result = await queueService.enqueueExecution(params);

        expect(mockQueue.add).toHaveBeenCalledWith(
            { params },
            expect.objectContaining({
                attempts: 3,
                removeOnComplete: true
            })
        );
        expect(result).toBe(mockJob);
    });

    it('should configure worker correctly', () => {
        // Reset initialization validation for test
        (queueService as any).workflowQueue = mockQueue;
        
        queueService.startWorker();

        // Since startWorker calls initializeWorker which calls process and on
        expect(mockQueue.process).toHaveBeenCalled();
        expect(mockQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
        expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('should handle queue cleaning', async () => {
        await queueService.cleanOldJobs();
        expect(mockQueue.clean).toHaveBeenCalledTimes(2);
    });
});
