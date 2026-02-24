# Per-User API Key Management — Design Doc

**Date**: 2026-02-23
**Task**: [P3] Admin UI for org/project member API key management
**Status**: Design approved, ready for implementation

## Problem

Org admins cannot create or manage API keys for specific users. The Users page has no API key entry point, and the CreateApiKeyDrawer doesn't accept a userId. The OrgApiKeys page shows all org keys without per-user filtering.

## Key Finding: Backend Is Ready

The backend and database already fully support per-user API keys:
- `listApiKeys.ts` accepts `?userId` query param and filters accordingly
- `createApiKey.ts` accepts `userId` in body with owner-only guard for cross-user creation
- DB schema has `userId` column + index + FK relation on `api_keys` table

**The entire gap is in the admin frontend.**

## Design

### Approach: Inline Drawer from Users Table

Clicking a VpnKey icon on a user row in the Users DataTable opens a `UserApiKeysDrawer` showing that user's API keys with create/revoke options. This follows the existing drawer pattern used throughout the app.

### New Components

#### `UserApiKeysDrawer`
- **Location**: `repos/admin/src/components/Users/UserApiKeysDrawer.tsx`
- **Props**: `{ user: User, orgId: string, open: boolean, onClose: () => void }`
- **Behavior**:
  - On open, fetches keys via `apiKeysApi.list(orgId, { userId: user.id })`
  - Shows user's display name in drawer title
  - Lists keys in a simple table: Name, Key Prefix, Scopes (chips), Status, Expires, Revoke button
  - "Create API Key" button at top opens `CreateApiKeyDrawer` with `userId` locked
  - Refresh list after create/revoke operations

### Modified Components

#### `CreateApiKeyDrawer`
- **File**: `repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx`
- **Change**: Add optional `userId?: string` and `userName?: string` props
- When `userId` is provided, include it in the `createApiKey` action data payload
- Show a read-only info field with the user's name when userId is set

#### `Users.tsx`
- **File**: `repos/admin/src/components/Users/Users.tsx`
- **Change**: Add VpnKey icon button in the Actions column
- Add state: `selectedUser` + `apiKeysDrawerOpen`
- Wire the `UserApiKeysDrawer`

#### `OrgApiKeys.tsx`
- **File**: `repos/admin/src/pages/Orgs/OrgApiKeys.tsx`
- **Change**: Fix `searchCount` hardcoded to `0` — use actual filtered count

### Data Flow

```
Users page → click VpnKey on user row
  → UserApiKeysDrawer opens (user: User)
    → apiKeysApi.list(orgId, { userId }) → shows keys
    → "Create Key" → CreateApiKeyDrawer(userId locked)
      → createApiKey({ orgId, data: { userId, name, scopes } })
      → onSuccess → refresh UserApiKeysDrawer key list
    → "Revoke" → apiKeysApi.revoke(orgId, keyId)
      → onSuccess → refresh key list
```

### Actions Changes

- `fetchApiKeys` action: Add optional `userId` parameter forwarded to `apiKeysApi.list()`

### Testing

**Unit tests**:
- `UserApiKeysDrawer.test.tsx` — renders, fetches keys for user, handles create/revoke
- `CreateApiKeyDrawer` updates — test with and without `userId` prop
- `Users.test.tsx` — verify VpnKey button renders, opens drawer

**Integration tests** (repos/integration):
- Tier 3: Create API key with userId, list with userId filter, verify ownership, revoke

### Files Summary

| File | Action |
|------|--------|
| `repos/admin/src/components/Users/UserApiKeysDrawer.tsx` | NEW |
| `repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx` | MODIFY — add userId prop |
| `repos/admin/src/components/Users/Users.tsx` | MODIFY — add VpnKey action + drawer state |
| `repos/admin/src/pages/Orgs/OrgApiKeys.tsx` | MODIFY — fix searchCount |
| `repos/admin/src/actions/apiKeys/api/fetchApiKeys.ts` | MODIFY — add userId param |
| `repos/admin/src/components/Users/UserApiKeysDrawer.test.tsx` | NEW — unit tests |
| `repos/integration/src/tier3/user-api-keys.test.ts` | NEW — integration test |

### Decisions

- **Drawer over dialog** — consistent with app patterns (AgentDrawer, EndpointDrawer, etc.)
- **Locked userId** — when opened from Users page, userId is read-only (admin already selected the user)
- **No backend changes** — API already supports userId filtering and creation
