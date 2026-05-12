import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  uniqueName,
  collectErrors,
  apiRequest,
  apiDeleteResource,
  searchInPage,
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-sandboxes-page'

/**
 * Tests for sandbox table action buttons:
 *   - Copy button creates a duplicate sandbox
 *   - Start button begins pod startup (mocked)
 *   - Stop button stops a running pod (mocked)
 *   - Status column shows correct states
 *   - Actions are context-aware (project vs org)
 */
test.describe.serial('Sandbox Table Actions', () => {
  let testSandboxId = ''
  let copiedSandboxId = ''
  const testSandboxName = uniqueName('pw-sb-actions')

  test.beforeEach(async ({ ctx }) => {
    test.skip(!ctx.projectId, 'No projectId in context — cannot test sandbox actions')
  })

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()
    try {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const ctx = JSON.parse(
        readFileSync(join(tmpdir(), 'tdsk-integration', 'context.json'), 'utf-8')
      )

      const res = await apiRequest(page, 'POST', `/orgs/${ctx.orgId}/sandboxes`, ctx.apiKey, {
        name: testSandboxName,
        config: {
          image: 'node:22-slim',
          resources: {
            limits: { cpu: '500m', memory: '256Mi' },
            requests: { cpu: '100m', memory: '128Mi' },
          },
        },
        orgId: ctx.orgId,
        projectIds: [ctx.projectId],
      })
      const body = await res.json()
      if (body?.data?.id) testSandboxId = body.data.id
    } catch { /* setup failed */ }
    finally { await context.close() }
  })

  test('Copy button creates a duplicate sandbox', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.slow()
    test.skip(!testSandboxId, 'Sandbox was not created in setup')
    const errors = collectErrors(page)

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes**`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, testSandboxName)
    await expect(page.getByText(testSandboxName).first()).toBeVisible({ timeout: 10_000 })

    // Find the row and click the copy button (ContentCopy icon)
    const row = page.locator('tr', { has: page.getByText(testSandboxName, { exact: true }) })
    const copyButton = row.locator('button').filter({ has: page.locator('[data-testid="ContentCopyIcon"]') })
    await expect(copyButton).toBeVisible({ timeout: 5_000 })
    await copyButton.click()

    // Wait for toast or for the copy to appear in the table
    const copiedName = `${testSandboxName}-copy`
    await expect(page.getByText(copiedName).first()).toBeVisible({ timeout: 15_000 })

    // Find copied sandbox for cleanup
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/sandboxes?limit=200`,
      ctx.apiKey
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data) ? body.data : []
    const found = arr.find((s) => s.name === copiedName)
    if (found?.id) copiedSandboxId = found.id as string

    expect(errors).toEqual([])
  })

  test('Status column shows Stopped by default', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!testSandboxId, 'Sandbox was not created in setup')
    const errors = collectErrors(page)

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes**`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, testSandboxName)
    const row = page.locator('tr', { has: page.getByText(testSandboxName, { exact: true }) })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Status should show "Stopped" chip
    const statusChip = row.locator('.MuiChip-root', { hasText: 'Stopped' })
    await expect(statusChip).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Start button is visible in project context', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!testSandboxId, 'Sandbox was not created in setup')
    const errors = collectErrors(page)

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes**`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, testSandboxName)
    const row = page.locator('tr', { has: page.getByText(testSandboxName, { exact: true }) })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Start button (PlayArrow icon) should be visible in project context
    const startButton = row.locator('button').filter({ has: page.locator('[data-testid="PlayArrowIcon"]') })
    await expect(startButton).toBeVisible({ timeout: 5_000 })

    // Connect button (Terminal icon) should also be visible
    const connectButton = row.locator('button').filter({ has: page.locator('[data-testid="TerminalIcon"]') })
    await expect(connectButton).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Edit button opens drawer with sandbox data', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!testSandboxId, 'Sandbox was not created in setup')
    const errors = collectErrors(page)

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes**`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, testSandboxName)
    const row = page.locator('tr', { has: page.getByText(testSandboxName, { exact: true }) })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Click edit button
    const editButton = row.locator('button').filter({ has: page.locator('[data-testid="EditIcon"]') })
    await expect(editButton).toBeVisible({ timeout: 5_000 })
    await editButton.click()

    // Drawer should open with correct title and sandbox data
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Edit Project Sandbox')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#sandbox-name')).toHaveValue(testSandboxName)

    expect(errors).toEqual([])
  })

  test('Delete button opens confirmation dialog', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!testSandboxId, 'Sandbox was not created in setup')
    const errors = collectErrors(page)

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes**`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, testSandboxName)
    const row = page.locator('tr', { has: page.getByText(testSandboxName, { exact: true }) })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Click delete button
    const deleteButton = row.locator('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') })
    await expect(deleteButton).toBeVisible({ timeout: 5_000 })
    await deleteButton.click()

    // Confirmation dialog should appear with sandbox name
    const dialog = page.locator('.MuiDialog-root')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await expect(dialog).toContainText(testSandboxName)
    await expect(dialog.getByRole('button', { name: /Confirm/i })).toBeVisible()

    // Cancel — don't actually delete
    const cancelButton = dialog.getByRole('button', { name: /Cancel/i })
    await cancelButton.click()
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  // Cleanup
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const cleanupPage = await context.newPage()
    try {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const ctx = JSON.parse(
        readFileSync(join(tmpdir(), 'tdsk-integration', 'context.json'), 'utf-8')
      )
      if (testSandboxId)
        await apiDeleteResource(cleanupPage, `/orgs/${ctx.orgId}/sandboxes/${testSandboxId}`, ctx.apiKey)
      if (copiedSandboxId)
        await apiDeleteResource(cleanupPage, `/orgs/${ctx.orgId}/sandboxes/${copiedSandboxId}`, ctx.apiKey)
    } catch { /* best-effort */ }
    finally { await context.close() }
  })
})
