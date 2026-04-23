import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { logger } from '../services/logger.service';

// Enable tracing only if explicitly enabled in env
const isTracingEnabled = process.env.ENABLE_TRACING === 'true';

let sdk: NodeSDK | null = null;

if (isTracingEnabled) {
  // Configure Jaeger Exporter
  const exporter = new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  });

  sdk = new NodeSDK({
    // Service name is automatically detected from OTEL_SERVICE_NAME env var
    traceExporter: exporter,
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

  // Start the SDK
  try {
    sdk.start();
    logger.info('OpenTelemetry Tracing initialized');

    // Gracefully shut down the SDK on process exit
    process.on('SIGTERM', () => {
      sdk
        ?.shutdown()
        .then(() => logger.info('Tracing terminated'))
        .catch(error => logger.error('Error terminating tracing', { error: error as Error }))
        .finally(() => process.exit(0));
    });
  } catch (error) {
    logger.error('Failed to initialize OpenTelemetry Tracing', { error: error as Error });
  }
} else {
  logger.info('Tracing disabled (ENABLE_TRACING not set)');
}

export default sdk;
