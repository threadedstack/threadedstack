# Per-User API Key Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable org admins to create and manage API keys for specific users from the Users page via a dedicated drawer.

**Architecture:** The backend already supports userId-based API key filtering and creation. This is a frontend-only change in the admin SPA — a new `UserApiKeysDrawer` component, modifications to `CreateApiKeyDrawer` to accept a userId prop, and a VpnKey action button on the Users table. Also fixes the hardcoded `searchCount=0` in `OrgApiKeys.tsx`.

**Tech Stack:** React 18, MUI 6, Jotai, TypeScript, Vitest, integration tests via live K8s API

**CRITICAL RULES (must include in ALL subagent prompts):**
- **NEVER** commit, amend, revert, or change git history
- **NEVER** use `git add`, `git commit`, `git push`, `git reset`
- Read-only git operations ONLY: `git status`, `git diff`, `git log`
- **NEVER** use fake/test API keys in integration tests — use real keys from env
- Run `pnpm types` before completing to verify TypeScript

---

## Task 1: Modify `fetchApiKeys` Action — Add userId Support

**Files:**
- Modify: `repos/admin/src/actions/apiKeys/fetchApiKeys.ts:1-33`

**Step 1: Update TFetchApiKeysOpts type and action**

Add `userId` to the opts type and forward it to `apiKeysApi.list()`:

```typescript
// repos/admin/src/actions/apiKeys/fetchApiKeys.ts
import type { ApiKey } from '@tdsk/domain'

import { apiKeysApi } from '@TAF/services'
import { setApiKeys } from '@TAF/state/accessors'

export type TFetchApiKeysOpts = {
  orgId: string
  userId?: string
}

export type TFetchApiKeysResult = {
  apiKeys?: Record<string, ApiKey>
  error?: Error
}

export const fetchApiKeys = async (
  opts: TFetchApiKeysOpts
): Promise<TFetchApiKeysResult> => {
  const { orgId, userId } = opts
  const resp = await apiKeysApi.list(orgId, userId ? { userId } : undefined)

  if (resp.error) {
    return { error: resp.error }
  }

  const apiKeysMap =
    resp.data?.reduce((acc: Record<string, ApiKey>, apiKey: ApiKey) => {
      acc[apiKey.id] = apiKey
      return acc
    }, {}) || {}

  setApiKeys(apiKeysMap)
  return { apiKeys: apiKeysMap }
}
```

**Step 2: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: No type errors in fetchApiKeys.ts

---

## Task 2: Modify `CreateApiKeyDrawer` — Add userId Prop

**Files:**
- Modify: `repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx:26-78`

**Step 1: Add userId and userName props to TCreateApiKeyDrawer**

Update the type and the `onSave` handler to forward `userId`:

```typescript
// At line 26, update the type:
export type TCreateApiKeyDrawer = {
  orgId: string
  projectId?: string
  userId?: string
  userName?: string
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}
```

**Step 2: Destructure new props and forward userId in onSave**

At line 41, add `userId` and `userName` to destructuring:
```typescript
const { open, orgId, projectId, userId, userName, onClose: onCloseCB, onSuccess: onSuccessCB } = props
```

At line 70-78, add userId to the createApiKey data:
```typescript
const result = await createApiKey({
  orgId,
  data: {
    userId,
    projectId,
    expiresAt,
    name: name.trim(),
    scopes: scopes.join(','),
  },
})
```

**Step 3: Add read-only user info field in the form**

After the `{error && ...}` block (after line 187), before the TextInput for Key Name, add:
```tsx
{userName && (
  <Box sx={{ mb: 2 }}>
    <InputLabel>User</InputLabel>
    <Typography variant='body2' color='text.secondary'>
      {userName}
    </Typography>
  </Box>
)}
```

**Step 4: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: No type errors

---

## Task 3: Create `UserApiKeysDrawer` Component

**Files:**
- Create: `repos/admin/src/components/Users/UserApiKeysDrawer.tsx`

**Step 1: Create the component**

```tsx
// repos/admin/src/components/Users/UserApiKeysDrawer.tsx
import type { User, ApiKey } from '@tdsk/domain'

import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import { apiKeysApi } from '@TAF/services'
import { ConfirmDelete, Drawer, Button, IconButton } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingSpinner } from '@TAF/components/LoadingSpinner/LoadingSpinner'
import { CreateApiKeyDrawer } from '@TAF/components/Orgs/CreateApiKeyDrawer'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Add as AddIcon,
  VpnKey as KeyIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'

import type { TDataTableColumn } from '@TAF/components'

export type TUserApiKeysDrawer = {
  user: User
  orgId: string
  open: boolean
  onClose: () => void
}

export const UserApiKeysDrawer = (props: TUserApiKeysDrawer) => {
  const { user, orgId, open, onClose } = props

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)

  const loadKeys = useCallback(async () => {
    if (!open || !user?.id) return

    setLoading(true)
    setError(null)

    const resp = await apiKeysApi.list(orgId, { userId: user.id })

    if (resp.error) {
      setError(resp.error.message)
      setKeys([])
    } else {
      setKeys(resp.data || [])
    }

    setLoading(false)
  }, [open, orgId, user?.id])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const onRevoke = async () => {
    if (!revoking) return

    const resp = await apiKeysApi.revoke(orgId, revoking.id)
    if (resp.error) {
      setError(resp.error.message)
    }

    setRevoking(null)
    loadKeys()
  }

  const onCreateSuccess = () => {
    setCreateOpen(false)
    loadKeys()
  }

  const userName = user?.displayName
    || [user?.first, user?.last].filter(Boolean).join(' ')
    || user?.email
    || 'User'

  const columns: TDataTableColumn<ApiKey>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (key) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
          <Typography variant='body2' fontWeight='medium'>
            {key.name}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'keyPrefix',
      label: 'Prefix',
      render: (key) => (
        <Typography variant='body2' fontFamily='monospace' color='text.secondary'>
          {key.keyPrefix}...
        </Typography>
      ),
    },
    {
      id: 'scopes',
      label: 'Scopes',
      render: (key) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {key.scopes?.split(',').map((scope) => (
            <Chip
              key={scope}
              label={scope.trim()}
              size='small'
              variant='outlined'
            />
          ))}
        </Box>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (key) => (
        <Chip
          label={key.active ? 'Active' : 'Revoked'}
          size='small'
          color={key.active ? 'success' : 'default'}
          variant={key.active ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      id: 'actions',
      label: '',
      align: 'right',
      render: (key) => (
        <ActionIconButton
          tooltip='Revoke'
          icon={<DeleteIcon />}
          size='small'
          color='error'
          disabled={!key.active}
          onClick={(e) => {
            e.stopPropagation()
            setRevoking(key)
          }}
        />
      ),
    },
  ]

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={`API Keys — ${userName}`}
        actions={
          <Button
            color='primary'
            variant='contained'
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Create Key
          </Button>
        }
      >
        {error && (
          <ErrorAlert
            sx={{ mb: 2 }}
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {loading && <LoadingSpinner />}

        {!loading && keys.length === 0 && !error && (
          <Typography variant='body2' color='text.secondary' sx={{ py: 4, textAlign: 'center' }}>
            No API keys for this user yet.
          </Typography>
        )}

        {!loading && keys.length > 0 && (
          <DataTable
            columns={columns}
            data={keys}
            getRowKey={(key) => key.id}
          />
        )}
      </Drawer>

      <CreateApiKeyDrawer
        orgId={orgId}
        userId={user?.id}
        userName={userName}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={onCreateSuccess}
      />

      {revoking && (
        <ConfirmDelete
          confirmText='Revoke'
          onCancel={() => setRevoking(null)}
          onConfirm={onRevoke}
          itemName={revoking.name}
          text={`Are you sure you want to revoke "${revoking.name}"? Applications using this key will lose access.`}
        />
      )}
    </>
  )
}

export default UserApiKeysDrawer
```

**Step 2: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: No type errors

---

## Task 4: Modify `Users.tsx` — Add VpnKey Action Button + Drawer

**Files:**
- Modify: `repos/admin/src/components/Users/Users.tsx:1-272`

**Step 1: Add imports**

Add to existing imports (after line 24):
```typescript
import { VpnKey as VpnKeyIcon } from '@mui/icons-material'
import { UserApiKeysDrawer } from '@TAF/components/Users/UserApiKeysDrawer'
```

**Step 2: Add state for API keys drawer**

After line 50 (`const [selectedUser, setSelectedUser] = useState<User | null>(null)`), add:
```typescript
const [apiKeysUser, setApiKeysUser] = useState<User | null>(null)
```

**Step 3: Add VpnKey button to the Actions column**

In the `actions` column render function (line 167-198), add a third `ActionIconButton` between Edit Role and Delete. Replace the existing actions render with:

```tsx
render: (user) => (
  <Box sx={styles.table.actions.box}>
    <ActionIconButton
      tooltip='API Keys'
      icon={<VpnKeyIcon sx={styles.table.actions.icon} />}
      size='small'
      color='default'
      disabled={authUser.role === ERoleType.viewer}
      disabledTooltip='Viewers cannot manage API keys'
      onClick={(e) => {
        e.stopPropagation()
        setApiKeysUser(user)
      }}
    />
    <ActionIconButton
      tooltip='Edit Role'
      icon={<EditIcon sx={styles.table.actions.icon} />}
      size='small'
      color='primary'
      disabled={authUser.role === ERoleType.viewer}
      disabledTooltip='Viewers cannot edit roles'
      onClick={(e) => {
        e.stopPropagation()
        onOpenEditRole(user)
      }}
    />
    <ActionIconButton
      tooltip='Remove User'
      icon={<DeleteIcon sx={styles.table.actions.icon} />}
      size='small'
      color='error'
      disabled={user.role === ERoleType.super || authUser.id === user.id}
      disabledTooltip={
        user.role === ERoleType.super
          ? 'Cannot remove super admin'
          : 'Cannot remove yourself'
      }
      onClick={(e) => {
        e.stopPropagation()
        onRemoveUser(user)
      }}
    />
  </Box>
),
```

**Step 4: Add the UserApiKeysDrawer to the JSX**

After the `ConfirmDelete` closing tag (before `</PageLayout>`), add:
```tsx
{apiKeysUser && orgId && (
  <UserApiKeysDrawer
    orgId={orgId}
    user={apiKeysUser}
    open={Boolean(apiKeysUser)}
    onClose={() => setApiKeysUser(null)}
  />
)}
```

**Step 5: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: No type errors

---

## Task 5: Fix `OrgApiKeys.tsx` — searchCount Hardcoded to 0

**Files:**
- Modify: `repos/admin/src/pages/Orgs/OrgApiKeys.tsx:246`

**Step 1: Replace hardcoded searchCount**

At line 246, change:
```
searchCount={0}
```
to:
```
searchCount={filteredApiKeys.length}
```

The `filteredApiKeys` array is already computed at lines 88-99 and reflects the search-filtered result. When no search query is active, it equals the full keys array. When a search is active, it's the filtered subset. This is exactly what `searchCount` should show.

**Step 2: Verify types compile**

Run: `cd repos/admin && pnpm types`
Expected: No type errors

---

## Task 6: Unit Tests — UserApiKeysDrawer

**Files:**
- Create: `repos/admin/src/components/Users/UserApiKeysDrawer.test.tsx`

**Step 1: Write the unit test**

```tsx
// repos/admin/src/components/Users/UserApiKeysDrawer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '../../../scripts/testUtils'
import { User, ApiKey } from '@tdsk/domain'

// Mock apiKeysApi
const mockList = vi.fn()
const mockRevoke = vi.fn()
vi.mock('@TAF/services', () => ({
  apiKeysApi: {
    list: (...args: any[]) => mockList(...args),
    revoke: (...args: any[]) => mockRevoke(...args),
  },
}))

// Mock sub-components that have complex dependencies
vi.mock('@TAF/components/Orgs/CreateApiKeyDrawer', () => ({
  CreateApiKeyDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid='create-drawer'>Create Drawer</div> : null,
}))

import { UserApiKeysDrawer } from './UserApiKeysDrawer'

const testUser = new User({
  id: 'user-1',
  displayName: 'Test User',
  email: 'test@example.com',
})

const testKeys = [
  new ApiKey({
    id: 'key-1',
    name: 'Test Key',
    keyPrefix: 'tdsk_abc',
    scopes: 'read,write',
    active: true,
    orgId: 'org-1',
    userId: 'user-1',
  }),
]

describe('UserApiKeysDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue({ data: testKeys })
    mockRevoke.mockResolvedValue({ data: { success: true } })
  })

  it('fetches keys for the user on open', async () => {
    renderWithTheme(
      <UserApiKeysDrawer
        user={testUser}
        orgId='org-1'
        open={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith('org-1', { userId: 'user-1' })
    })
  })

  it('displays the user name in the title', async () => {
    renderWithTheme(
      <UserApiKeysDrawer
        user={testUser}
        orgId='org-1'
        open={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Test User/)).toBeInTheDocument()
    })
  })

  it('shows empty state when user has no keys', async () => {
    mockList.mockResolvedValue({ data: [] })

    renderWithTheme(
      <UserApiKeysDrawer
        user={testUser}
        orgId='org-1'
        open={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/No API keys for this user/)).toBeInTheDocument()
    })
  })

  it('shows error when fetch fails', async () => {
    mockList.mockResolvedValue({ error: new Error('Failed to load') })

    renderWithTheme(
      <UserApiKeysDrawer
        user={testUser}
        orgId='org-1'
        open={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument()
    })
  })
})
```

**Step 2: Run unit tests**

Run: `cd repos/admin && pnpm test -- --run src/components/Users/UserApiKeysDrawer.test.tsx`
Expected: All tests pass

---

## Task 7: Unit Tests — CreateApiKeyDrawer userId Prop

**Files:**
- Create: `repos/admin/src/components/Orgs/CreateApiKeyDrawer.test.tsx`

**Step 1: Write the unit test**

```tsx
// repos/admin/src/components/Orgs/CreateApiKeyDrawer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithTheme } from '../../../scripts/testUtils'

const mockCreateApiKey = vi.fn()
vi.mock('@TAF/actions/apiKeys', () => ({
  createApiKey: (...args: any[]) => mockCreateApiKey(...args),
}))

import { CreateApiKeyDrawer } from './CreateApiKeyDrawer'

describe('CreateApiKeyDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateApiKey.mockResolvedValue({ data: { key: 'tdsk_test123' } })
  })

  it('renders without userId prop', () => {
    renderWithTheme(
      <CreateApiKeyDrawer
        orgId='org-1'
        open={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/Key Name/i)).toBeInTheDocument()
  })

  it('shows user name when userName prop is provided', () => {
    renderWithTheme(
      <CreateApiKeyDrawer
        orgId='org-1'
        userId='user-1'
        userName='Test User'
        open={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
  })

  it('includes userId in createApiKey call', async () => {
    const user = userEvent.setup()

    renderWithTheme(
      <CreateApiKeyDrawer
        orgId='org-1'
        userId='user-1'
        userName='Test User'
        open={true}
        onClose={vi.fn()}
      />
    )

    const nameInput = screen.getByLabelText(/Key Name/i)
    await user.type(nameInput, 'My API Key')

    // Find and click save - the DrawerActions component renders a save button
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockCreateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          data: expect.objectContaining({
            userId: 'user-1',
            name: 'My API Key',
          }),
        })
      )
    })
  })
})
```

**Step 2: Run unit tests**

Run: `cd repos/admin && pnpm test -- --run src/components/Orgs/CreateApiKeyDrawer.test.tsx`
Expected: All tests pass

---

## Task 8: Integration Test — Per-User API Key CRUD

**Files:**
- Create: `repos/integration/src/tier3/user-api-keys.test.ts`

**Step 1: Write the integration test**

This test validates the backend userId support for API keys through the live K8s proxy. It uses real API keys from the environment.

```typescript
// repos/integration/src/tier3/user-api-keys.test.ts
import { describe, test, expect, afterAll } from 'vitest'
import { get, post, del } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { uniqueName } from '../utils/unique-name'

describe('Tier 3: Per-User API Key Management', () => {
  const ctx = readContext()
  let createdKeyId: string | undefined

  afterAll(async () => {
    // Best-effort cleanup
    if (createdKeyId) {
      try {
        await del(`/orgs/${ctx.orgId}/api-keys/${createdKeyId}`)
      } catch {
        // Cleanup is best-effort
      }
    }
  })

  test('create API key with userId', async () => {
    const keyName = uniqueName('User Key Test')

    const res = await post<{ data: { id: string; key: string; userId: string } }>(
      `/orgs/${ctx.orgId}/api-keys`,
      {
        name: keyName,
        scopes: 'read',
        userId: ctx.userId,
      }
    )

    expect(res.status).toBe(201)
    expect(res.ok).toBe(true)
    expect(res.data.data).toBeDefined()
    expect(res.data.data.key).toBeDefined()
    expect(res.data.data.key).toMatch(/^tdsk_/)

    createdKeyId = res.data.data.id
  })

  test('list API keys filtered by userId returns only that user keys', async () => {
    expect(createdKeyId).toBeDefined()

    const res = await get<{ data: Array<{ id: string; userId: string }> }>(
      `/orgs/${ctx.orgId}/api-keys?userId=${ctx.userId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)

    // The key we just created should be in the filtered list
    const found = res.data.data.find((k) => k.id === createdKeyId)
    expect(found).toBeDefined()
  })

  test('list API keys without userId filter returns all org keys', async () => {
    const res = await get<{ data: Array<{ id: string }> }>(
      `/orgs/${ctx.orgId}/api-keys`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data.data)).toBe(true)

    // Should include the user-scoped key
    const found = res.data.data.find((k) => k.id === createdKeyId)
    expect(found).toBeDefined()
  })

  test('revoke per-user API key', async () => {
    expect(createdKeyId).toBeDefined()

    const res = await del<{ data: { success: boolean } }>(
      `/orgs/${ctx.orgId}/api-keys/${createdKeyId}`
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)

    // Clear so afterAll doesn't try to double-delete
    createdKeyId = undefined
  })
})
```

**Step 2: Run integration test**

Run: `cd repos/integration && pnpm test -- --run src/tier3/user-api-keys.test.ts`
Expected: All 4 tests pass (assuming K8s services are running and TDSK_IT_* env vars are set)

---

## Task 9: Full Validation

**Step 1: Run all admin unit tests**

Run: `cd repos/admin && pnpm test`
Expected: All existing + new tests pass

**Step 2: Run TypeScript type checks**

Run: `cd repos/admin && pnpm types`
Expected: No type errors

**Step 3: Run integration test suite**

Run: `cd repos/integration && pnpm test -- --run src/tier3/user-api-keys.test.ts`
Expected: All tests pass

**Step 4: Verify no regressions in existing tests**

Run: `cd repos/integration && pnpm test`
Expected: All existing tests still pass

---

## File Summary

| File | Action | Task |
|------|--------|------|
| `repos/admin/src/actions/apiKeys/fetchApiKeys.ts` | MODIFY | Task 1 |
| `repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx` | MODIFY | Task 2 |
| `repos/admin/src/components/Users/UserApiKeysDrawer.tsx` | CREATE | Task 3 |
| `repos/admin/src/components/Users/Users.tsx` | MODIFY | Task 4 |
| `repos/admin/src/pages/Orgs/OrgApiKeys.tsx` | MODIFY | Task 5 |
| `repos/admin/src/components/Users/UserApiKeysDrawer.test.tsx` | CREATE | Task 6 |
| `repos/admin/src/components/Orgs/CreateApiKeyDrawer.test.tsx` | CREATE | Task 7 |
| `repos/integration/src/tier3/user-api-keys.test.ts` | CREATE | Task 8 |

## Dependencies Between Tasks

```
Task 1 (fetchApiKeys) ← independent, do first
Task 2 (CreateApiKeyDrawer) ← independent, do first
Task 3 (UserApiKeysDrawer) ← depends on Task 2 (uses CreateApiKeyDrawer with userId)
Task 4 (Users.tsx) ← depends on Task 3 (uses UserApiKeysDrawer)
Task 5 (OrgApiKeys searchCount) ← independent, can do anytime
Task 6 (unit test: UserApiKeysDrawer) ← depends on Task 3
Task 7 (unit test: CreateApiKeyDrawer) ← depends on Task 2
Task 8 (integration test) ← independent of frontend, tests backend directly
Task 9 (full validation) ← depends on all above
```

**Parallel execution groups:**
- Group A: Tasks 1, 2, 5, 8 (all independent)
- Group B: Tasks 3, 7 (depend on Task 2)
- Group C: Tasks 4, 6 (depend on Task 3)
- Group D: Task 9 (final validation)
