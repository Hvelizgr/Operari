# Executions

An **Execution** is a single run of a Workflow.

## Execution Modes

NanoFlow minimizes synchronous execution to ensure scalability.

### 1. Manual Execution (Debug)

- Triggered by clicking **"Run Workflow"** in the editor.
- **Priority:** High.
- **Feedback:** Real-time logs streamed via WebSockets to the editor.
- **Use Case:** Testing and development.

### 2. Triggered Execution (Production)

- Triggered by external events (Webhooks) or Schedules (Cron).
- **Priority:** Standard.
- **Mechanism:** The request is queued in **Redis**. A background **Worker** picks it up when resources are available.
- **Use Case:** High-volume production traffic.

## Execution States

- `QUEUED`: Accepted by the API and waiting for a worker.
- `RUNNING`: Currently being processed.
- `SUCCESS`: Completed successfully.
- `FAILED`: Encountered an error. (Check audit logs for trace).
- `CANCELLED`: Stopped manually by a user.

## Data Retention

By default, execution logs are retained for **30 days**. This can be configured in your Enterprise settings.
