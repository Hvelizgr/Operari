# Contributing to NanoFlow

Thank you for your interest in contributing to NanoFlow! We welcome contributions from everyone.

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This leads to more readable messages that are easy to follow when looking through the project history.

### Commit Config

We use **commitlint** to lint our commit messages. The configuration is defined in `commitlint.config.js`.

### Format

Each commit message consists of a **header**, a **body**, and a **footer**. The header has a special format that includes a **type**, a **scope**, and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **docs**: Documentation only changes
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation

### Example

```
feat(editor): add autosave functionality

- Implements a 2s debounce for autosave
- Adds local storage fallback
- Adds conflict detection with backend
```

## Setup

To help you follow these guidelines, we have provided a git message template. Configure it by running:

```bash
git config commit.template .gitmessage
```
