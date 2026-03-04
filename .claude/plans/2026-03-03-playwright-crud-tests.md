# Playwright CRUD Integration Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build comprehensive Playwright CRUD test coverage for all entity types in the admin UI, beyond the current page-rendering-only tests.

**Architecture:** Use the existing `authenticatedPage` fixture with real API key auth bypass. Each entity type gets a dedicated test file with Create, Read, Update, Delete flows. Tests interact with real K8s backend services through the proxy. Tests must clean up after themselves when possible (delete created entities). Order: start with the simplest entities (Secrets, Providers) then build up to complex ones (Agents, Endpoints).

**Tech Stack:** Playwright, existing auth fixtures, live K8s backend

---

## Task 1: Create Shared CRUD Test Helpers

**Files:**
- Create: `repos/integration/playwright/helpers/crud.ts`
- Test: Verified by subsequent test files

**Step 1: Read existing helpers and fixture structure**

Read `repos/integration/playwright/fixtures/auth.ts` and any existing helper files in `repos/integration/playwright/helpers/` to understand patterns.

**Step 2: Create CRUD test helpers**

Create `repos/integration/playwright/helpers/crud.ts`:
```typescript
import { type Page, expect } from '@playwright/test'

/**
 * Wait for a table to load and return the row count
 */
export const waitForTable = async (page: Page, minRows = 0) => {
  const table = page.locator('table tbody')
  await table.waitFor({ state: 'visible', timeout: 10_000 })
  if (minRows > 0) {
    const rows = table.locator('tr')
    await expect(rows).toHaveCount(expect.any(Number))
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(minRows)
    return count
  }
  return await table.locator('tr').count()
}

/**
 * Open a create/edit drawer by clicking the add button
 */
export const openCreateDrawer = async (page: Page, buttonText = /add|create|new/i) => {
  const addBtn = page.getByRole('button', { name: buttonText })
  await addBtn.click()
  // Wait for drawer to slide in
  await page.locator('[role="presentation"]').waitFor({ state: 'visible', timeout: 5_000 })
}

/**
 * Fill a text field in a drawer/form by label
 */
export const fillField = async (page: Page, label: string | RegExp, value: string) => {
  const field = page.getByLabel(label)
  await field.clear()
  await field.fill(value)
}

/**
 * Click save/submit button in a drawer and wait for it to close
 */
export const submitDrawer = async (page: Page, buttonText = /save|create|submit/i) => {
  const saveBtn = page.getByRole('button', { name: buttonText })
  await saveBtn.click()
  // Wait for drawer to close
  await page.locator('[role="presentation"]').waitFor({ state: 'hidden', timeout: 10_000 })
}

/**
 * Click a row action button (edit, delete, etc.)
 */
export const clickRowAction = async (
  page: Page,
  rowText: string,
  action: string | RegExp
) => {
  const row = page.locator('tr', { hasText: rowText })
  await row.waitFor({ state: 'visible' })
  const actionBtn = row.getByRole('button', { name: action })
  await actionBtn.click()
}

/**
 * Confirm a delete dialog
 */
export const confirmDelete = async (page: Page) => {
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  const confirmBtn = dialog.getByRole('button', { name: /delete|confirm|yes/i })
  await confirmBtn.click()
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 })
}

/**
 * Generate a unique test name with timestamp to avoid collisions
 */
export const testName = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).slice(-6)}`
```

**Step 3: Commit**

```
test(integration): add shared CRUD test helpers for Playwright
```

---

## Task 2: Secrets CRUD Tests (Org-Level)

**Files:**
- Create: `repos/integration/playwright/tier2/secrets-crud.spec.ts`

**Step 1: Write Secrets CRUD test file**

Create `repos/integration/playwright/tier2/secrets-crud.spec.ts`:
```typescript
import { test, expect } from '../fixtures/auth'
import { testName, openCreateDrawer, fillField, submitDrawer, clickRowAction, confirmDelete, waitForTable } from '../helpers/crud'

test.describe('Secrets CRUD', () => {
  const secretName = testName('pw-secret')

  test('navigate to secrets page', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/secrets`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.tdsk-secrets-page, [class*="secrets"]')).toBeVisible()
  })

  test('create a new secret', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/secrets`)
    await page.waitForLoadState('networkidle')

    await openCreateDrawer(page)
    await fillField(page, /name/i, secretName)
    await fillField(page, /value/i, 'test-secret-value-123')
    await submitDrawer(page)

    // Verify secret appears in the table
    await expect(page.locator('tr', { hasText: secretName })).toBeVisible()
  })

  test('read secret details', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/secrets`)
    await page.waitForLoadState('networkidle')

    // Click on the secret row to open details
    const row = page.locator('tr', { hasText: secretName })
    await row.waitFor({ state: 'visible' })
    // Secret value should be masked
    await expect(row).toBeVisible()
  })

  test('update secret', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/secrets`)
    await page.waitForLoadState('networkidle')

    await clickRowAction(page, secretName, /edit/i)
    await fillField(page, /value/i, 'updated-secret-value-456')
    await submitDrawer(page)

    await expect(page.locator('tr', { hasText: secretName })).toBeVisible()
  })

  test('delete secret', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/secrets`)
    await page.waitForLoadState('networkidle')

    const beforeCount = await waitForTable(page)
    await clickRowAction(page, secretName, /delete/i)
    await confirmDelete(page)

    // Verify row is gone or count decreased
    await expect(page.locator('tr', { hasText: secretName })).toHaveCount(0)
  })
})
```

**Step 2: Run the test**

Run: `cd repos/integration && pnpm exec playwright test tier2/secrets-crud.spec.ts`
Expected: Tests execute against live services. Adjust selectors as needed based on actual DOM structure.

**Step 3: Iterate on selector accuracy**

The helpers use generic selectors. After the first run, inspect failures and update selectors to match the actual admin UI DOM. Use `page.pause()` or screenshots to debug.

**Step 4: Commit**

```
test(integration): add Secrets CRUD Playwright tests
```

---

## Task 3: Providers CRUD Tests

**Files:**
- Create: `repos/integration/playwright/tier2/providers-crud.spec.ts`

**Step 1: Write Providers CRUD test file**

```typescript
import { test, expect } from '../fixtures/auth'
import { testName, openCreateDrawer, fillField, submitDrawer, clickRowAction, confirmDelete } from '../helpers/crud'

test.describe('Providers CRUD', () => {
  const providerName = testName('pw-prov')

  test('navigate to providers page', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/providers`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()
  })

  test('create a new provider', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/providers`)
    await page.waitForLoadState('networkidle')

    await openCreateDrawer(page)
    await fillField(page, /name/i, providerName)
    // Select provider type (e.g., OpenAI-compatible)
    // Fill API key field
    await fillField(page, /key|api.?key/i, 'test-provider-key')
    await submitDrawer(page)

    await expect(page.locator('tr', { hasText: providerName })).toBeVisible()
  })

  test('edit provider', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/providers`)
    await page.waitForLoadState('networkidle')

    await clickRowAction(page, providerName, /edit/i)
    // Update name or config
    await submitDrawer(page)
  })

  test('delete provider', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/providers`)
    await page.waitForLoadState('networkidle')

    await clickRowAction(page, providerName, /delete/i)
    await confirmDelete(page)

    await expect(page.locator('tr', { hasText: providerName })).toHaveCount(0)
  })
})
```

**Step 2: Run and iterate**

Run: `cd repos/integration && pnpm exec playwright test tier2/providers-crud.spec.ts`
Adjust selectors and flow based on actual Provider drawer/form fields.

**Step 3: Commit**

```
test(integration): add Providers CRUD Playwright tests
```

---

## Task 4: API Keys CRUD Tests

**Files:**
- Create: `repos/integration/playwright/tier2/api-keys-crud.spec.ts`

**Step 1: Write API Keys CRUD test file**

```typescript
import { test, expect } from '../fixtures/auth'
import { testName, openCreateDrawer, fillField, submitDrawer, clickRowAction, confirmDelete } from '../helpers/crud'

test.describe('API Keys CRUD', () => {
  const keyName = testName('pw-key')

  test('create a new API key', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/api-keys`)
    await page.waitForLoadState('networkidle')

    await openCreateDrawer(page)
    await fillField(page, /name/i, keyName)
    // Select scope checkboxes
    const readCheckbox = page.getByLabel(/read/i)
    if (!(await readCheckbox.isChecked())) await readCheckbox.check()
    await submitDrawer(page)

    // Verify key created — look for the key name in the table
    await expect(page.locator('tr', { hasText: keyName })).toBeVisible()

    // The raw key may be shown in a dialog/alert — capture it if visible
    const keyDialog = page.locator('[role="dialog"]')
    if (await keyDialog.isVisible()) {
      // Key is shown once — just close the dialog
      await page.getByRole('button', { name: /close|done|ok/i }).click()
    }
  })

  test('list API keys shows created key', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/api-keys`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('tr', { hasText: keyName })).toBeVisible()
  })

  test('revoke API key', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/api-keys`)
    await page.waitForLoadState('networkidle')

    await clickRowAction(page, keyName, /revoke|delete/i)
    await confirmDelete(page)

    // Verify key is gone or shows as revoked
    const row = page.locator('tr', { hasText: keyName })
    const isGone = await row.count() === 0
    const isRevoked = isGone ? true : await row.locator('[class*="revoked"], [class*="inactive"]').count() > 0
    expect(isGone || isRevoked).toBe(true)
  })
})
```

**Step 2: Run and iterate**

Run: `cd repos/integration && pnpm exec playwright test tier2/api-keys-crud.spec.ts`

**Step 3: Commit**

```
test(integration): add API Keys CRUD Playwright tests
```

---

## Task 5: Projects CRUD Tests

**Files:**
- Create: `repos/integration/playwright/tier2/projects-crud.spec.ts`

**Step 1: Write Projects CRUD test file**

```typescript
import { test, expect } from '../fixtures/auth'
import { testName, openCreateDrawer, fillField, submitDrawer, clickRowAction, confirmDelete } from '../helpers/crud'

test.describe('Projects CRUD', () => {
  const projectName = testName('pw-proj')

  test('create a new project', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/projects`)
    await page.waitForLoadState('networkidle')

    await openCreateDrawer(page)
    await fillField(page, /name/i, projectName)
    await submitDrawer(page)

    await expect(page.locator('tr', { hasText: projectName })).toBeVisible()
  })

  test('navigate into project', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/projects`)
    await page.waitForLoadState('networkidle')

    const row = page.locator('tr', { hasText: projectName })
    await row.click()
    await page.waitForLoadState('networkidle')

    // Should be on the project detail page
    expect(page.url()).toContain('/projects/')
  })

  test('update project name', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/projects`)
    await page.waitForLoadState('networkidle')

    await clickRowAction(page, projectName, /edit|settings/i)

    const updatedName = `${projectName}-upd`
    await fillField(page, /name/i, updatedName)
    await submitDrawer(page)

    await expect(page.locator('tr', { hasText: updatedName })).toBeVisible()
  })

  test('delete project', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/projects`)
    await page.waitForLoadState('networkidle')

    // Use the updated name
    const updatedName = `${projectName}-upd`
    await clickRowAction(page, updatedName, /delete/i)
    await confirmDelete(page)

    await expect(page.locator('tr', { hasText: updatedName })).toHaveCount(0)
  })
})
```

**Step 2: Run and iterate**

Run: `cd repos/integration && pnpm exec playwright test tier2/projects-crud.spec.ts`

**Step 3: Commit**

```
test(integration): add Projects CRUD Playwright tests
```

---

## Task 6: Endpoints & Functions CRUD Tests (Project-Level)

**Files:**
- Create: `repos/integration/playwright/tier2/endpoints-crud.spec.ts`
- Create: `repos/integration/playwright/tier2/functions-crud.spec.ts`

**Step 1: Write Endpoints CRUD tests**

These tests use the existing test project (`ctx.projectId`) to avoid creating/deleting projects:

```typescript
import { test, expect } from '../fixtures/auth'
import { testName, openCreateDrawer, fillField, submitDrawer, clickRowAction, confirmDelete } from '../helpers/crud'

test.describe('Endpoints CRUD', () => {
  const endpointName = testName('pw-ep')

  test('navigate to endpoints page', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()
  })

  test('create a proxy endpoint', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await page.waitForLoadState('networkidle')

    await openCreateDrawer(page)
    await fillField(page, /name/i, endpointName)
    // Select type as Proxy
    // Fill target URL
    await fillField(page, /url|target/i, 'https://httpbin.org/anything')
    await submitDrawer(page)

    await expect(page.locator('tr', { hasText: endpointName })).toBeVisible()
  })

  test('edit endpoint', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await page.waitForLoadState('networkidle')

    await clickRowAction(page, endpointName, /edit/i)
    await fillField(page, /url|target/i, 'https://httpbin.org/get')
    await submitDrawer(page)
  })

  test('delete endpoint', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await page.waitForLoadState('networkidle')

    await clickRowAction(page, endpointName, /delete/i)
    await confirmDelete(page)

    await expect(page.locator('tr', { hasText: endpointName })).toHaveCount(0)
  })
})
```

**Step 2: Write Functions CRUD tests** (similar pattern for `functions-crud.spec.ts`)

**Step 3: Run and iterate**

Run: `cd repos/integration && pnpm exec playwright test tier2/endpoints-crud.spec.ts tier2/functions-crud.spec.ts`

**Step 4: Commit**

```
test(integration): add Endpoints and Functions CRUD Playwright tests
```

---

## Task 7: Agents & Threads CRUD Tests

**Files:**
- Create: `repos/integration/playwright/tier2/agents-crud.spec.ts`
- Create: `repos/integration/playwright/tier2/threads-crud.spec.ts`

**Step 1: Write Agents CRUD test (uses existing project)**

Tests for creating an agent, viewing its config drawer, and deleting it. Thread tests use the existing test agent (`ctx.agentId`).

**Step 2: Write Threads test (create, list, view messages)**

Tests for navigating to threads list, viewing a thread's messages, and basic chat interaction.

**Step 3: Run and iterate**

Run: `cd repos/integration && pnpm exec playwright test tier2/agents-crud.spec.ts tier2/threads-crud.spec.ts`

**Step 4: Commit**

```
test(integration): add Agents and Threads CRUD Playwright tests
```

---

## Task 8: Run Full Suite and Verify

**Step 1: Run all tier2 tests**

Run: `cd repos/integration && pnpm test:ui`
Expected: All existing + new tests pass

**Step 2: Fix any flaky tests**

Add appropriate waits (`waitForLoadState('networkidle')`, element visibility waits). Increase timeouts for slow operations (create/delete may take longer than reads).

**Step 3: Final commit**

```
test(integration): stabilize CRUD test suite, fix flaky selectors
```

---

## Important Notes

- **Selectors will need adjustment.** The test code above uses generic patterns (`tr`, `[role="dialog"]`, label matchers). The actual admin UI may use different DOM structure. Each task requires a "run, inspect, fix selectors" iteration cycle.
- **Test isolation.** Each CRUD test file creates its own entities and cleans up. Use `testName()` helper to avoid name collisions between parallel runs.
- **No serial dependency between test files.** Each file is independent. However, tests WITHIN a file may depend on order (create before read/update/delete). Playwright runs tests in a file sequentially by default.
- **Real data.** These tests create real entities in the backend. If cleanup fails (delete test fails), stale test data will accumulate. Periodically clean up `pw-*` named entities manually.
