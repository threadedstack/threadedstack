# Threaded Stack Documentation

Threaded Stack is an **AI operations layer** for companies integrating AI agents into their workflows. It sits alongside existing tooling and solves the governance, security, and sharing problems that come with deploying AI agents across an organization.

**Key differentiator:** "Bring your own AI tool, we make it secure and managed." Managed sandboxes run your AI tool of choice — Claude Code, Codex, OpenCode, or any tool that runs in a container. All traffic routes through a transparent MITM proxy, so the tool works normally but never sees real credentials.

**Quickest path to value:** Create an organization, pick a built-in sandbox preset (Claude Code, Codex, or OpenCode are seeded automatically), and run `tsa run <sandbox-id>` from your terminal. The CLI starts the sandbox, syncs your files, and launches the AI tool — all in one command.

---

## Architecture

- [Platform Overview](architecture/platform-overview.md) — Value prop, system topology, repo map, shared entity model
- [Request Flow](architecture/request-flow.md) — Full request lifecycle per endpoint type, auth flows
- [Data Model](architecture/data-model.md) — All schemas, relationships, exclusive arc pattern
- [Security Model](architecture/security-model.md) — JIT secret injection, encryption, MITM proxy, scoping
- [Sandbox Architecture](architecture/sandbox-architecture.md) — Providers, K8s pod lifecycle, MITM routing, agent hosting

## Features

- [Proxy Endpoints](features/proxy-endpoints.md) — Secure API proxying with secret injection
- [FaaS Endpoints](features/faas-endpoints.md) — Serverless function execution in sandboxes
- [Agent Endpoints](features/agent-endpoints.md) — AI agent lifecycle, execution paths, tool attachment
- [Sandbox Connect](features/sandbox-connect.md) — Managed sandboxes with runtime presets, SSH access, and file sync
- [Threads](features/threads.md) — Conversation model, messages, branching
- [Organizations](features/organizations.md) — Shared entity model, members, roles, invitations
- [Secrets](features/secrets.md) — Encryption, scoping, template syntax, flow through system
- [Billing](features/billing.md) — Stripe integration, tiers, quotas, subscription lifecycle

## User Guide

- [Getting Started](user-guide/getting-started.md) — Zero to working API call
- [Admin Dashboard](user-guide/admin-ui.md) — Dashboard walkthrough
- [TSA CLI](user-guide/tsa-cli.md) — `tsa` CLI usage
- [Threads App](user-guide/threads-app.md) — Web interface for non-developers
- [Sandbox Usage](user-guide/sandbox-usage.md) — Sandbox setup, runtime selection, `tsa run`, SSH, file sync
- [API Reference](user-guide/api-reference.md) — REST endpoints, auth, request/response examples

## Business

- [Value Proposition](business/value-proposition.md) — Positioning, problems, differentiators, target market
- [Go-To-Market](business/go-to-market.md) — Beta strategy, growth path, competitive landscape
- [Pricing](business/pricing.md) — Tiers, quotas, billing model

## Internal Reference

- [Local Development](meta/local.md)
- [SSL Setup](meta/ssl.md)
- [Environments](meta/environments.md)
- [Kubernetes Setup](tech/kube-setup.md)
