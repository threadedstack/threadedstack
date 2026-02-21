# Data Model Relationship Alignment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure all sub-repos (domain, database, backend, admin) properly implement and expose the canonical data model relationships: Org→Agents (org-level), Agent↔Providers (with priority), Agent↔Projects (many-to-many), Project→Members, and project-membership-based agent access enforcement.

**Architecture:** Layer-by-layer (Domain → Database → Backend → Admin). Each layer is tested and stable before the next depends on it. Database already has most infrastructure (junction tables, role service methods). Main work is backend endpoints, access enforcement, and admin UI.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), Express 5, React + MUI + Jotai, Vitest

**Design Doc:** `docs/plans/2026-02-20-data-model-alignment-design.md`

**CRITICAL GIT RULE:** NEVER commit, amend, revert, or change git history. Read-only git operations ONLY. User handles all commits manually.

---

## Phase 1: Domain Types (`repos/domain`)

### Task 1: Add TAgentProvider type with priority

**Files:**
- Modify: `repos/domain/src/types/agent.types.ts` (create if not exists)
- Modify: `repos/domain/src/models/agent.ts`
- Test: `repos/domain/src/models/__tests__/agent.test.ts` (find existing or create co-located)

**Context:** The DB `agentProviders` junction has a `priority` field (0=primary, 1+=fallback). The Agent model currently stores `providers: Provider[]` with no priority metadata. The DB service already sorts by priority and the backend passes `providerIds[]` (ordered array where index = priority). We need the domain to be aware of priority so the admin UI can display/manage it.

**Step 1: Check if agent types file exists**

Run: `ls repos/domain/src/types/agent.types.ts 2>/dev/null || echo "DOES NOT EXIST"`

If it doesn't exist, check the barrel export at `repos/domain/src/types/index.ts` for existing agent type exports.

**Step 2: Add TAgentProvider type**

Add to `repos/domain/src/types/agent.types.ts` (create if needed):

```typescript
import type { Provider } from '@TDM/models'

/**
 * Agent-Provider relationship with priority.
 * Priority 0 = primary provider, 1+ = fallback providers.
 * Stored in agentProviders junction table.
 */
export type TAgentProvider = {
  provider: Provider
  priority: number
}
```

Export from the types barrel (`repos/domain/src/types/index.ts`) if not auto-exported.

**Step 3: Update Agent model to track priority**

Modify `repos/domain/src/models/agent.ts`:

The current `providers: Provider[]` field stays as-is for backward compatibility (existing code depends on it). Add a parallel `providerPriorities: number[]` array that tracks the priority of each provider at the same index. This is simpler than changing every consumer.

```typescript
import type { TAgentProvider } from '@TDM/types'

export class Agent extends Base {
  // ... existing fields ...
  providers: Provider[] = []
  providerPriorities: number[] = []

  constructor(agent: Partial<Agent>) {
    super()
    const { secrets, functions, providers, providerPriorities, projects, ...rest } = agent

    // Build provider priority mapping
    const priorities = providerPriorities || []

    Object.assign(this, {
      ...rest,
      providerPriorities: priorities,
      secrets: secrets?.map((secret) =>
        secret instanceof Secret ? secret : new Secret(secret)
      ) || [],
      functions: functions?.map((fn) =>
        fn instanceof FunctionModel ? fn : new FunctionModel(fn)
      ) || [],
      projects: projects?.map((project) =>
        project instanceof Project ? project : new Project(project)
      ) || [],
      providers: providers?.map((prov) =>
        prov instanceof Provider ? prov : new Provider(prov)
      ) || [],
    })
  }

  get primaryProvider(): Provider | undefined {
    return this.providers?.[0]
  }

  /** Get providers with their priorities as TAgentProvider[] */
  get agentProviders(): TAgentProvider[] {
    return this.providers.map((provider, i) => ({
      provider,
      priority: this.providerPriorities[i] ?? i,
    }))
  }

  sanitize = () => {
    return new Agent({
      ...this,
      secrets: this.secrets.map((secret) => secret.sanitize()),
    })
  }
}
```

**Step 4: Write test for Agent model priority**

Find existing agent tests: `ls repos/domain/src/models/__tests__/agent* repos/domain/src/**/*agent*.test.* 2>/dev/null`

Add test (co-located with existing pattern):

```typescript
import { describe, it, expect } from 'vitest'
import { Agent } from '../agent'
import { Provider } from '../provider'

describe('Agent', () => {
  describe('provider priority', () => {
    it('should store providerPriorities alongside providers', () => {
      const agent = new Agent({
        name: 'test',
        orgId: 'org-1',
        providers: [
          new Provider({ id: 'p1', orgId: 'org-1', type: 'ai', brand: 'openai' }),
          new Provider({ id: 'p2', orgId: 'org-1', type: 'ai', brand: 'anthropic' }),
        ],
        providerPriorities: [0, 1],
      })

      expect(agent.providers).toHaveLength(2)
      expect(agent.providerPriorities).toEqual([0, 1])
      expect(agent.primaryProvider?.id).toBe('p1')
    })

    it('should return agentProviders with priority metadata', () => {
      const agent = new Agent({
        name: 'test',
        orgId: 'org-1',
        providers: [
          new Provider({ id: 'p1', orgId: 'org-1', type: 'ai', brand: 'openai' }),
          new Provider({ id: 'p2', orgId: 'org-1', type: 'ai', brand: 'anthropic' }),
        ],
        providerPriorities: [0, 1],
      })

      const aps = agent.agentProviders
      expect(aps).toHaveLength(2)
      expect(aps[0].provider.id).toBe('p1')
      expect(aps[0].priority).toBe(0)
      expect(aps[1].provider.id).toBe('p2')
      expect(aps[1].priority).toBe(1)
    })

    it('should default priorities to index when not provided', () => {
      const agent = new Agent({
        name: 'test',
        orgId: 'org-1',
        providers: [
          new Provider({ id: 'p1', orgId: 'org-1', type: 'ai', brand: 'openai' }),
        ],
      })

      expect(agent.providerPriorities).toEqual([])
      expect(agent.agentProviders[0].priority).toBe(0) // falls back to index
    })
  })
})
```

**Step 5: Run domain tests**

Run: `cd repos/domain && pnpm test`
Expected: All existing tests pass + new priority tests pass.

---

### Task 2: Verify Database Agent Service Returns Priority

**Files:**
- Read: `repos/database/src/services/agent.ts` (verify, likely minor change needed)

**Context:** The database agent service already sorts providers by priority and the `setProviders` method assigns priority by array index. We need to verify that the `model()` method passes priority data through to the domain Agent model.

**Step 1: Read the agent service model() method**

Read `repos/database/src/services/agent.ts` and find the `model()` method. Check if it passes `providerPriorities` to the Agent constructor.

**Step 2: Update model() to pass providerPriorities**

The current `model()` likely maps `opts.providers` to Provider instances and discards the priority field. Update it to also pass priorities:

In the `model()` method of `repos/database/src/services/agent.ts`, after the providers are sorted by priority, extract the priority values:

```typescript
// In model() method, after sorting providers by priority:
const sortedProviders = opts.providers
  ?.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

// Pass both providers and their priorities to Agent constructor
return new AgentModel({
  ...data,
  // ... existing mappings ...
  providerPriorities: sortedProviders?.map(p => p.priority ?? 0) || [],
  providers: sortedProviders?.map(p => /* existing provider mapping */) || [],
})
```

**Step 3: Run database tests**

Run: `cd repos/database && pnpm test`
Expected: All existing tests pass.

---

## Phase 2: Backend Endpoints (`repos/backend`)

### Task 3: Add Project Member CRUD Endpoints

**Files:**
- Create: `repos/backend/src/endpoints/projects/listProjectMembers.ts`
- Create: `repos/backend/src/endpoints/projects/addProjectMember.ts`
- Create: `repos/backend/src/endpoints/projects/updateProjectMemberRole.ts`
- Create: `repos/backend/src/endpoints/projects/removeProjectMember.ts`
- Modify: `repos/backend/src/endpoints/orgs/orgProjects.ts` (register new endpoints)
- Test: `repos/backend/src/endpoints/projects/projectMembers.test.ts`

**Context:** The database `roles` service already has all project member methods (`getProjectMembers`, `getProjectRole`, `updateProjectRole`, `removeFromProject`, `isProjectMember`). We just need Express endpoints that mirror the org member endpoints pattern. Endpoints mount at `/_/orgs/:orgId/projects/:projectId/members`.

**Reference files for pattern:**
- `repos/backend/src/endpoints/orgs/addOrgMember.ts` (template for add)
- `repos/backend/src/endpoints/orgs/listOrgMembers.ts` (template for list)
- `repos/backend/src/endpoints/orgs/updateMemberRole.ts` (template for update)
- `repos/backend/src/endpoints/orgs/removeOrgMember.ts` (template for remove)

**Step 3a: Create listProjectMembers.ts**

Create `repos/backend/src/endpoints/projects/listProjectMembers.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'
import { parsePagination } from '@TBE/utils/pagination'

/**
 * GET /orgs/:orgId/projects/:projectId/members - List all members of a project
 * Requires org membership (viewer+) to see project members
 */
export const listProjectMembers: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId, projectId } = req.params
    const { db } = req.app.locals

    if (!projectId) throw new Exception(400, `projectId parameter required`)

    // Must be org member to view project members
    await requireOrgMember(req, orgId)

    const { limit, offset } = parsePagination(req)
    const { data, error } = await db.services.role.getProjectMembers(projectId)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data, limit, offset })
  },
}
```

**Step 3b: Create addProjectMember.ts**

Create `repos/backend/src/endpoints/projects/addProjectMember.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import { ERoleType, EPermAction, EPermResource, canManageRole } from '@tdsk/domain'

/**
 * POST /orgs/:orgId/projects/:projectId/members - Add a member to a project
 * Requires admin+ role in org or project to add members
 * User must already be org member before being added to project
 */
export const addProjectMember: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId, projectId } = req.params
    const { db } = req.app.locals
    const { userId, type = ERoleType.member } = req.body
    const currentUserId = req.user?.id

    if (!currentUserId) throw new Exception(401, `Authentication required`)
    if (!userId) throw new Exception(400, `userId is required`)
    if (!projectId) throw new Exception(400, `projectId is required`)

    // Check permission (requires admin+ to manage project members)
    await checkPermission(req, EPermAction.manage, EPermResource.project, { orgId, projectId })

    // Verify target user is an org member first
    const { data: isOrgMember } = await db.services.role.isOrgMember(userId, orgId)
    if (!isOrgMember)
      throw new Exception(400, `User must be an organization member before being added to a project`)

    // Check current user's role to validate role assignment
    const currentUserRole = await getUserRole(req, { orgId, projectId })
    const targetRole = type as ERoleType

    if (!canManageRole(currentUserRole, targetRole))
      throw new Exception(
        403,
        `You cannot add a member with ${targetRole} role. You can only add members with roles below your own.`,
        `FORBIDDEN`
      )

    // Check if project exists
    const { data: project, error: projError } = await db.services.project.get(projectId)
    if (projError) throw new Exception(500, projError.message)
    if (!project) throw new Exception(404, `Project not found`)

    // Create role (project membership)
    const { data, error } = await db.services.role.create({
      projectId,
      userId,
      type: targetRole,
    })

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
```

**Step 3c: Create updateProjectMemberRole.ts**

Create `repos/backend/src/endpoints/projects/updateProjectMemberRole.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import type { ERoleType } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource, canManageRole } from '@tdsk/domain'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PUT /orgs/:orgId/projects/:projectId/members/:userId - Update project member role
 * Requires admin+ role to change member roles
 */
export const updateProjectMemberRole: TEndpointConfig = {
  path: `/:userId`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId, projectId, userId } = req.params
    const { db } = req.app.locals
    const { type: newRoleType } = req.body
    const currentUserId = req.user?.id

    if (!currentUserId) throw new Exception(401, `Authentication required`)
    if (!newRoleType) throw new Exception(400, `Role type is required`)

    await checkPermission(req, EPermAction.manage, EPermResource.project, { orgId, projectId })

    const currentUserRole = await getUserRole(req, { orgId, projectId })
    const targetRole = newRoleType as ERoleType

    if (!canManageRole(currentUserRole, targetRole))
      throw new Exception(
        403,
        `You cannot assign ${targetRole} role. You can only assign roles below your own.`,
        `FORBIDDEN`
      )

    const { error: roleError, data: existing } = await db.services.role.getProjectRole(userId, projectId)
    if (roleError) throw new Exception(500, roleError.message)
    if (!existing) throw new Exception(404, `Project member not found`)

    if (!canManageRole(currentUserRole, existing.type as ERoleType))
      throw new Exception(
        403,
        `You cannot modify roles of members with equal or higher roles than your own.`,
        `FORBIDDEN`
      )

    const { data, error } = await db.services.role.updateProjectRole(userId, projectId, targetRole)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
```

**Step 3d: Create removeProjectMember.ts**

Create `repos/backend/src/endpoints/projects/removeProjectMember.ts`:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import { ERoleType, EPermAction, EPermResource, canManageRole } from '@tdsk/domain'

/**
 * DELETE /orgs/:orgId/projects/:projectId/members/:userId - Remove project member
 * Requires admin+ role to remove members
 */
export const removeProjectMember: TEndpointConfig = {
  path: `/:userId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId, projectId, userId } = req.params
    const { db } = req.app.locals
    const currentUserId = req.user?.id

    if (!currentUserId) throw new Exception(401, `Authentication required`)

    await checkPermission(req, EPermAction.manage, EPermResource.project, { orgId, projectId })

    const { data: targetRole, error: roleError } =
      await db.services.role.getProjectRole(userId, projectId)

    if (roleError) throw new Exception(500, roleError.message)
    if (!targetRole) throw new Exception(404, `Project member not found`)

    if (targetRole.type === ERoleType.owner)
      throw new Exception(403, `Cannot remove project owner. Transfer ownership first.`, `FORBIDDEN`)

    const currentUserRole = await getUserRole(req, { orgId, projectId })
    if (!canManageRole(currentUserRole, targetRole.type as ERoleType))
      throw new Exception(
        403,
        `You cannot remove members with equal or higher roles than your own.`,
        `FORBIDDEN`
      )

    const { data, error } = await db.services.role.delete(targetRole.id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
```

**Step 3e: Register project member endpoints in orgProjects.ts**

Modify `repos/backend/src/endpoints/orgs/orgProjects.ts`:

Add imports and a `projectMembers` nested endpoint config:

```typescript
import { listProjectMembers } from '@TBE/endpoints/projects/listProjectMembers'
import { addProjectMember } from '@TBE/endpoints/projects/addProjectMember'
import { updateProjectMemberRole } from '@TBE/endpoints/projects/updateProjectMemberRole'
import { removeProjectMember } from '@TBE/endpoints/projects/removeProjectMember'

const projectMembers: TEndpointConfig = {
  path: `/:projectId/members`,
  method: EPMethod.Use,
  endpoints: {
    listProjectMembers,
    addProjectMember,
    updateProjectMemberRole,
    removeProjectMember,
  },
}
```

Add `projectMembers` to `orgProjects.endpoints` alongside existing entries like `projectEndpoints`, `projectAgents`, etc.

**Step 3f: Write tests for project member endpoints**

Create `repos/backend/src/endpoints/projects/projectMembers.test.ts`. Follow the existing test pattern from similar test files. Test cases:

1. List project members (200 + returns members)
2. Add project member (201 + creates role with projectId)
3. Add non-org-member to project (400 error)
4. Update project member role (200 + role changed)
5. Remove project member (200 + role deleted)
6. Permission: non-admin cannot manage members (403)
7. Permission: cannot escalate role above own (403)

**Step 3g: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All existing tests pass + new project member tests pass.

---

### Task 4: Add Agent Access Enforcement Middleware

**Files:**
- Create: `repos/backend/src/utils/auth/requireAgentAccess.ts`
- Modify: `repos/backend/src/endpoints/agents/getAgent.ts`
- Modify: `repos/backend/src/endpoints/agents/listAgents.ts`
- Test: `repos/backend/src/utils/auth/requireAgentAccess.test.ts`

**Context:** Currently any org member can list/access all agents in the org. Per the design, non-admin users should only see agents that belong to projects they're members of. Org admins+ bypass this restriction.

**Step 4a: Create requireAgentAccess utility**

Create `repos/backend/src/utils/auth/requireAgentAccess.ts`:

```typescript
import type { TRequest } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { ERoleType, hasMinRole } from '@tdsk/domain'

/**
 * Check if the current user can access an agent based on project membership.
 * Org admins+ can access all agents. Members/viewers must be in at least
 * one of the agent's projects.
 */
export const requireAgentAccess = async (
  req: TRequest,
  agentId: string,
  orgId: string
): Promise<void> => {
  const { db } = req.app.locals
  const userId = req.user?.id

  if (!userId) throw new Exception(401, `Authentication required`)

  // Org admins+ can access all agents
  const userRole = await getUserRole(req, { orgId })
  if (hasMinRole(userRole, ERoleType.admin)) return

  // Get the agent's projects
  const { data: agent, error } = await db.services.agent.get(agentId)
  if (error || !agent) throw new Exception(404, `Agent not found`)

  // If agent has no projects, only admins can access (already returned above)
  if (!agent.projects?.length)
    throw new Exception(403, `You do not have access to this agent`)

  // Check if user is a member of any of the agent's projects
  for (const project of agent.projects) {
    const { data: isMember } = await db.services.role.isProjectMember(userId, project.id)
    if (isMember) return
  }

  throw new Exception(403, `You do not have access to this agent`)
}
```

**Step 4b: Update getAgent.ts to enforce access**

Modify `repos/backend/src/endpoints/agents/getAgent.ts`:

After the existing `checkPermission` call and after fetching the agent, add:

```typescript
import { requireAgentAccess } from '@TBE/utils/auth/requireAgentAccess'

// After checkPermission and after getting the agent:
await requireAgentAccess(req, id, orgId)
```

**Step 4c: Update listAgents.ts to filter by access**

Modify `repos/backend/src/endpoints/agents/listAgents.ts`:

Replace the in-memory project filter (lines 53-56) with access-based filtering:

```typescript
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { ERoleType, hasMinRole } from '@tdsk/domain'

// After fetching agents from DB, replace the existing filter block:

// Filter by project membership access (non-admins only see agents in their projects)
const userRole = await getUserRole(req, { orgId })
let filteredData = data || []

if (!hasMinRole(userRole, ERoleType.admin)) {
  const userId = req.user?.id
  const { data: userProjectIds } = await db.services.role.getUserProjects(userId)
  const projectIdSet = new Set(userProjectIds || [])

  filteredData = filteredData.filter((agent) =>
    agent.projects?.some((p) => projectIdSet.has(p.id))
  )
}

// If specific projectId requested, further filter
if (projectId) {
  filteredData = filteredData.filter((agent) =>
    agent.projects.some((p) => p.id === projectId)
  )
}

res.status(200).json({ data: filteredData, limit, offset })
```

**Step 4d: Write tests**

Create `repos/backend/src/utils/auth/requireAgentAccess.test.ts`. Test:

1. Org admin can access any agent (bypass)
2. Project member can access agent in their project
3. Non-project-member gets 403
4. Agent with no projects — only admins can access

**Step 4e: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass.

---

### Task 5: Update Agent Endpoints for Provider Priority

**Files:**
- Modify: `repos/backend/src/endpoints/agents/createAgent.ts`
- Modify: `repos/backend/src/endpoints/agents/updateAgent.ts`

**Context:** Currently `createAgent` and `updateAgent` accept `providerIds: string[]` where array order implicitly sets priority (index = priority). The DB service `setProviders` already assigns `priority = i`. The change is to ALSO accept an explicit `providers: [{id, priority}]` format for the admin UI to use, while keeping `providerIds[]` as backward compat.

**Step 5a: Update createAgent.ts**

In `repos/backend/src/endpoints/agents/createAgent.ts`, modify the destructuring to also handle `providers` array:

```typescript
const {
  projectIds = [],
  functionIds = [],
  providerIds: rawProviderIds = [],
  providers: providersWithPriority,
  ...agent
} = req.body

// Support both formats: providerIds[] (ordered array) or providers[{id, priority}]
const providerIds = providersWithPriority?.length
  ? providersWithPriority
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map((p) => p.id)
  : rawProviderIds
```

This keeps the existing `providerIds[]` flow working (DB service uses array index as priority) while also supporting the explicit `{id, priority}` format by sorting and extracting IDs.

**Step 5b: Update updateAgent.ts**

Same change in `repos/backend/src/endpoints/agents/updateAgent.ts`.

**Step 5c: Run backend tests**

Run: `cd repos/backend && pnpm test`
Expected: All existing tests pass (backward compatible change).

---

## Phase 3: Admin UI (`repos/admin`)

### Task 6: Add Route and Nav for Org-Level Agents

**Files:**
- Modify: `repos/admin/src/types/routes.types.ts`
- Modify: `repos/admin/src/constants/nav.tsx`
- Modify: `repos/admin/src/routes/Routes.tsx`

**Step 6a: Add OrgAgents route path**

Modify `repos/admin/src/types/routes.types.ts`. Add to `ERoutePath`:

```typescript
// After existing org route paths (e.g., after OrgApiKeys line 41)
OrgAgents = `/orgs/:orgId/agents`,
```

Note: `Agents = 'agents'` already exists as a relative path (used for project agents). It can be reused for the org-level relative path since it's the same segment name.

**Step 6b: Add Agents to OrgNavItems**

Modify `repos/admin/src/constants/nav.tsx`. Add to `OrgNavItems` array, after "Projects" (line 54):

```typescript
{
  text: `Agents`,
  to: buildRoute(ERoutePath.OrgAgents),
  Icon: <RobotIcon />,
  visible: (ctx: TNavCtx) => !!ctx.orgId,
},
```

`RobotIcon` is already imported at line 5.

**Step 6c: Add route to Routes.tsx**

Modify `repos/admin/src/routes/Routes.tsx`. Add to org routes children:

```typescript
{
  path: ERoutePath.Agents,  // 'agents' relative
  Component: () => <SuspensePage Component={OrgAgents} />,
},
```

Import `OrgAgents` page (will create in next task).

---

### Task 7: Create Org-Level Agents Page

**Files:**
- Create: `repos/admin/src/pages/Orgs/OrgAgents.tsx`

**Context:** This page lists all agents in the org. Pattern mirrors `ProjectAgents.tsx` but without project context. Uses `fetchAgents({ orgId })` (no projectId) which calls `agentsApi.list(orgId)`.

**Step 7a: Create OrgAgents page**

Create `repos/admin/src/pages/Orgs/OrgAgents.tsx`. Copy the pattern from `repos/admin/src/pages/Projects/ProjectAgents.tsx` and adapt:

- Remove `projectId` dependency
- Use `fetchAgents({ orgId })` (no projectId)
- Show "Linked Projects" column as chips for each agent
- Agent drawer opens with `projectId` as optional/undefined
- Row click navigates to first linked project's agent detail (or opens drawer if no projects)

Reference `repos/admin/src/pages/Projects/ProjectAgents.tsx` for the exact DataTable column definitions, state management, and component structure. Key changes:

1. Replace `useActiveProjectId()` with just `useActiveOrgId()`
2. `fetchAgents({ orgId })` instead of `fetchAgents({ orgId, projectId })`
3. Add a "Projects" column showing `agent.projects` as Chips
4. `AgentDrawer` receives `projectId=''` or `projectId={undefined}`

---

### Task 8: Update AgentDrawer for Org-Level Context + Project Assignment

**Files:**
- Modify: `repos/admin/src/components/Agents/AgentDrawer.tsx`

**Context:** Currently `AgentDrawer` requires `projectId` prop. For org-level agent management, it needs to work without a projectId and include a project multi-select for assigning the agent to projects.

**Step 8a: Make projectId optional**

Change the type:
```typescript
export type TAgentDrawer = {
  open: boolean
  orgId: string
  projectId?: string  // ← Make optional (was required)
  agent: Agent | null
  onClose: () => void
  onSuccess?: () => void
}
```

**Step 8b: Add project multi-select state**

Add state and loading for project selection:

```typescript
const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
const [orgProjects, setOrgProjects] = useState<Array<{ id: string; name: string }>>([])

// Load org projects on mount
useEffect(() => {
  if (!orgId) return
  fetchProjects({ orgId }).then((resp) => {
    if (resp.data) {
      setOrgProjects(resp.data.map((p) => ({ id: p.id, name: p.name })))
    }
  })
}, [orgId])

// Pre-populate from existing agent or current project context
useEffect(() => {
  if (agent?.projects?.length) {
    setSelectedProjectIds(agent.projects.map((p) => p.id))
  } else if (projectId) {
    setSelectedProjectIds([projectId])
  }
}, [agent, projectId])
```

**Step 8c: Add project selector to form**

Add an Autocomplete for project selection (after the provider section):

```typescript
<Autocomplete
  multiple
  value={selectedProjectIds}
  options={orgProjects.map((p) => p.id)}
  getOptionLabel={(id) => orgProjects.find((p) => p.id === id)?.name || id}
  onChange={(_, updates) => setSelectedProjectIds(updates)}
  renderInput={(params) => <TextField {...params} label="Projects" />}
/>
```

**Step 8d: Include projectIds in save**

In the save handler, include `projectIds`:
```typescript
const agentData = {
  // ... existing fields ...
  projectIds: selectedProjectIds,
}
```

---

### Task 9: Add Provider Priority UI (Ordered List)

**Files:**
- Create: `repos/admin/src/components/Agents/ProviderPriorityList.tsx`
- Modify: `repos/admin/src/components/Agents/BasicInfoForm.tsx`

**Context:** Replace the current multi-select Autocomplete for providers with an ordered list where users can reorder providers. Priority = list position (0-indexed). First item is labeled "Primary".

**Step 9a: Create ProviderPriorityList component**

Create `repos/admin/src/components/Agents/ProviderPriorityList.tsx`:

Build a component that:
- Displays selected providers as a numbered list
- Has up/down arrow buttons to reorder
- Has a delete button to remove a provider
- Has an "Add Provider" button that shows an Autocomplete of available (unselected) providers
- First item shows a "Primary" chip
- Uses MUI components: List, ListItem, IconButton, Chip, Autocomplete
- Props: `{ loading, providerIds, aiProviders, onChange }`

The `onChange` callback receives the reordered `providerIds` array (where index = priority).

**Step 9b: Replace BasicInfoForm provider selection**

In `repos/admin/src/components/Agents/BasicInfoForm.tsx`, replace the current Autocomplete for providers (around lines 75-91) with the new `ProviderPriorityList`:

```typescript
import { ProviderPriorityList } from './ProviderPriorityList'

// Replace the Autocomplete block with:
<ProviderPriorityList
  loading={loading}
  providerIds={providerIds}
  aiProviders={aiProviders}
  onChange={onProviderChange}
/>
```

---

### Task 10: Add Route, Nav, and Page for Project Members

**Files:**
- Modify: `repos/admin/src/types/routes.types.ts`
- Modify: `repos/admin/src/constants/nav.tsx`
- Modify: `repos/admin/src/routes/Routes.tsx`
- Create: `repos/admin/src/services/projectMembersApi.ts`
- Create: `repos/admin/src/pages/Projects/ProjectMembers.tsx`

**Step 10a: Add route path**

Add to `ERoutePath` in `repos/admin/src/types/routes.types.ts`:

```typescript
Members = `members`,
ProjectMembers = `/orgs/:orgId/projects/:projectId/members`,
```

**Step 10b: Add to ProjectNavItems**

In `repos/admin/src/constants/nav.tsx`, add to `ProjectNavItems` (before Settings):

```typescript
{
  text: `Members`,
  Icon: <PersonIcon />,
  to: buildRoute(ERoutePath.ProjectMembers),
  visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
},
```

`PersonIcon` is already imported.

**Step 10c: Add route**

In `repos/admin/src/routes/Routes.tsx`, add to project routes children:

```typescript
{
  path: ERoutePath.Members,
  Component: () => <SuspensePage Component={ProjectMembers} />,
},
```

**Step 10d: Create projectMembersApi service**

Create `repos/admin/src/services/projectMembersApi.ts`:

```typescript
import { BaseApi } from './baseApi'
import type { TApiRes } from '@TAF/types'
import { Role } from '@tdsk/domain'

export class ProjectMembersApi extends BaseApi {
  #path(orgId: string, projectId: string) {
    return `/orgs/${orgId}/projects/${projectId}/members`
  }

  async list(orgId: string, projectId: string): Promise<TApiRes<Role[]>> {
    return this.api.get<Role[]>({ path: this.#path(orgId, projectId) })
  }

  async add(orgId: string, projectId: string, data: { userId: string; type: string }): Promise<TApiRes<Role>> {
    return this.api.post<Role>({ data, path: this.#path(orgId, projectId) })
  }

  async updateRole(orgId: string, projectId: string, userId: string, type: string): Promise<TApiRes<Role>> {
    return this.api.put<Role>({ data: { type }, path: `${this.#path(orgId, projectId)}/${userId}` })
  }

  async remove(orgId: string, projectId: string, userId: string): Promise<TApiRes<Role>> {
    return this.api.delete<Role>({ path: `${this.#path(orgId, projectId)}/${userId}` })
  }
}

export const projectMembersApi = new ProjectMembersApi()
```

**Step 10e: Create ProjectMembers page**

Create `repos/admin/src/pages/Projects/ProjectMembers.tsx`.

Pattern: Mirror `repos/admin/src/pages/Orgs/OrgUsers.tsx` which wraps `Users` component. For project members:

1. List members using `projectMembersApi.list(orgId, projectId)`
2. Add member drawer — select from org members not already in project
3. Edit role drawer — reuse `EditRoleDrawer` pattern
4. Remove member — confirm dialog, call `projectMembersApi.remove()`

The "add member" flow differs from org invites: instead of inviting by email, you select from existing org members (since users must be org members first). Use an Autocomplete that lists org members not yet in the project.

---

### Task 11: Run Full Test Suite + Build Validation

**Step 11a: Run all unit tests**

```bash
cd repos/domain && pnpm test
cd repos/database && pnpm test
cd repos/backend && pnpm test
```

Expected: All tests pass.

**Step 11b: Run builds (dependency order)**

```bash
pnpm --filter @tdsk/domain build
pnpm --filter @tdsk/database build
pnpm --filter @tdsk/logger build
pnpm --filter @tdsk/backend build
pnpm --filter @tdsk/proxy build
pnpm --filter @tdsk/admin build
```

Expected: All builds succeed.

**Step 11c: Validate admin starts**

```bash
cd repos/admin && pnpm start
```

Expected: Dev server starts, no compilation errors.

---

## Verification Checklist

After all tasks complete, verify each relationship end-to-end:

| # | Relationship | How to Verify |
|---|-------------|--------------|
| R1 | User to Orgs | Existing (no changes needed) |
| R2 | Org to Providers | Existing (no changes needed) |
| R3 | Org to Projects | Existing (no changes needed) |
| R4 | Org to Members | Existing (no changes needed) |
| R5 | Org to Agents | Open org-level Agents page, see all org agents |
| R6 | Agent to Providers (priority) | Create agent with 3 providers, reorder, save, verify order persists |
| R7 | Agent to Projects | Create agent at org level, assign to 2 projects, see in both project pages |
| R8 | Project to Members | Open project Members page, add org member, see in list |
| R9 | User to Agents (scoped) | Login as non-admin project member, only see agents in their projects |
| R10 | User to Projects (scoped) | Existing (org membership already gates project access) |

## Task Dependencies

```
Task 1 (Domain: TAgentProvider)
  └── Task 2 (DB: pass priority to model)
       └── Task 5 (Backend: provider priority in endpoints)
            └── Task 9 (Admin: ProviderPriorityList UI)

Task 3 (Backend: project member endpoints)  [independent]
  └── Task 10 (Admin: project members page)

Task 4 (Backend: agent access enforcement)  [independent]
  └── Task 7 (Admin: org agents page uses filtered results)

Task 6 (Admin: routes + nav)  [independent, do first in Phase 3]
  └── Task 7 (Admin: org agents page)
  └── Task 8 (Admin: AgentDrawer updates)
  └── Task 10 (Admin: project members)

Task 11 (Validation)  [depends on all]
```

Tasks 3, 4, and 1-2-5 can be worked on in parallel since they touch different files.
