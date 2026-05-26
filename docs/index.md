# Threaded Stack Documentation

Threaded Stack is an **AI operations layer** for companies integrating AI tools into their workflows. It sits alongside existing tooling and solves the governance, security, and sharing problems that come with deploying AI tools across an organization.

**Key differentiator:** "Bring your own AI tool, we make it secure and managed." Managed sandboxes run your AI tool of choice — Claude Code, Codex, OpenCode, or any tool that runs in a container. All traffic routes through a transparent MITM proxy, so the tool works normally but never sees real credentials.

**Quickest path to value:** Create an organization, pick a built-in sandbox preset (Claude Code, Codex, or OpenCode are seeded automatically), and run `tsa run <sandbox-id>` from your terminal. The CLI starts the sandbox, syncs your files, and launches the AI tool — all in one command.

---

## Architecture

- [Platform Overview](architecture/platform-overview.md) — How the platform works, entity model, and subscription tiers
- [Security Model](architecture/security-model.md) — How your data and credentials stay secure

## Features

- [Proxy Endpoints](features/proxy-endpoints.md) — Forward requests to external APIs with automatic credential injection
- [FaaS Endpoints](features/faas-endpoints.md) — Run serverless JavaScript/TypeScript functions via HTTP
- [Sandbox Connect](features/sandbox-connect.md) — Run AI tools in managed sandboxes with secure credential injection
- [Threads](features/threads.md) — Persistent conversations with branching and message history
- [Organizations](features/organizations.md) — Teams, roles, projects, and resource management
- [Secrets](features/secrets.md) — Encrypted credential storage with scoped access and automatic injection
- [Billing](features/billing.md) — Subscription tiers, quotas, and usage tracking
- [Providers](features/providers.md) — AI model provider configuration and credential management
- [API Keys](features/api-keys.md) — Programmatic API access with scoped permissions

## User Guide

- [Getting Started](user-guide/getting-started.md) — Zero to working API call
- [Admin Dashboard](user-guide/admin-ui.md) — Dashboard walkthrough
- [TSA CLI](user-guide/tsa-cli.md) — `tsa` CLI usage
- [Threads App](user-guide/threads-app.md) — Web interface for non-developers
- [Sandbox Usage](user-guide/sandbox-usage.md) — Sandbox setup, runtime selection, `tsa run`, SSH, file sync
- [API Reference](user-guide/api-reference.md) — REST endpoints, auth, request/response examples
