# API Keys

## What Are API Keys

API keys provide programmatic access to the Threaded Stack API. They are an alternative to JWT-based browser authentication, designed for CLI tools, scripts, and server-to-server integrations. All keys use the `tdsk_` prefix for easy identification.

## Creating an API Key

From the Admin UI:

1. Navigate to **API Keys** in the org sidebar (or within a project's sidebar for project-scoped keys).
2. Click **Create API Key**.
3. Enter a **name** for the key.
4. Select the **permission level** (`admin`, `write`, or `read`).
5. Optionally set an **expiration date**. Keys without an expiration remain valid until manually deactivated or deleted.
6. Optionally set a **rate limit** to cap the number of requests per time window.
7. Click **Create**.
8. **Copy the key immediately** -- it is shown only once and cannot be retrieved later.

## Key Scopes

Each API key has a permission level that determines what operations it can perform:

| Permission | Role Equivalent | What It Allows |
|------------|-----------------|----------------|
| `admin` | Admin | Full CRUD on all org resources — members, secrets, providers, settings |
| `write` | Member | Create and edit resources — projects, agents, endpoints, threads |
| `read` | Viewer | Read-only access to org resources |

Permission levels follow the same hierarchy as user roles. An `admin` key can do everything a `write` key can, plus administrative operations.

## Scoping Keys to Orgs or Projects

API keys are always scoped to control which resources they can access:

- **Org-scoped key**: Can access all resources within that organization, across all projects. This is the default when creating a key from the organization sidebar.
- **Project-scoped key**: Restricted to resources within a specific project. Cannot access other projects in the org or org-level resources outside that project. Create these from the project sidebar.

Use the narrowest scope that fits your use case. A CI pipeline that deploys to a single project should use a project-scoped key, not an org-wide key.

## Using API Keys

Include the API key in the `Authorization` header as a Bearer token:

```http
Authorization: Bearer tdsk_<api-key>
```

**Example -- list organizations:**

```bash
curl -H "Authorization: Bearer tdsk_<api-key>" \
  https://px.threadedstack.app/_/orgs
```

**Example -- create a thread:**

```bash
curl -X POST \
  -H "Authorization: Bearer tdsk_<api-key>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Thread"}' \
  https://px.threadedstack.app/_/orgs/<org-id>/agents/<agent-id>/threads
```

API keys work anywhere a JWT token would -- all authenticated endpoints accept both forms of authentication.

## Security

API keys are designed with defense in depth:

- **One-way hashing**: Keys are stored as SHA-256 hashes. The raw key cannot be recovered after creation -- if lost, delete the old key and create a new one.
- **Display prefix**: A short prefix is stored alongside the hash for identification in the UI (e.g., `tdsk_a1b2c3...`), so you can tell which key is which without exposing the full value.
- **Deactivation**: Keys can be deactivated without deleting them, allowing you to temporarily revoke access and re-enable later.
- **Expiration**: Keys can be set to expire on a specific date. Expired keys are automatically rejected.
- **Rate limiting**: Per-key rate limits prevent runaway scripts or compromised keys from overwhelming the API.
- **Usage tracking**: The last-used timestamp is updated automatically on each request, so you can identify stale keys that should be rotated or removed.

## Best Practices

- **Rotate keys regularly** -- create a new key, update your integrations, then delete the old one.
- **Use the narrowest scope** -- prefer `read` over `write`, and `write` over `admin`, unless the higher scope is required.
- **Set expirations** for keys used in temporary contexts (demos, short-lived CI jobs).
- **Never commit keys to source control** -- use environment variables or a secrets manager.
- **Monitor last-used timestamps** -- deactivate or delete keys that have not been used recently.

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/_/orgs/:orgId/api-keys` | List all API keys in the org |
| `POST` | `/_/orgs/:orgId/api-keys` | Create a new API key |
| `GET` | `/_/orgs/:orgId/api-keys/:id` | Get an API key (metadata only) |
| `PUT` | `/_/orgs/:orgId/api-keys/:id` | Update an API key (name, scope, rate limit, expiration) |
| `DELETE` | `/_/orgs/:orgId/api-keys/:id` | Delete an API key |

All API key endpoints require `admin` role or higher within the organization.
