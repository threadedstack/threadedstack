# Organizations

Organizations are the top-level container in Threaded Stack. Every resource in the platform -- projects, secrets, providers, agents, endpoints, API keys, domains -- belongs to an organization. An org's subscription tier determines the quotas and limits that govern all resources within it.

## The Shared Entity Model

The organization sits at the root of the ownership hierarchy:

```
Organization
├── Projects
│   ├── Endpoints
│   ├── Functions
│   ├── Secrets (project-scoped)
│   ├── Agents
│   │   ├── Threads
│   │   │   └── Messages
│   │   └── Agent Secrets
│   └── Domains
├── Secrets (org-scoped)
├── Providers (org-scoped, linked to agents via junction table)
├── API Keys
├── Domains
├── Roles (org membership)
├── Invitations
└── Quotas
```

The database schema reflects this with foreign key cascades. Every child table references `org_id` (a 10-character nanoid), and deletion of an org cascades to all owned resources. The `organizations` table itself is minimal:

| Column | Type | Description |
|--------|------|-------------|
| `id` | `varchar(10)` | Nanoid primary key |
| `name` | `text` | Required display name |
| `description` | `text` | Optional description |
| `owner_id` | `uuid` | FK to `users.id` -- the user whose subscription determines org limits |
| `created_at` | `timestamp` | Auto-set on creation |
| `updated_at` | `timestamp` | Auto-updated on modification |

Source: `repos/database/src/schemas/orgs.ts`

The domain model (`repos/domain/src/models/organization.ts`) is a thin wrapper extending `Base` with `name`, `ownerId`, and optional `description`.

## Org Lifecycle

### Creation

Any authenticated user can create an organization (`POST /_/orgs`). The creator is automatically assigned the `owner` role. If role assignment fails, the org is rolled back (deleted) to prevent orphaned orgs without owners.

Source: `repos/backend/src/endpoints/orgs/createOrg.ts`

Org creation is subject to the `organizations` quota limit from the creator's subscription tier. The `enforceQuota` middleware checks how many orgs the user already owns against their plan limit before allowing creation.

Source: `repos/backend/src/middleware/enforceQuota.ts`

### Retrieval

- **List orgs** (`GET /_/orgs`) -- Returns only orgs where the authenticated user has a role. Super admins see all orgs. Each org in the response includes the user's `userRole` for that org.
- **Get org** (`GET /_/orgs/:orgId`) -- Requires org membership (any role). Returns the org plus the user's role.

Source: `repos/backend/src/endpoints/orgs/listOrgs.ts`, `repos/backend/src/endpoints/orgs/getOrg.ts`

### Update and Deletion

- **Update** (`PUT /_/orgs/:orgId`) -- Requires `admin` role or higher.
- **Delete** (`DELETE /_/orgs/:orgId`) -- Requires `owner` role. Cascades to all child resources (projects, secrets, providers, roles, invitations, quotas).

Source: `repos/backend/src/endpoints/orgs/updateOrg.ts`, `repos/backend/src/endpoints/orgs/deleteOrg.ts`

## Members and Roles

Membership is represented by the `roles` table, which uses an exclusive arc pattern: each role row links a user to exactly one org OR one project (never both, enforced by a `CHECK` constraint).

Source: `repos/database/src/schemas/roles.ts`

### Role Hierarchy

Roles are strictly hierarchical. Higher roles inherit all permissions of lower roles:

| Level | Role | Description |
|-------|------|-------------|
| 0 | `viewer` | Read-only access to org resources |
| 1 | `member` | Create and edit resources (projects, agents, endpoints, threads) |
| 2 | `admin` | Manage members, secrets, providers, API keys, domains, settings |
| 3 | `owner` | Delete the org, remove users, transfer ownership |
| 4 | `super` | Platform-wide admin -- bypasses all permission checks |

Source: `repos/domain/src/types/permissions.types.ts`, `repos/domain/src/constants/values.ts`

### Permission Matrix

Every action on every resource type maps to a minimum required role. The full matrix is defined in `repos/domain/src/constants/values.ts` as `PermissionMatrix`. Key org-level permissions:

| Resource | create | read | update | delete | manage |
|----------|--------|------|--------|--------|--------|
| `org` | member | viewer | admin | owner | admin |
| `project` | member | viewer | member | admin | admin |
| `secret` | admin | member | admin | admin | admin |
| `apiKey` | admin | admin | admin | admin | admin |
| `provider` | admin | member | admin | admin | admin |
| `role` | admin | viewer | admin | owner | admin |
| `domain` | admin | member | admin | admin | admin |

Note: members can see secret *names* but not *values*. The `canAccessSecretValue()` utility restricts value access to `admin` and above.

Source: `repos/domain/src/utils/permissions/permissions.ts`

### Role Management Rules

The `canManageRole()` function enforces a strict downward-only rule: you can only manage roles with a level strictly below your own. An admin can manage members and viewers but not other admins or owners. Super admins can manage anyone.

- **Add member** (`POST /_/orgs/:orgId/members`) -- Requires `admin+`. Cannot assign a role at or above your own level.
- **Update member role** (`PUT /_/orgs/:orgId/members/:userId`) -- Requires `admin+`. Cannot promote someone to or above your own role, and cannot modify someone whose current role is at or above your own.
- **Remove member** (`DELETE /_/orgs/:orgId/members/:userId`) -- Requires `admin+`. Cannot remove owners (must transfer ownership first). Cannot remove someone with an equal or higher role.
- **List members** (`GET /_/orgs/:orgId/members`) -- Any org member (`viewer+`) can see the member list. Supports pagination via `limit` and `offset` query params.

When members are added or removed on plans that support additional seats (Pro and Team), the backend automatically updates the seat quantity on the Stripe subscription.

Source: `repos/backend/src/endpoints/orgs/addOrgMember.ts`, `repos/backend/src/endpoints/orgs/updateMemberRole.ts`, `repos/backend/src/endpoints/orgs/removeOrgMember.ts`, `repos/backend/src/endpoints/orgs/listOrgMembers.ts`

## Invitations

Invitations allow admins to add new users to an org, whether those users already have a Threaded Stack account or not. The invitation system is implemented across the `invitations` database table, the `Invitation` domain model, and dedicated backend endpoints.

### Invitation Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | `varchar(10)` | Nanoid primary key |
| `email` | `text` | Invitee's email (required) |
| `user_id` | `uuid` | FK to `users.id` (null for new users) |
| `role_type` | `text` | Role to assign on acceptance |
| `org_id` | `varchar(10)` | FK to `organizations.id` |
| `invited_by` | `uuid` | FK to `users.id` -- who sent it |
| `token` | `text` | Unique acceptance token |
| `status` | `text` | `pending`, `accepted`, `expired`, `revoked` |
| `expires_at` | `timestamp` | Expiration date (1-30 days, default 7) |
| `accepted_at` | `timestamp` | When the user accepted |
| `revoked_at` | `timestamp` | When an admin revoked it |
| `revoked_by` | `uuid` | FK to `users.id` -- who revoked it |

Source: `repos/database/src/schemas/invitations.ts`

### Invitation Lifecycle

**1. Create** (`POST /_/orgs/:orgId/users/invite`)

Requires `admin+` in the org. Body: `{ email, roleType, expiresInDays? }`.

Before creating an invitation, the endpoint:
- Validates the role type against `ERoleType` values
- Validates expiration days (1-30 range)
- Checks the requesting user's permission (`EPermAction.create` on `EPermResource.role`)
- Checks seat capacity against the org owner's subscription tier
- Checks for an existing pending invitation to the same email

Two paths diverge based on whether the invitee already has an account:

- **Existing user**: A role is created immediately, linking the user to the org. A notification email is sent. The response includes the new role.
- **New user**: A pending invitation record is created with a unique token. An invitation email is sent with a link to accept. The response includes the invitation.

Source: `repos/backend/src/endpoints/orgs/inviteOrgUser.ts`

**2. Accept** (`POST /_/invitations/accept`)

Requires authentication. Body: `{ token }`.

Validations:
- Token must match an existing invitation
- Invitation must be in `pending` status (not expired, revoked, or already accepted)
- Authenticated user's email must match the invitation's email (case-insensitive)
- User must not already be a member of the org

On success: creates the role, marks the invitation as accepted, and updates the Stripe seat quantity if the new member pushes past the included seats in the plan.

Source: `repos/backend/src/endpoints/invitations/acceptInvitation.ts`

**3. Revoke** (`DELETE /_/invitations/:invitationId`)

Requires `admin+` in the invitation's org. Only pending invitations can be revoked -- already accepted, expired, or revoked invitations return errors with specific messages.

Source: `repos/backend/src/endpoints/invitations/revokeInvitation.ts`

**4. List and Query**

- **List org invitations** (`GET /_/invitations/org/:orgId`) -- Requires `admin+`. Supports `status` query param: `pending` (default), `accepted`, `expired`, `revoked`, or `all`. Paginated.
- **Get my pending invitations** (`GET /_/invitations/me`) -- Authenticated endpoint. Returns all pending invitations sent to the current user's email, displayed on login so users can accept them.

Source: `repos/backend/src/endpoints/invitations/listInvitations.ts`, `repos/backend/src/endpoints/invitations/getPendingInvitations.ts`

### Invitation Domain Model

The `Invitation` class (`repos/domain/src/models/invitation.ts`) provides status-checking methods:

- `isPending()` -- Status is `pending` and not past expiration date
- `isExpired()` -- `expiresAt` is in the past
- `isAccepted()` -- Status is `accepted`
- `isRevoked()` -- Status is `revoked`
- `daysUntilExpiration()` -- Returns days remaining (negative if expired)
- `sanitize()` -- Returns a copy with the `token` field stripped (safe for API responses)

### Seat Capacity Enforcement

The Free and Solo tiers do not allow additional members (`additionalSeats: false`, `seats: 1`). Attempting to invite on these tiers returns a `403` directing the user to upgrade. Pro tier includes 3 seats with additional seats available. Team tier includes 10 seats with additional seats available. When a member joins or leaves on a plan with `additionalSeats: true`, the backend calls `payments.service.updateSeatQuantity()` to adjust the Stripe subscription.

## Projects

Projects are the primary unit of resource scoping within an org. Each project belongs to exactly one org via `org_id`, and the project name is unique within its org (enforced by a unique index on `(org_id, name)`).

### Project Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | `varchar(10)` | Nanoid primary key |
| `name` | `text` | Required, unique within org |
| `description` | `text` | Optional |
| `git_url` | `text` | Optional Git repository URL |
| `branch` | `text` | Git branch, defaults to `main` |
| `meta` | `jsonb` | Arbitrary metadata |
| `org_id` | `varchar(10)` | FK to `organizations.id`, cascades on delete |

Source: `repos/database/src/schemas/projects.ts`

### Project-Level Resources

Projects contain their own scoped resources, all managed through nested endpoints under `/_/orgs/:orgId/projects/:projectId/`:

- **Endpoints** -- API proxy, FaaS, and agent endpoints
- **Functions** -- Serverless function definitions
- **Secrets** -- Project-scoped secrets (separate from org-scoped secrets)
- **Agents** -- AI agents with per-project configuration
- **Domains** -- Custom domains for project endpoints
- **Members** -- Project-level role assignments (add, list, remove, update role)

Each of these sub-resources is protected by the `projectAccessGuard` middleware, which verifies the user has appropriate access to the project before proceeding.

Source: `repos/backend/src/endpoints/orgs/orgProjects.ts`

### Project Membership

Projects have their own role system via the same `roles` table. A role row with a `project_id` (and null `org_id`) represents project-level membership. The `role_scope_check` constraint ensures each role belongs to exactly one scope. Project members can be managed through dedicated endpoints: add, list, remove, and update role.

## Resource Propagation

Org-level resources are available to all projects within the org. This propagation follows a "config cascades downward" model:

### Secrets

Secrets use an exclusive arc pattern -- each secret belongs to exactly one of: org, project, provider, or agent. The database enforces this with a `CHECK` constraint (`secret_scope_check`) ensuring exactly one of `org_id`, `project_id`, `provider_id`, or `agent_id` is non-null (with one exception: an org+provider combination is allowed for provider secrets scoped to an org).

- **Org secrets** (`org_id` set) are accessible to all projects, agents, and endpoints within the org
- **Project secrets** (`project_id` set) are scoped to that project only
- **Provider secrets** (`provider_id` set) are tied to a specific provider configuration
- **Agent secrets** (`agent_id` set) are tied to a specific agent

The same CRUD endpoints (`listSecrets`, `getSecret`, `createSecret`, `updateSecret`, `deleteSecret`) serve both org-level and project-level contexts, mounted at both `/_/orgs/:orgId/secrets` and `/_/orgs/:orgId/projects/:projectId/secrets`.

Source: `repos/database/src/schemas/secrets.ts`, `repos/backend/src/endpoints/orgs/orgSecrets.ts`

### Providers

Providers (external service configurations like OpenAI, Anthropic, etc.) are org-scoped. Every provider references `org_id` and is available to all agents within the org through the `agentProviders` junction table. There is no project-level provider scoping; providers are shared across the entire org.

Source: `repos/database/src/schemas/providers.ts`, `repos/backend/src/endpoints/orgs/orgProviders.ts`

### Agents

Agents can exist at both the org level and the project level:

- **Org agents** (`/_/orgs/:orgId/agents`) -- Managed directly under the org, with threads and run capability
- **Project agents** (`/_/orgs/:orgId/projects/:projectId/agents`) -- Linked to a project with per-project configuration through the `agentProjects` junction table

Source: `repos/backend/src/endpoints/orgs/orgAgents.ts`

## Quotas

Resource usage is tracked per organization per billing period. The quota system has three components: the `quotas` database table for tracking current usage, the `PlanLimits` constant for defining tier limits, and the `enforceQuota` middleware for blocking requests that would exceed limits.

### Tracked Resources

The `quotas` table stores usage counters for the current billing period:

| Column | Type | Description |
|--------|------|-------------|
| `org_id` | `varchar(10)` | FK to `organizations.id` |
| `period` | `text` | Billing period identifier (e.g., `2026-04`) |
| `projects` | `integer` | Number of projects created |
| `compute` | `integer` | Compute units consumed |
| `threads` | `integer` | Conversation threads created |
| `messages` | `integer` | Messages sent |
| `endpoints` | `integer` | Endpoints configured |
| `secrets` | `integer` | Secrets stored |

A unique index on `(org_id, period)` ensures one quota record per org per period.

Source: `repos/database/src/schemas/quotas.ts`

### Plan Limits by Tier

Limits are determined by the org owner's subscription tier. The `PlanLimits` constant defines caps for each tier (`-1` means unlimited):

| Resource | Free | Solo | Pro | Team |
|----------|------|------|-----|------|
| `organizations` | 1 | 2 | 5 | unlimited |
| `projects` | 2 | 10 | 50 | unlimited |
| `compute` | 1,000 | 10,000 | 100,000 | unlimited |
| `threads` | 100 | 1,000 | unlimited | unlimited |
| `messages` | 500 | 10,000 | unlimited | unlimited |
| `endpoints` | 3 | 20 | unlimited | unlimited |
| `secrets` | 5 | 25 | unlimited | unlimited |
| `retention` (days) | 7 | 30 | 90 | 365 |
| `seats` | 1 | 1 | 3 | 10 |
| `additionalSeats` | no | no | yes | yes |

Source: `repos/domain/src/constants/plans.ts`, `repos/domain/src/types/payments.types.ts`

### Enforcement

The `enforceQuota` middleware runs on resource-creating POST requests. It maps the request path to a resource type, looks up the org owner's subscription tier, and compares current usage against the tier limit. If usage is at or over the limit, the request is rejected with a `403` response containing `{ error: "quota_exceeded", resource, current, limit }`.

The middleware handles org creation specially: instead of checking the `quotas` table, it counts the user's total owned orgs directly.

Enforcement is non-blocking for errors -- if the quota check itself fails (e.g., database unavailable), the request is allowed through and the error is logged. This prevents quota infrastructure issues from blocking all resource creation.

Source: `repos/backend/src/middleware/enforceQuota.ts`

### Quota Query Endpoints

Three endpoints under `/_/orgs/:orgId/quotas` provide quota visibility:

- **Get usage** (`getOrgQuota`) -- Returns the current period's usage counters
- **Get limits** (`GET /_/orgs/:orgId/quotas/limits`) -- Returns the plan limits for the org based on the owner's subscription tier
- **Check quota** (`POST /_/orgs/:orgId/quotas/check`) -- Checks whether a specific action is within limits. Body: `{ resource, amount? }`. Returns `{ allowed, current, limit, remaining }`.

All three require org membership (`viewer+` or above).

Source: `repos/backend/src/endpoints/orgs/orgQuotas.ts`, `repos/backend/src/endpoints/quotas/checkQuota.ts`, `repos/backend/src/endpoints/quotas/getOrgLimits.ts`

## Admin UI

The admin dashboard provides a full management interface for organizations:

- **Org list** (`/orgs`) -- Grid of org cards, create org drawer
- **Org dashboard** (`/orgs/:orgId`) -- Overview with sidebar navigation to sub-pages
- **Users** (`/orgs/:orgId/users`) -- Member grid with invite drawer, role management
- **Secrets** (`/orgs/:orgId/secrets`) -- Org-level secret management
- **Providers** (`/orgs/:orgId/providers`) -- Provider configuration
- **API Keys** (`/orgs/:orgId/api-keys`) -- API key management
- **Domains** (`/orgs/:orgId/domains`) -- Domain verification
- **Usage** (`/orgs/:orgId/usage`) -- Quota usage dashboard
- **Settings** (`/orgs/:orgId/settings`) -- Org settings
- **Projects** (`/orgs/:orgId/projects`) -- Project list with nested project pages

State is managed via Jotai atoms (`orgsState`, `orgUsersState`, `activeOrgIdState`, `activeOrgRoleState`, `activeOrgState`) with imperative accessors for use in actions/services and hook-based selectors for use in components.

Source: `.claude/skills/tdsk-admin/SKILL.md`
