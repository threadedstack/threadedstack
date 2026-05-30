# Threaded Stack Documentation

Threaded Stack is a managed platform for running AI coding tools like Claude Code, Codex, OpenCode, Antigravity, and OpenClaw. It handles sandboxed execution, credential injection, and team collaboration so your engineering team can use AI tools without managing infrastructure or exposing secrets.

**Bring your own AI tool, we make it secure and managed.** Managed sandboxes run your AI tool of choice in isolated containers. All traffic routes through a transparent MITM proxy, so the tool works normally but never sees real credentials.

**Quickest path to value:** Create an organization, pick a built-in sandbox preset, and run `tsa run <sandbox-id>` from your terminal. The CLI starts the sandbox, syncs your files, and launches the AI tool in one command.

---

## Start Here

1. **[Getting Started](user-guide/getting-started.md)** -- Sign up and launch your first sandbox in 5 minutes
2. **[Sandbox Usage](user-guide/sandbox-usage.md)** -- Everything about sandboxes: runtimes, file sync, sessions
3. **[Security Model](architecture/security-model.md)** -- How credentials are protected end-to-end

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
