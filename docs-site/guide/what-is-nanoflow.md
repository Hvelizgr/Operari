# What is NanoFlow?

NanoFlow is an **enterprise governance and education layer** built on top of the n8n workflow automation engine.

While n8n provides a powerful visual editor and execution engine, NanoFlow adds the control features required by large organizations and educational institutions.

## Key Features

### 🛡️ Governance & Policy Firewall

Prevent "Shadow IT" by enforcing rules before a workflow can run.

- **Node Blacklisting**: Prevent usage of dangerous nodes (e.g., `Execute Command`, `Function`).
- **Domain Whitelisting**: Restrict HTTP requests to approved domains only.
- **Pre-flight Checks**: Static analysis of workflows to detect secrets or bad practices.

### 🎓 Education & Grading

Built for classrooms and training.

- **Auto-Grading**: Automatically verify if a student's workflow produces the correct output.
- **Classroom Mode**: Multi-user isolation where students can't see or edit each other's work.

### 🔍 Observability (The "Workflow Doctor")

- **Execution Heatmaps**: Visualize where workflows spend the most time.
- **Audit Logs**: Trace who executed what, with full input/output capturing.
- **Version Snapshots**: Instant rollback to previous versions.

## Architecture

NanoFlow acts as a **proxy and orchestrator**. It sits between the user and the execution engine.

- **Frontend**: A Next.js based enhanced editor.
- **Backend API**: Manages users, policies, and queues executions.
- **Worker**: An isolated execution environment (using Bull + Redis) for scalability.
