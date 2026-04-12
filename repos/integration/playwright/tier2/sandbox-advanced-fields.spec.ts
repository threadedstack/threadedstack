import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  selectOption,
  uniqueName,
  collectErrors,
  waitForDrawerClose,
  apiRequest,
  apiDeleteResource,
  searchInPage,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-sandboxes-page'
const FORM_ID = 'sandbox-form'

/**
 * Tests for advanced sandbox drawer fields:
 *   - Image Pull Policy dropdown
 *   - Resources accordion (CPU/memory limits and requests)
 *   - Container accordion (workdir, command, args)
 *   - Full create + verify persistence of all advanced fields
 */
test.describe.serial('Sandbox Advanced Fields', () => {
  const createdSandboxIds: string[] = []

  test.beforeEach(async ({ ctx }) => {
    test.skip(!ctx.projectId, 'No projectId in context — cannot test sandbox drawer')
  })

  test('Image Pull Policy dropdown defaults to IfNotPresent', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    const pullPolicyInput = page.locator('#sandbox-pull-policy')
    await expect(pullPolicyInput).toBeAttached({ timeout: 5_000 })

    // The visible text should show the default
    const pullPolicyParent = pullPolicyInput.locator('xpath=..')
    await expect(pullPolicyParent).toContainText('IfNotPresent', { timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Resources accordion shows CPU/memory fields', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Expand Resources accordion
    const accordion = page.locator('.MuiAccordionSummary-root', { hasText: 'Resources' })
    await expect(accordion).toBeVisible({ timeout: 5_000 })
    await accordion.click()

    // All four fields should be visible
    await expect(page.locator('#sandbox-cpu-limit')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#sandbox-memory-limit')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#sandbox-cpu-request')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#sandbox-memory-request')).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Container accordion shows workdir, command, args, default runtime', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Expand Container accordion
    const accordion = page.locator('.MuiAccordionSummary-root', { hasText: /^Container$/ })
    await expect(accordion).toBeVisible({ timeout: 5_000 })
    await accordion.click()

    await expect(page.locator('#sandbox-workdir')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#sandbox-command')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#sandbox-args')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#sandbox-runtime')).toBeAttached({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('CREATE with resources and container fields persists correctly', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.slow()
    const errors = collectErrors(page)
    const sandboxName = uniqueName('pw-sb-advanced')

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Basic fields
    await fillField(page, 'sandbox-name', sandboxName)
    await fillField(page, 'sandbox-image', 'node:22-slim')

    // Change image pull policy
    await selectOption(page, 'sandbox-pull-policy', 'Always')

    // Expand and fill Resources
    const resourcesAccordion = page.locator('.MuiAccordionSummary-root', { hasText: 'Resources' })
    await resourcesAccordion.click()
    await fillField(page, 'sandbox-cpu-limit', '1000m')
    await fillField(page, 'sandbox-memory-limit', '512Mi')
    await fillField(page, 'sandbox-cpu-request', '250m')
    await fillField(page, 'sandbox-memory-request', '128Mi')

    // Expand and fill Container
    const containerAccordion = page.locator('.MuiAccordionSummary-root', { hasText: /^Container$/ })
    await containerAccordion.click()
    await fillField(page, 'sandbox-workdir', '/workspace')
    await fillField(page, 'sandbox-command', '/bin/sh, -c')
    await fillField(page, 'sandbox-args', 'echo hello')

    // Submit
    await submitForm(page, FORM_ID)
    await waitForDrawerClose(page)

    // Find created sandbox for cleanup
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/sandboxes?limit=200`,
      ctx.apiKey
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data) ? body.data : []
    const found = arr.find((s) => s.name === sandboxName)
    if (found?.id) createdSandboxIds.push(found.id as string)

    // Re-open edit drawer and verify all fields persisted
    await searchInPage(page, sandboxName)
    await expect(page.getByText(sandboxName)).toBeVisible({ timeout: 10_000 })

    const row = page.locator('tr', { has: page.getByText(sandboxName) })
    const editButton = row.locator('button').filter({ has: page.locator('[data-testid="EditIcon"]') })
    if ((await editButton.count()) > 0) {
      await editButton.first().click()
    } else {
      await row.click()
    }

    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Edit Sandbox Config')).toBeVisible({ timeout: 5_000 })

    // Verify pull policy
    const editPullPolicyParent = page.locator('#sandbox-pull-policy').locator('xpath=..')
    await expect(editPullPolicyParent).toContainText('Always', { timeout: 5_000 })

    // Verify Resources
    const editResAccordion = page.locator('.MuiAccordionSummary-root', { hasText: 'Resources' })
    await editResAccordion.click()
    await expect(page.locator('#sandbox-cpu-limit')).toHaveValue('1000m')
    await expect(page.locator('#sandbox-memory-limit')).toHaveValue('512Mi')
    await expect(page.locator('#sandbox-cpu-request')).toHaveValue('250m')
    await expect(page.locator('#sandbox-memory-request')).toHaveValue('128Mi')

    // Verify Container
    const editContainerAccordion = page.locator('.MuiAccordionSummary-root', { hasText: /^Container$/ })
    await editContainerAccordion.click()
    await expect(page.locator('#sandbox-workdir')).toHaveValue('/workspace')
    await expect(page.locator('#sandbox-command')).toHaveValue('/bin/sh, -c')
    await expect(page.locator('#sandbox-args')).toHaveValue('echo hello')

    expect(errors).toEqual([])
  })

  // Cleanup
  test.afterAll(async ({ browser }) => {
    if (createdSandboxIds.length === 0) return
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const cleanupPage = await context.newPage()
    try {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const ctx = JSON.parse(
        readFileSync(join(tmpdir(), 'tdsk-integration', 'context.json'), 'utf-8')
      )
      for (const id of createdSandboxIds) {
        await apiDeleteResource(cleanupPage, `/orgs/${ctx.orgId}/sandboxes/${id}`, ctx.apiKey)
      }
    } catch { /* best-effort */ }
    finally { await context.close() }
  })
})
