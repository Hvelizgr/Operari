
import { NanoFlowNode, NanoFlowNodeInput, NanoFlowNodeOutput, NanoFlowNodeContext } from '../../packages/nanoflow-sdk';

export default class SlackPlugin extends NanoFlowNode {
    meta = {
        name: 'Slack (Plugin)',
        version: '1.0.0',
        description: 'Advanced Slack integration via Plugin System',
        author: 'NanoFlow',
        category: 'Communication',
        icon: 'slack'
    };

    async execute(input: NanoFlowNodeInput, context: NanoFlowNodeContext): Promise<NanoFlowNodeOutput> {
        context.log('Slack Plugin Executing...');
        const { webhookUrl, text } = input;

        if (!webhookUrl) throw new Error('Webhook URL missing');

        // We can use standard fetch or global axios if provided in context
        // For now, let's use a dynamic require of axios for simplicity
        const axios = require('axios');
        const res = await axios.post(webhookUrl, { text });

        return {
            status: res.status,
            success: true
        };
    }
}
