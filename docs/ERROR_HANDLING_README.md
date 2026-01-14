# Error Handling System - Quick Reference

## Summary of Changes

### New Files
1. **`src/utils/retry.ts`** - Retry logic with exponential backoff
2. **`src/utils/error-persistence.ts`** - Error persistence utilities  
3. **`src/services/error-notification.service.ts`** - Error notification service

### Modified Files
1. **`src/services/execution.service.ts`** - Added error handling, logging, and notifications
2. **`src/services/node-executor.service.ts`** - Added retry logic and better error handling
3. **`src/types/workflow.types.ts`** - Added `retries` field to `HttpNodeConfig`

### Already Existing (Infrastructure)
- `src/errors/custom-error.ts` - Comprehensive error handling
- `src/services/logger.service.ts` - Structured logging
- `prisma/schema.prisma` - ExecutionError and ErrorNotificationConfig models

## Quick Start

### Using Retry Logic
```typescript
import { withHttpRetry, withExternalServiceRetry } from '@/utils/retry';

// HTTP request with automatic retries
const response = await withHttpRetry(
    () => fetch(url),
    'Fetch user data',
    { maxRetries: 3, initialDelay: 1000 }
);

// External service with retries
const result = await withExternalServiceRetry(
    () => emailService.send(email),
    'Email Service',
    { maxRetries: 2 }
);
```

### Persisting Errors
```typescript
import { persistExecutionError, getCriticalErrors } from '@/utils/error-persistence';

// Save error to database
await persistExecutionError(prisma, error, executionId, nodeLogId);

// Get critical errors
const criticalErrors = await getCriticalErrors(prisma, executionId);
```

### Notifying Errors
```typescript
import { ErrorNotificationService } from '@/services/error-notification.service';

const notifier = new ErrorNotificationService(prisma);

// Notify about error
await notifier.notifyError(error, executionId, errorId, tenantId);

// Emit internal event
await notifier.emitErrorEvent(error, executionId);
```

## Error Types

All errors extend `CustomError` and include:
- Standardized error code (`ErrorCode`)
- Developer and user-friendly messages
- Execution context (workflowId, nodeId, etc.)
- Original error reference (cause)
- Severity level (LOW, MEDIUM, HIGH, CRITICAL)
- Retryable flag

### Error Subclasses
- **`NodeExecutionError`** - Node execution failures
- **`HttpError`** - HTTP/network operations
- **`SandboxError`** - Code execution in sandbox
- **`ExternalServiceError`** - External services (email, database, etc.)
- **`WorkflowError`** - Workflow-level issues

## Configuration

### Environment Variables
```env
LOG_LEVEL=info              # Logging level
NODE_ENV=production         # Environment
SMTP_HOST=smtp.example.com  # Email config (optional)
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=password
```

### Webhook Notifications
Create error notification configs:
```typescript
await prisma.errorNotificationConfig.create({
    data: {
        tenantId: 'tenant-id',
        name: 'Critical Errors',
        type: 'WEBHOOK',
        webhookUrl: 'https://example.com/errors',
        minSeverity: 'HIGH',
        isActive: true,
    }
});
```

## Key Features

✅ **Automatic Retries** - HTTP and external service failures retry with exponential backoff  
✅ **Error Persistence** - All errors stored in database with full context  
✅ **Notifications** - Automatic alerts via webhooks and email  
✅ **Structured Logging** - Complete context captured in logs  
✅ **Cycle Detection** - Prevents infinite loops in workflows  
✅ **User Messages** - Friendly error messages for end users  

## Testing

```bash
cd api
npm run build  # Compile TypeScript
npx jest      # Run tests
```

## Architecture

```
Error occurs in Node
      ↓
  Wrap in CustomError
      ↓
  Persist to Database
      ↓
  If HIGH/CRITICAL:
  ├─ Send Notifications
  └─ Emit Events
      ↓
  Log with Context
      ↓
  Update Execution Status
```

For detailed implementation guide, see [ERROR_HANDLING_IMPLEMENTATION.md](../../ERROR_HANDLING_IMPLEMENTATION.md)
