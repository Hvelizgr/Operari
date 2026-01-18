# Getting Started

Welcome to NanoFlow! This guide will help you get up and running with NanoFlow in minutes.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Hvelizgr/NanoFlow.git
   cd NanoFlow
   ```

2. Start the stack:

   ```bash
   docker-compose up -d
   ```

3. Access the dashboard:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Next Steps

Now that you have the platform running, let's create your first automation.

### Your First Workflow

1. Click on **"Create Workflow"** in the top right corner.
2. Drag a **"Manual Trigger"** node from the sidebar to the canvas.
3. Drag a **"Code"** node and connect it to the trigger.
4. Add the following JavaScript to the Code node:
   ```javascript
   return { message: 'Hello from NanoFlow!' };
   ```
5. Click **"Run Workflow"** to see the execution results in the terminal.

### Learn More

- [Understanding Workflows](./workflows)
- [Check our API Reference](../api/reference)
