
export interface CostEntry {
    tenantId: string;
    projectId?: string;
    service: 'openai' | 'anthropic' | 'perplexity' | 'nanoflow_compute';
    model: string;
    tokensIn: number;
    tokensOut: number;
    estimatedCost: number;
    timestamp: Date;
    metadata?: any;
}

export class CostAllocationService {
    // Current prices per 1M tokens (GPT-4o mini example)
    private static readonly PRICING: Record<string, { in: number, out: number }> = {
        'gpt-4o-mini': { in: 0.15, out: 0.60 },
        'gpt-4o': { in: 5.00, out: 15.00 },
        'claude-3-5-sonnet': { in: 3.00, out: 15.00 },
    };

    static async trackUsage(data: Omit<CostEntry, 'estimatedCost' | 'timestamp'>): Promise<void> {
        const pricing = this.PRICING[data.model] || { in: 0, out: 0 };
        const cost = ((data.tokensIn / 1000000) * pricing.in) + ((data.tokensOut / 1000000) * pricing.out);

        console.log(`[CostAllocation] Tenant ${data.tenantId} used ${data.tokensIn + data.tokensOut} tokens on ${data.model}. Cost: $${cost.toFixed(6)}`);

        // Real implementation would save to a Usage/Billing table
        // await prisma.usageRecord.create({ ... });
    }

    static async getTenantReport(tenantId: string, startDate: Date, endDate: Date) {
        // Aggregation logic for billing
        return {
            tenantId,
            totalCost: 0,
            breakdown: [],
            period: { startDate, endDate }
        };
    }
}
