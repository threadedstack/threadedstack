import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  waitForDrawerClose,
  confirmDelete,
  uniqueName,
  collectErrors,
  apiRequest,
  apiDeleteResource,
  searchInPage,
  selectEntityOption,
  ensureFullListLoad,
} from '../utils/crud-helpers'
import { isFeatureEnabled } from '@tdsk/domain'

const PAGE_CLASS = 'tdsk-project-schedules-page'
const FORM_ID = 'schedule-form'

test.describe.serial('CRUD Schedules', () => {
  test.beforeEach(({ ctx }, testInfo) => {
    test.skip(!isFeatureEnabled('schedules'), 'schedules feature flag is disabled')
    test.skip(!ctx.projectId, 'No projectId in context')
  })
  const cronExpr = '0 */6 * * *'
  const updatedCron = '30 9 * * 1-5'
  const promptText = `Playwright schedule test prompt ${Date.now()}`
  let scheduleId: string | undefined
  let hasSandboxes = false

  test('CREATE — should create a new schedule via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    // Check if sandboxes exist (schedules require a sandbox)
    const sandboxRes = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/sandboxes?limit=10`,
      ctx.apiKey
    )
    const sandboxBody = await sandboxRes.json()
    const sandboxes: Record<string, unknown>[] = Array.isArray(sandboxBody?.data)
      ? sandboxBody.data
      : []
    hasSandboxes = sandboxes.length > 0

    test.skip(!hasSandboxes, 'No sandboxes exist — cannot create schedule without a sandbox')

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/schedules`, PAGE_CLASS)

    // Open create drawer
    await openDrawer(page, /Create Schedule/i)

    // Select sandbox via EntitySelector autocomplete
    await selectEntityOption(page, 'sandbox-id')

    // Fill cron expression — the CronInput commits the raw expression
    // on blur, so blur explicitly after filling
    await fillField(page, 'cron-expression', cronExpr)
    await page.locator('#cron-expression').blur()

    // Fill prompt
    await fillField(page, 'tdsk-schedule-prompt-input', promptText)

    // Submit the form (schedules are created enabled by default)
    await submitForm(page, FORM_ID)

    // Wait for drawer to close (data is fetched before drawer closes)
    await waitForDrawerClose(page)

    // Verify the schedule appears in the table — look for the cron expression
    // Use .first() in case leftover data from a prior run has the same cron
    await expect(page.getByText(cronExpr).first()).toBeVisible({ timeout: 10_000 })

    // Get schedule ID via API
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/schedules?limit=200`,
      ctx.apiKey
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body)
        ? body
        : []
    const found = arr.find((s) => s.prompt === promptText)
    if (found?.id) scheduleId = found.id as string

    expect(scheduleId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('READ — should display the created schedule in the table', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!scheduleId, 'No schedule ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/schedules`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/schedules`, PAGE_CLASS)

    // Verify cron expression is visible
    await expect(page.getByText(cronExpr).first()).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('UPDATE — should edit the schedule cron expression', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!scheduleId, 'No schedule ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/schedules`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/schedules`, PAGE_CLASS)

    // Click the schedule row to open edit drawer
    const cronCell = page
      .locator('.MuiTableBody-root')
      .getByText(cronExpr)
      .first()
    await cronCell.click()

    // Wait for edit drawer to open
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // Update the cron expression — the CronInput commits the raw
    // expression on blur, so blur explicitly before submitting
    await fillField(page, 'cron-expression', updatedCron)
    await page.locator('#cron-expression').blur()

    // Submit
    await submitForm(page, FORM_ID)

    // Wait for drawer to close (data is fetched before drawer closes)
    await waitForDrawerClose(page)

    // Verify updated cron appears
    await expect(page.getByText(updatedCron)).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('DELETE — should delete the schedule', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!scheduleId, 'No schedule ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/schedules`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/schedules`, PAGE_CLASS)

    // Find the row with the updated cron and click the delete action button
    const row = page.locator('tr', { has: page.getByText(updatedCron) })
    const deleteButton = row.locator('[aria-label="Delete Schedule"]')

    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()
    } else {
      // Fallback: try error-colored icon button
      const errorButton = row.locator('.MuiIconButton-colorError').first()
      await errorButton.click()
    }

    // Confirm the deletion (data is fetched before dialog closes)
    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    // Verify the schedule is removed from the table
    await expect(
      page.locator('.MuiTableBody-root').getByText(updatedCron)
    ).not.toBeVisible({ timeout: 10_000 })

    // Mark as cleaned up
    scheduleId = undefined

    expect(errors).toEqual([])
  })

  // Safety-net cleanup
  test.afterAll(async ({ browser }) => {
    if (!scheduleId) return
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const cleanupPage = await context.newPage()
    try {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const ctx = JSON.parse(
        readFileSync(
          join(tmpdir(), 'tdsk-integration', 'context.json'),
          'utf-8'
        )
      )
      await apiDeleteResource(
        cleanupPage,
        `/orgs/${ctx.orgId}/projects/${ctx.projectId}/schedules/${scheduleId}`,
        ctx.apiKey
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
