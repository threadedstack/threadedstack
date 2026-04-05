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
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-sandboxes-page'
const FORM_ID = 'sandbox-form'

test.describe.serial('CRUD Sandboxes', () => {
  const sandboxName = uniqueName('pw-sandbox')
  const updatedName = uniqueName('pw-sandbox-upd')
  let sandboxId: string | undefined

  test('CREATE — should create a new sandbox via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.slow()
    test.skip(!ctx.projectId, 'No projectId in context — cannot test project sandboxes')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    // Open create drawer (may be in empty state or page header action)
    await openDrawer(page, /Create Sandbox/i)

    // Fill sandbox name
    await fillField(page, 'sandbox-name', sandboxName)

    // Fill container image
    await fillField(page, 'sandbox-image', 'node:22-slim')

    // Submit the form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // Search for the sandbox in the table
    await searchInPage(page, sandboxName)

    // Verify the sandbox appears in the DataTable
    await expect(page.getByText(sandboxName)).toBeVisible({ timeout: 10_000 })

    // Get sandbox ID via API for cleanup
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

  test('READ — should display the created sandbox in the table', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId, 'No sandbox ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    // Search for the sandbox
    await searchInPage(page, sandboxName)

    // Verify sandbox name is visible
    await expect(page.getByText(sandboxName)).toBeVisible({ timeout: 10_000 })

    // Verify the image column shows the expected value
    await expect(page.getByText('node:22-slim')).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('UPDATE — should update the sandbox name via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId, 'No sandbox ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    // Search for and click the sandbox row to open edit drawer
    await searchInPage(page, sandboxName)
    const row = page.locator('tr', { has: page.getByText(sandboxName) })

    // Try the edit action button first, fall back to row click
    const editButton = row.locator('button').filter({ has: page.locator('[data-testid="EditIcon"]') })
    if ((await editButton.count()) > 0) {
      await editButton.first().click()
    } else {
      await row.click()
    }

    // Wait for edit drawer to open with the edit title
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Edit Sandbox Config')).toBeVisible({ timeout: 5_000 })

    // Update the name
    await fillField(page, 'sandbox-name', updatedName)

    // Submit
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // Search for updated name
    await searchInPage(page, updatedName)

    // Verify updated name appears
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('DELETE — should delete the sandbox', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId, 'No sandbox ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    // Search for the sandbox (using updated name from UPDATE test)
    await searchInPage(page, updatedName)

    // Find the row and click the delete action button
    const row = page.locator('tr', { has: page.getByText(updatedName) })
    const deleteButton = row.locator('.MuiIconButton-colorError').first()
    await deleteButton.click()

    // Confirm the deletion
    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    // Verify the sandbox is removed from the table
    await expect(
      page.locator('.MuiTableBody-root').getByText(updatedName)
    ).not.toBeVisible({ timeout: 10_000 })

    // Mark as cleaned up
    sandboxId = undefined

    expect(errors).toEqual([])
  })

  // Safety-net cleanup
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
