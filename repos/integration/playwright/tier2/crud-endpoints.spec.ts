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

    // After create, page navigates to the detail page
    await page.waitForURL(/\/endpoints\/[^/]+$/, { timeout: 10_000 })

    // Extract endpoint ID from URL
    const url = page.url()
    const match = url.match(/\/endpoints\/([^/]+)$/)
    if (match) endpointId = match[1]

    // Verify the endpoint name is visible on the detail page header
    await expect(page.locator('h1, h4').getByText(endpointName)).toBeVisible({
      timeout: 10_000,
    })

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

    // Search and click the endpoint row to navigate to detail page
    await searchInPage(page, endpointName)
    const nameCell = page
      .locator('.MuiTableBody-root')
      .getByText(endpointName)
    await nameCell.click()

    // Wait for detail page to load
    await page.waitForURL(/\/endpoints\/[^/]+$/, { timeout: 10_000 })
    await page.locator('.tdsk-endpoint-layout-page').waitFor({ timeout: 10_000 })

    // Update the name on the Endpoint tab
    await expect(page.locator('#endpoint-name')).toBeVisible({ timeout: 5_000 })
    await page.locator('#endpoint-name').fill('')
    await page.locator('#endpoint-name').fill(updatedName)

    // Click Save button
    await page.getByRole('button', { name: /Save/i }).click()

    // Verify the header updates with the new name
    await expect(page.locator('h1, h4').getByText(updatedName)).toBeVisible({
      timeout: 10_000,
    })

    // Verify the update persisted via API
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}`,
      ctx.apiKey
    )
    const body = await res.json()
    expect(body?.data?.name).toBe(updatedName)

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
