# Data Model Relationship Alignment — Design Document

**Date**: 2026-02-20
**Status**: Approved
**Approach**: Layer-by-Layer (Domain → Database → Backend → Admin)

## 1. Target Relationships (Ground Truth)

These are the canonical relationships the system must enforce end-to-end:

| # | Relationship | Cardinality | Enforcement Mechanism |
|---|-------------|-------------|----------------------|
| R1 | User (owner) → Organizations | 1:N | `orgs.ownerId` FK |
| R2 | Organization → Providers | 1:N | `providers.orgId` FK |
| R3 | Organization → Projects | 1:N | `projects.orgId` FK |
| R4 | Organization → Members (Users) | N:M | `roles` table (orgId, exclusive arc) |
| R5 | Organization → Agents | 1:N | `agents.orgId` FK |
| R6 | Agent ↔ Providers (same Org, with priority) | N:M | `agentProviders` junction (priority field) |
| R7 | Agent ↔ Projects | N:M | `agentProjects` junction |
| R8 | Project → Members (Users) | N:M | `roles` table (projectId, exclusive arc) |
| R9 | User → Agents (only via project membership) | Derived | Backend middleware enforcement |
| R10 | User → Projects (only via org membership) | Derived | Backend middleware enforcement |

### Key Semantics

- **Agents are org-level resources** assigned to projects (not created within a single project)
- **Provider priority** determines fallback order: priority 0 = primary, 1+ = fallback
- **Project membership** gates agent access: users see only agents of projects they belong to (unless org admin+)
- **Org membership** gates project access: users see only projects of orgs they belong to

## 2. Current State — Gap Analysis

### What's Already Aligned

| Relationship | DB | Domain | Backend | Admin |
|-------------|:--:|:------:|:-------:|:-----:|
| R1: User → Orgs (owner) | ✅ | ✅ | ✅ | ✅ |
| R2: Org → Providers | ✅ | ✅ | ✅ | ✅ |
| R3: Org → Projects | ✅ | ✅ | ✅ | ✅ |
| R4: Org → Members | ✅ | ✅ | ✅ | ✅ |
| R5: Org → Agents | ✅ | ✅ | ✅ | ⚠️ No org-level page |
| R6: Agent ↔ Providers | ✅ | ⚠️ No priority | ⚠️ No priority | ⚠️ First=primary only |
| R7: Agent ↔ Projects | ✅ | ✅ | ✅ | ❌ No assignment UI |
| R8: Project → Members | ✅ | ✅ types | ❌ No endpoints | ❌ No UI |
| R9: User → Agents (scoped) | N/A | ✅ types | ❌ No enforcement | ❌ No filtering |
| R10: User → Projects (scoped) | N/A | ✅ types | ⚠️ Partial | ⚠️ Partial |

### Gaps Requiring Implementation

**G1 — Project Member Management (R8)**
- DB: `roles` table supports projectId (exclusive arc) ✅
- Domain: Role model supports projectId ✅
- Backend: No `/projects/:projectId/members` endpoints ❌
- Admin: No project members page or UI ❌

**G2 — Org-Level Agent Management (R5, R7)**
- Agents exist at org level in DB but admin only shows them under projects
- No admin page for `/orgs/:orgId/agents`
- Agent creation assumes single-project context; no multi-project assignment UI

**G3 — Provider Priority (R6)**
- DB: `agentProviders.priority` field exists ✅
- Domain: Agent.providers is `Provider[]` with no priority metadata ❌
- Backend: `providerIds[]` array uses implicit order, no explicit priority ❌
- Admin: "First selected = primary" — no reorder/priority UI ❌

**G4 — Agent Access Enforcement (R9)**
- Backend returns all org agents regardless of user's project membership
- No middleware check: "does user have a role in any of this agent's projects?"
- Admin shows all agents to all org members regardless of project membership

## 3. Implementation Design — Layer by Layer

### Phase 1: Domain (`repos/domain`)

**1a. Add provider priority to Agent model**

Create a `TAgentProvider` type that wraps Provider with priority:
```typescript
type TAgentProvider = {
  provider: Provider
  priority: number  // 0 = primary, 1+ = fallback
}
```

Update `Agent` model:
- Add `agentProviders: TAgentProvider[]` field (or adapt existing `providers[]`)
- `primaryProvider` getter uses priority=0 instead of index 0
- Constructor handles both formats (backward compat: plain Provider[] maps to index-based priority)

**1b. Add project member request/response types**

```typescript
type TProjectMemberRequest = {
  userId: string
  roleType: ERoleType
}

type TProjectMemberResponse = {
  id: string
  userId: string
  projectId: string
  type: ERoleType
  user?: User  // Populated for list responses
}
```

**1c. Ensure Agent create/update types support org-level creation**

- `TAgentCreateRequest`: `orgId` required, `projectIds` optional array
- `TAgentUpdateRequest`: `projectIds` optional (replaces all project associations)
- `providerIds` replaced by `providers: { id: string, priority: number }[]` (or ordered array)

**Tests**: Unit tests for Agent model with priority, new type instantiation.

---

### Phase 2: Database (`repos/database`)

**2a. Verify/fix agentProviders queries**

- Agent service `get()` and `list()` must return providers WITH priority, ordered by priority ASC
- Ensure `agentProviders` insert/update handles priority field
- Update agent service to accept `providers: { id, priority }[]` format on create/update

**2b. Add project member role service methods**

Add to roles service:
- `getProjectMembers(projectId)` — returns roles with type=projectId, joined with user data
- `addProjectMember(projectId, userId, roleType)` — inserts role with projectId
- `removeProjectMember(projectId, userId)` — soft-deletes role
- `updateProjectMemberRole(projectId, userId, roleType)` — updates role type

**2c. Verify agent queries support org-level listing with project filtering**

- `listAgentsByOrg(orgId, opts?)` — returns all agents in org
- `listAgentsByProject(projectId)` — returns agents via agentProjects junction
- `listAgentsByUserProjects(orgId, userId)` — returns agents in projects where user has a role (for access enforcement)

**Tests**: Unit tests for each new service method.

---

### Phase 3: Backend (`repos/backend`)

**3a. Add project member CRUD endpoints**

```
GET    /_/orgs/:orgId/projects/:projectId/members     — List project members
POST   /_/orgs/:orgId/projects/:projectId/members     — Add member (userId + roleType)
PUT    /_/orgs/:orgId/projects/:projectId/members/:userId — Update member role
DELETE /_/orgs/:orgId/projects/:projectId/members/:userId — Remove member
```

Permission: Requires `admin` role in org or project to manage members.
Constraint: User must be org member before being added to project.

**3b. Update agent endpoints for provider priority**

Modify `POST/PUT /_/orgs/:orgId/agents`:
- Accept `providers: [{ id: string, priority: number }]` (or ordered array where index = priority)
- Validate all providers belong to same org
- Validate all providers are type="ai"
- Store priority in agentProviders junction

**3c. Add project-membership-based agent access enforcement**

New middleware/helper: `requireAgentAccess(req, agentId)`:
1. If user is org admin+ → allow (admins see all)
2. Get agent's projects from agentProjects
3. Check user has role in at least one of those projects
4. If no match → 403

Apply to: agent get, agent list (filter results), agent run, threads/messages under agent.

For agent listing (`GET /_/orgs/:orgId/agents`):
- Org admins see all agents
- Members/viewers see only agents in their projects
- Use DB-level filtering (not post-fetch filter)

**3d. Org-level agent create/update**

- `POST /_/orgs/:orgId/agents` — create with `projectIds[]` (optional, can be empty)
- `PUT /_/orgs/:orgId/agents/:id` — update with `projectIds[]` (replaces associations)
- Remove project-scoped agent creation route if redundant (or keep as alias)

**Tests**: Unit tests for all new endpoints, access enforcement middleware.

---

### Phase 4: Admin (`repos/admin`)

**4a. Add project members page**

- Route: `/orgs/:orgId/projects/:projectId/members`
- Nav: Add "Members" item to project nav (ProjectNavItems)
- Components: Reuse `Users`/`UsersGrid` patterns from OrgUsers
- Features: List members, invite (from org members), change role, remove
- API service: `projectMembersApi.list()`, `.add()`, `.updateRole()`, `.remove()`

**4b. Add org-level agents page**

- Route: `/orgs/:orgId/agents`
- Nav: Add "Agents" item to org nav (OrgNavItems)
- Components: Agent list table showing name, model, primary provider, linked projects (as chips)
- Features: Create agent (opens drawer with org context), edit, delete
- Filter: If non-admin user, backend already filters to accessible agents

**4c. Update AgentDrawer for org-level context**

- Make project assignment a multi-select field (select from org's projects)
- When opened from project context, pre-select that project
- When opened from org context, no project pre-selected
- Provider selection: change from simple multi-select to orderable list

**4d. Add provider priority management**

- Replace current provider multi-select with an ordered list component
- Show providers as numbered items (1 = primary, 2+ = fallback)
- Drag-to-reorder or up/down arrows to change priority
- First item highlighted as "Primary"

**4e. Update project agent views**

- Project agents page shows only agents assigned to that project (already filtered by backend)
- Add "Assign Existing Agent" button to link an org agent to this project
- Show provider priority in agent detail (ordered list, not just primary)

**Tests**: Component tests for new pages if testing patterns exist in admin.

## 4. Validation Criteria

After implementation, each relationship must pass:

| # | Relationship | Validation |
|---|-------------|-----------|
| R1 | User → Orgs | Create org → ownerId set to current user |
| R2 | Org → Providers | Create provider under org → orgId FK set |
| R3 | Org → Projects | Create project under org → orgId FK set |
| R4 | Org → Members | Invite user → role created with orgId |
| R5 | Org → Agents | Create agent at org level → agents page shows it |
| R6 | Agent ↔ Providers | Assign 3 providers with priority → stored/returned correctly |
| R7 | Agent ↔ Projects | Assign agent to 2 projects → shows in both project pages |
| R8 | Project → Members | Add user as project member → they appear in project members list |
| R9 | User → Agents (scoped) | Non-admin user without project role → cannot see/access agent |
| R10 | User → Projects (scoped) | Non-org member → cannot see org's projects (403) |

## 5. Files Affected (Estimated)

**Domain** (~5 files):
- `models/agent.ts` — Priority support
- `types/agent.types.ts` — TAgentProvider, updated request types
- `types/role.types.ts` — Project member request/response types
- `models/agent.ts` constructor — Handle priority format

**Database** (~3-5 files):
- `services/roles.ts` — Project member methods
- `services/agents.ts` — Priority-aware queries, org-level listing
- Possibly `services/agentProviders.ts` if separated

**Backend** (~8-12 files):
- `endpoints/projectMembers.ts` — New CRUD endpoints
- `endpoints/agents.ts` — Priority support, access enforcement
- `middleware/agentAccess.ts` — New middleware
- `routes/` — Register new endpoints
- Tests for each

**Admin** (~10-15 files):
- `pages/Projects/ProjectMembers.tsx` — New page
- `pages/Orgs/OrgAgents.tsx` — New page
- `components/Agents/AgentDrawer.tsx` — Priority + project assignment
- `components/Agents/ProviderPriorityList.tsx` — New component
- `services/projectMembersApi.ts` — New API service
- `constants/nav.tsx` — New nav items
- `routes/Routes.tsx` — New routes
- `state/` — New atoms if needed
