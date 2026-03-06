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
  selectOption,
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-endpoints-page'
const FORM_ID = 'endpoint-form'

test.describe.serial('CRUD Endpoints', () => {
  const endpointName = uniqueName('pw-endpoint')
  const updatedName = uniqueName('pw-endpoint-upd')
  let endpointId: string | undefined

  test('CREATE — should create a new endpoint via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.projectId, 'No projectId in context — cannot test endpoints')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      PAGE_CLASS
    )

    // Open create drawer
    await openDrawer(page, /Create Endpoint/i)

    // Fill endpoint name
    await fillField(page, 'endpoint-name', endpointName)

    // Select endpoint type: "proxy"
    await selectOption(page, 'endpoint-type', 'Proxy')

    // Select HTTP method: "GET"
    await selectOption(page, 'endpoint-method', 'GET')

    // Fill path
    await fillField(page, 'endpoint-path', `/test/${Date.now()}`)

    // For proxy type, fill the required Proxy URL
    await fillField(page, 'endpoint-url', 'https://httpbin.org/get')

    // Submit the form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // Search for the endpoint in the table
    await searchInPage(page, endpointName)

    // Verify the endpoint appears in the DataTable
    await expect(page.getByText(endpointName)).toBeVisible({ timeout: 10_000 })

    // Get endpoint ID via API
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints?limit=200`,
      ctx.apiKey
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data)
      ? body.data
      : []
    const found = arr.find((e) => e.name === endpointName)
    if (found?.id) endpointId = found.id as string

    expect(endpointId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('READ — should display the created endpoint in the table', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      PAGE_CLASS
    )

    // Search for the endpoint
    await searchInPage(page, endpointName)

    // Verify endpoint name is visible
    await expect(page.getByText(endpointName)).toBeVisible({ timeout: 10_000 })

    // Verify method chip
    const row = page.locator('tr', { has: page.getByText(endpointName) })
    await expect(row.getByText('GET')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('UPDATE — should edit the endpoint name', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      PAGE_CLASS
    )

    // Search and click the endpoint row to open edit drawer
    await searchInPage(page, endpointName)
    const nameCell = page
      .locator('.MuiTableBody-root')
      .getByText(endpointName)
    await nameCell.click()

    // Wait for edit drawer to open
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // Update the name
    await fillField(page, 'endpoint-name', updatedName)

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

  test('DELETE — should delete the endpoint', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      PAGE_CLASS
    )

    // Search for the endpoint (using updated name)
    await searchInPage(page, updatedName)

    // Find the row and click the delete action button
    const row = page.locator('tr', { has: page.getByText(updatedName) })
    const deleteButton = row.locator('[aria-label="Delete endpoint"]')

    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()
    } else {
      // Fallback: try error-colored icon button
      const errorButton = row.locator('.MuiIconButton-colorError').first()
      await errorButton.click()
    }

    // Confirm the deletion
    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    // Verify the endpoint is removed from the table
    await expect(
      page.locator('.MuiTableBody-root').getByText(updatedName)
    ).not.toBeVisible({ timeout: 10_000 })

    // Mark as cleaned up
    endpointId = undefined

    expect(errors).toEqual([])
  })

  // Safety-net cleanup
  test.afterAll(async ({ browser }) => {
    if (!endpointId) return
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
        `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}`,
        ctx.apiKey
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
