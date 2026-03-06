# Phase 2: CRUD Playwright Tests — API Keys, Providers, Users

## Context

Phase 1 complete (179/179 tier2 passing). Now adding CRUD tests for API Keys, Providers, and Users/Members.

Reuse existing: auth fixture, crud-helpers.ts, test context (orgId, apiKey, projectId, agentId).

## 1. API Keys — CREATE / READ / REVOKE

| Aspect | Detail |
|--------|--------|
| Page class | `tdsk-org-api-keys-page` |
| Route | `/orgs/:orgId/api-keys` |
| Form ID | `api-key-form` |
| Fields | `#tdsk-api-key-name`, `#tdsk-api-key-expiration` (select), scope checkboxes |
| Create button | "Generate API Key" |
| Post-create | Drawer shows generated key + "Done" button (does NOT auto-close) |
| Revoke | Inline icon → ConfirmDelete with confirmText="Revoke" |
| Backend | No blocking ops. Soft delete (active=false). Pagination default 50. |
| API | `/_/orgs/:orgId/api-keys` |

**Tests (serial):**
- CREATE: Open drawer → fill name → select expiration → check "read" scope → submit → verify key shown → click Done → verify in table
- READ: Navigate → search → verify name, prefix, scopes, Active status
- REVOKE: Click revoke icon → confirm "Revoke" → verify status or removal
- afterAll: Revoke via API as safety net

**Notes:** No edit/update flow. Scopes are checkboxes. After create, look for "Make sure to copy" text then click Done.

## 2. Providers — Full CRUD

| Aspect | Detail |
|--------|--------|
| Page class | `tdsk-org-providers-page` |
| Route | `/orgs/:orgId/providers` |
| Form ID | `provider-form` |
| Fields | `#provider-type` (select), `#provider-brand` (select, AI only), `#provider-name` (text), `#provider-base-url` (text) |
| Create button | "Create Provider" |
| Edit | Click table row → ProviderDrawer edit mode |
| Delete | Inline delete icon → ConfirmDelete |
| Backend | No blocking ops. Enum validation only. Hard delete. Pagination default 50. |
| API | `/_/orgs/:orgId/providers` |

**Tests (serial):**
- CREATE: Open drawer → select type "ai" → select brand "custom" → fill name → submit → verify in table
- READ: Navigate → search → verify name, type chip, brand
- UPDATE: Click row → change name → save → verify updated
- DELETE: Click delete icon → confirm → verify removed
- afterAll: Delete via API as safety net

**Notes:** Brand field only appears for type "ai". Skip secret/API key fields (optional). Use "custom" brand to avoid auto-fill.

## 3. Users/Members — UI-only (like Domains)

| Aspect | Detail |
|--------|--------|
| Page class | `tdsk-org-members-page` |
| Route | `/orgs/:orgId/members` |
| Invite form ID | `invite-user-form` |
| Fields | `#user-email`, `#user-role` (select) |
| Backend | **Sends real emails** on invite — cannot do full CRUD |

**Tests (non-serial):**
- Page renders with DataTable and member rows
- Invite drawer opens, validates email format
- Role chips display for existing users
- Edit drawer opens on row click with role select

**Why UI-only:** Invite sends real emails. Users don't appear until invite accepted.

## New Shared Helpers (crud-helpers.ts)

```typescript
// MUI Select interaction
selectOption(page, selectId, optionText)

// Flexible confirm dialog (ConfirmDelete uses "Revoke" for API keys)
confirmAction(page, buttonText = /Confirm/i)
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `playwright/utils/crud-helpers.ts` | MODIFY — add selectOption, confirmAction |
| `playwright/tier2/crud-api-keys.spec.ts` | CREATE — 3 tests + afterAll |
| `playwright/tier2/crud-providers.spec.ts` | CREATE — 4 tests + afterAll |
| `playwright/tier2/crud-users.spec.ts` | CREATE — 4 UI tests |
| `repos/admin/src/**` | MODIFY if bugs found |

## Implementation Order

1. Add helpers to crud-helpers.ts
2. Write + run crud-api-keys.spec.ts — fix bugs
3. Write + run crud-providers.spec.ts — fix bugs
4. Write + run crud-users.spec.ts — fix bugs
5. Full tier2 regression + pnpm types
