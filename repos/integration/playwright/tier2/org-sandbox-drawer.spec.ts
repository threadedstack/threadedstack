import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  selectOption,
  waitForDrawerClose,
  confirmDelete,
  uniqueName,
  collectErrors,
  apiRequest,
  apiDeleteResource,
  searchInPage,
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-org-sandboxes-page'
const FORM_ID = 'org-sandbox-form'

test.describe.serial('Org Sandbox Drawer', () => {
  const sandboxName = uniqueName('pw-org-sb')
  const updatedName = uniqueName('pw-org-sb-upd')
  let sandboxId: string | undefined

  test('CREATE — should create an org sandbox via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.slow()

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Verify org drawer title
    await expect(page.getByText('Define a Runtime Environment')).toBeVisible({ timeout: 5_000 })

    await fillField(page, 'sandbox-name', sandboxName)

    // Select Custom preset to make image field visible
    await selectOption(page, 'sandbox-preset', 'Custom')

    // Expand the Container accordion to access image field
    const containerAccordion = page.locator('.MuiAccordionSummary-root', { hasText: 'Container' })
    await containerAccordion.click()

    await fillField(page, 'sandbox-image', 'node:22-slim')

    await submitForm(page, FORM_ID)
    await waitForDrawerClose(page)

    await searchInPage(page, sandboxName)
    await expect(page.getByText(sandboxName).first()).toBeVisible({ timeout: 10_000 })

    // Get sandbox ID for cleanup
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/sandboxes?limit=200`,
      ctx.apiKey
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data)
      ? body.data
      : []
    const found = arr.find((s) => s.name === sandboxName)
    if (found?.id) sandboxId = found.id as string

    expect(sandboxId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('EDIT — should open with correct title and persist changes', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId, 'No sandbox ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, sandboxName)
    const row = page.locator('tr', { has: page.getByText(sandboxName) })

    const editButton = row.locator('button').filter({ has: page.locator('[data-testid="EditIcon"]') })
    if ((await editButton.count()) > 0) {
      await editButton.first().click()
    } else {
      await row.click()
    }

    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Edit Runtime Environment')).toBeVisible({ timeout: 5_000 })

    await fillField(page, 'sandbox-name', updatedName)
    await submitForm(page, FORM_ID)
    await waitForDrawerClose(page)

    await searchInPage(page, updatedName)
    await expect(page.getByText(updatedName).first()).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('Resources accordion shows resource fields', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Expand the Resources accordion (org-only)
    const resourcesAccordion = page.locator('.MuiAccordionSummary-root', { hasText: 'Resources' })
    await expect(resourcesAccordion).toBeVisible({ timeout: 5_000 })
    await resourcesAccordion.click()

    await expect(page.locator('#sandbox-cpu-limit')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#sandbox-memory-limit')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#sandbox-cpu-request')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('#sandbox-memory-request')).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Projects multi-select is visible', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Projects multi-select is inside the defaultExpanded Sandbox accordion
    const projectsSelect = page.locator('#sandbox-projects')
    await expect(projectsSelect).toBeAttached({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('No Git Repository accordion in org drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Git Repository accordion should not exist — it's project-only
    const gitAccordion = page.locator('.MuiAccordionSummary-root', { hasText: 'Git Repository' })
    await expect(gitAccordion).toHaveCount(0)

    expect(errors).toEqual([])
  })

  test('DELETE — should delete the org sandbox', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId, 'No sandbox ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, updatedName)

    const row = page.locator('tr', { has: page.getByText(updatedName) })
    const deleteButton = row.locator('.MuiIconButton-colorError').first()
    await deleteButton.click()

    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(
      page.locator('.MuiTableBody-root').getByText(updatedName)
    ).not.toBeVisible({ timeout: 10_000 })

    sandboxId = undefined

    expect(errors).toEqual([])
  })

  test.afterAll(async ({ browser }) => {
    if (!sandboxId) return
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
        `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
        ctx.apiKey
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
