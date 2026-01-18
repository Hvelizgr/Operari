# NanoFlow Architecture

NanoFlow uses a modular, microservices-ready architecture designed for scalability and isolation.

## System Overview

```mermaid
graph TD
    Client[Frontend (Next.js)] --> API[Backend API (Express)]
    API --> DB[(PostgreSQL)]
    API --> Redis[(Redis)]

    subgraph Execution Engine
    Queue[BullMQ]
    Worker[Worker Service]
    Sandbox[Isolated-VM]
    end

    API --> Queue
    Worker --> Queue
    Worker --> Sandbox
```

## Components

### 1. Frontend (`/frontend`)

- **Technology**: Next.js 15 (App Router).
- **Role**: Provides the visual editor (React Flow), dashboard, and management interface.
- **Key Features**:
  - Real-time collaboration.
  - Visual node editor.
  - Interactive terminal for execution logs.

### 2. Backend (`/backend`)

- **Technology**: Node.js/Express + TypeScript.
- **Role**: API Gateway logic, user management, and workflow orchestration.
- **Services**:
  - `NodeLoaderService`: Dynamic loading of community nodes.
  - `QueueService`: Manages job distribution using BullMQ.
  - `ExecutionService`: Orchestrates workflow runs.

### 3. Worker Engine

- **Role**: Consumes jobs from Redis and executes them safely.
- **Security**: Uses `isolated-vm` to prevent unsafe code execution from user scripts.

## Database Schema

NanoFlow uses **Prisma ORM**. Key models include:

- `Workflow`: Stores the JSON structure of nodes and connections.
- `Execution`: Logs historical runs and their states.
- `Credential`: Encrypted secrets for third-party integrations.
