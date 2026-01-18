import { trace, Span, SpanStatusCode } from '@opentelemetry/api';
import { logger } from './logger.service';

export class TracingService {
    private static tracer = trace.getTracer('nanoflow-engine');

    static async traceNode(
        executionId: string,
        nodeId: string,
        nodeName: string,
        nodeType: string,
        fn: () => Promise<any>
    ) {
        return this.tracer.startActiveSpan(`node:${nodeType}`, async (span: Span) => {
            span.setAttribute('execution.id', executionId);
            span.setAttribute('node.id', nodeId);
            span.setAttribute('node.name', nodeName);
            span.setAttribute('node.type', nodeType);

            try {
                const result = await fn();
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error: any) {
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: error.message,
                });
                span.recordException(error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    static async traceWorkflow(executionId: string, workflowName: string, fn: () => Promise<any>) {
        return this.tracer.startActiveSpan(`workflow:${workflowName}`, async (span: Span) => {
            span.setAttribute('execution.id', executionId);
            try {
                const result = await fn();
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error: any) {
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: error.message,
                });
                span.recordException(error);
                throw error;
            } finally {
                span.end();
            }
        });
    }
}
