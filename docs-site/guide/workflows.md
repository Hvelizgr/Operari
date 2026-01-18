# Workflows

A **Workflow** in NanoFlow represents a sequence of automated tasks. It is composed of **Nodes** connected by **Edges**.

## Anatomy of a Workflow

### Nodes

Nodes are the building blocks. Each node performs a specific action, such as:

- **Triggers**: Start the workflow (e.g., `Webhook`, `Schedule`, `On Form Submit`).
- **Actions**: Perform a task (e.g., `Send Email`, `HTTP Request`, `Read Database`).
- **Logic**: Control flow (e.g., `If`, `Switch`, `Merge`, `Code`).

### Edges (Connections)

Edges define the flow of data and execution order from one node to another.

## Creating a Workflow

1. Go to the **Workflows** dashboard.
2. Click **New Workflow**.
3. Drag and drop nodes from the sidebar onto the canvas.
4. Connect the output of one node to the input of another.
5. Click on a node to configure its parameters.

## Importing Workflows

You can import workflows directly from standard n8n JSON files. NanoFlow will attempt to convert and validate them against your active policies.
