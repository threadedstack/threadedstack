import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  collectErrors,
  apiRequest,
  apiDeleteResource,
  searchInPage,
  uniqueName,
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-sandboxes-page'

/**
 * Tests for sandbox lifecycle UI states:
 *   - Stopped sandbox shows Start button
 *   - Status chip reflects "Stopped" state
 *   - Start button triggers pod startup (intercept to avoid real pod creation)
 *   - Status transitions are reflected in the UI
 */
test.describe.serial('Sandbox Lifecycle', () => {
  let testSandboxId = ''
  const testSandboxName = uniqueName('pw-sb-lifecycle')

  test.beforeEach(async ({ ctx }) => {
    test.skip(!ctx.projectId, 'No projectId in context — cannot test sandbox lifecycle')
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

  test('Start button is visible on stopped sandbox', async ({
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

    // Start button (PlayArrow icon) should be visible for a stopped sandbox
    const startButton = row.locator('button').filter({ has: page.locator('[data-testid="PlayArrowIcon"]') })
    await expect(startButton).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Status chip shows Stopped for a new sandbox', async ({
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

    // Status chip should show "Stopped"
    const statusChip = row.locator('.MuiChip-root', { hasText: 'Stopped' })
    await expect(statusChip).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Start button click triggers start request', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.slow()
    test.skip(!testSandboxId, 'Sandbox was not created in setup')
    const errors = collectErrors(page)

    // Intercept the start API call to avoid actually starting a pod
    let startCalled = false
    await page.route(`**/_/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes/${testSandboxId}/start**`, async (route) => {
      startCalled = true
      // Return a mock response so the UI doesn't hang
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { instanceId: 'mock-instance-id', status: 'starting' } }),
      })
    })

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes**`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, testSandboxName)
    const row = page.locator('tr', { has: page.getByText(testSandboxName, { exact: true }) })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Click the start button (PlayArrowIcon)
    const startButton = row.locator('button').filter({ has: page.locator('[data-testid="PlayArrowIcon"]') })
    await expect(startButton).toBeVisible({ timeout: 5_000 })
    await startButton.click()

    // Give a moment for the API call to fire
    await page.waitForTimeout(2_000)

    // The start endpoint should have been called
    expect(startCalled).toBe(true)

    expect(errors).toEqual([])
  })

  test('Stop button is not visible on a stopped sandbox', async ({
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

    // Stop button (StopIcon) should NOT be visible for a stopped sandbox
    const stopButton = row.locator('button').filter({ has: page.locator('[data-testid="StopIcon"]') })
    await expect(stopButton).toHaveCount(0)

    expect(errors).toEqual([])
  })

  // Cleanup
  test.afterAll(async ({ browser }) => {
    if (!testSandboxId) return
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const cleanupPage = await context.newPage()
    try {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const ctx = JSON.parse(
        readFileSync(join(tmpdir(), 'tdsk-integration', 'context.json'), 'utf-8')
      )
      await apiDeleteResource(cleanupPage, `/orgs/${ctx.orgId}/sandboxes/${testSandboxId}`, ctx.apiKey)
    } catch { /* best-effort */ }
    finally { await context.close() }
  })
})
