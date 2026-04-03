import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  waitForDrawerClose,
  uniqueName,
  collectErrors,
  apiRequest,
  apiDeleteResource,
  selectOption,
} from '../utils/crud-helpers'

const LIST_PAGE_CLASS = 'tdsk-project-endpoints-page'
const DETAIL_PAGE_CLASS = 'tdsk-endpoint-layout-page'

test.describe.serial('Endpoint Detail Page', () => {
  const endpointName = uniqueName('pw-detail-ep')
  const updatedName = uniqueName('pw-detail-upd')
  let endpointId: string | undefined

  test('SETUP — create endpoint for detail page tests', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      LIST_PAGE_CLASS
    )

    await openDrawer(page, /Create Endpoint/i)
    await fillField(page, 'endpoint-name', endpointName)
    await selectOption(page, 'endpoint-type', 'Proxy')
    await selectOption(page, 'endpoint-method', 'POST')
    await fillField(page, 'endpoint-path', `/test-detail/${Date.now()}`)
    await fillField(page, 'endpoint-url', 'https://httpbin.org/post')
    await submitForm(page, 'endpoint-form')
    await waitForDrawerClose(page)

    // After create, page navigates to detail page
    await page.waitForURL(/\/endpoints\/[^/]+$/, { timeout: 10_000 })

    // Extract endpoint ID from URL
    const url = page.url()
    const match = url.match(/\/endpoints\/([^/]+)$/)
    if (match) endpointId = match[1]

    expect(endpointId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('NAVIGATE — row click should navigate to detail page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      LIST_PAGE_CLASS
    )

    // Click the endpoint row
    const nameCell = page.locator('.MuiTableBody-root').getByText(endpointName)
    await nameCell.click()

    // Should navigate to detail page
    await page.waitForURL(/\/endpoints\/[^/]+$/, { timeout: 10_000 })
    await page.locator(`.${DETAIL_PAGE_CLASS}`).waitFor({ timeout: 10_000 })

    // Verify endpoint name in header
    await expect(page.locator('h1, h4').getByText(endpointName)).toBeVisible()

    // Verify tabs are visible
    await expect(page.getByRole('tab', { name: 'Endpoint' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Proxy' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Test' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('DIRECT URL — should load detail page via direct URL', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}`,
      DETAIL_PAGE_CLASS
    )

    // Verify endpoint name in header
    await expect(page.locator('h1, h4').getByText(endpointName)).toBeVisible()

    expect(errors).toEqual([])
  })

  test('TAB NAVIGATION — should switch between tabs', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}`,
      DETAIL_PAGE_CLASS
    )

    // Click Config tab (labeled "Proxy" for proxy endpoints)
    await page.getByRole('tab', { name: 'Proxy' }).click()
    await page.waitForURL(/\/config$/, { timeout: 5_000 })

    // Click Test tab
    await page.getByRole('tab', { name: 'Test' }).click()
    await page.waitForURL(/\/test$/, { timeout: 5_000 })

    // Click back to Endpoint tab
    await page.getByRole('tab', { name: 'Endpoint' }).click()
    // URL should NOT have /config or /test suffix
    await page.waitForURL(/\/endpoints\/[^/]+$/, { timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('EDIT METADATA — should edit endpoint name on Endpoint tab', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}`,
      DETAIL_PAGE_CLASS
    )

    // Should be on Endpoint tab by default
    await expect(page.locator('#endpoint-name')).toBeVisible({ timeout: 5_000 })

    // Clear and fill the name field
    await page.locator('#endpoint-name').fill('')
    await page.locator('#endpoint-name').fill(updatedName)

    // Click Save button
    await page.getByRole('button', { name: /Save/i }).click()

    // Verify the header updates with the new name (the page refreshes state from API)
    await expect(page.locator('h1, h4').getByText(updatedName)).toBeVisible({
      timeout: 10_000,
    })

    expect(errors).toEqual([])
  })

  test('BREADCRUMBS — clicking Endpoints link should navigate back to list', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}`,
      DETAIL_PAGE_CLASS
    )

    // Click the "Endpoints" breadcrumb link
    await page.getByRole('link', { name: /Endpoints/i }).first().click()

    // Should navigate back to the list
    await page.locator(`.${LIST_PAGE_CLASS}`).waitFor({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('DEEP LINK CONFIG — should load config tab via direct URL', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}/config`,
      DETAIL_PAGE_CLASS
    )

    // Verify the Proxy tab is active (proxy endpoint)
    const proxyTab = page.getByRole('tab', { name: 'Proxy' })
    await expect(proxyTab).toBeVisible({ timeout: 5_000 })
    await expect(proxyTab).toHaveAttribute('aria-selected', 'true')

    expect(errors).toEqual([])
  })

  test('DEEP LINK TEST — should load test tab via direct URL', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}/test`,
      DETAIL_PAGE_CLASS
    )

    // Verify the Test tab is active
    const testTab = page.getByRole('tab', { name: 'Test' })
    await expect(testTab).toBeVisible({ timeout: 5_000 })
    await expect(testTab).toHaveAttribute('aria-selected', 'true')

    expect(errors).toEqual([])
  })

  test('CONFIG TAB SAVE — should save proxy config on the Proxy tab', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}/config`,
      DETAIL_PAGE_CLASS
    )

    // Verify the proxy URL field is visible
    const urlInput = page.locator('#endpoint-url')
    await expect(urlInput).toBeVisible({ timeout: 5_000 })

    // Change the proxy URL
    await urlInput.fill('')
    await urlInput.fill('https://httpbin.org/anything')

    // Click Save and wait for success toast
    await page.getByRole('button', { name: /Save/i }).click()
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10_000 })

    // Verify save succeeded via API
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}`,
      ctx.apiKey
    )
    const body = await res.json()
    expect(body?.data?.options?.url).toBe('https://httpbin.org/anything')

    expect(errors).toEqual([])
  })

  test('UNSAVED CHANGES — should show dialog when navigating with dirty form', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}`,
      DETAIL_PAGE_CLASS
    )

    // Modify the name field to make the form dirty
    await expect(page.locator('#endpoint-name')).toBeVisible({ timeout: 5_000 })
    const currentName = await page.locator('#endpoint-name').inputValue()
    await page.locator('#endpoint-name').fill(`${currentName}-dirty`)

    // Try to navigate away via breadcrumbs
    await page.getByRole('link', { name: /Endpoints/i }).first().click()

    // The unsaved changes dialog should appear with Stay/Discard buttons
    const stayButton = page.getByRole('button', { name: /Stay/i })
    await expect(stayButton).toBeVisible({ timeout: 5_000 })

    // Click "Stay" to remain on the page
    await stayButton.click()
    await expect(stayButton).not.toBeVisible({ timeout: 5_000 })

    // Should still be on the detail page
    await expect(page.locator(`.${DETAIL_PAGE_CLASS}`)).toBeVisible()

    // Now try again and click "Discard"
    await page.getByRole('link', { name: /Endpoints/i }).first().click()
    const discardButton = page.getByRole('button', { name: /Discard/i })
    await expect(discardButton).toBeVisible({ timeout: 5_000 })
    await discardButton.click()

    // Should navigate back to the list
    await page.locator(`.${LIST_PAGE_CLASS}`).waitFor({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('TYPE CHANGE — should show confirmation dialog and disable tabs', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}`,
      DETAIL_PAGE_CLASS
    )

    // Change the endpoint type from Proxy to FaaS
    await selectOption(page, 'endpoint-type', 'FaaS')

    // Confirmation dialog should appear
    const confirmButton = page.getByRole('button', { name: /Confirm/i })
    await expect(confirmButton).toBeVisible({ timeout: 5_000 })

    // Confirm the type change
    await confirmButton.click()
    await expect(confirmButton).not.toBeVisible({ timeout: 5_000 })

    // Config and Test tabs should be disabled (tab label is still "Proxy"
    // because Jotai state hasn't updated yet — it updates on save)
    const testTab = page.getByRole('tab', { name: 'Test' })
    await expect(testTab).toHaveClass(/Mui-disabled/, { timeout: 5_000 })

    // Save the type change to re-enable tabs
    await page.getByRole('button', { name: /Save/i }).click()
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10_000 })

    // Tabs should be re-enabled after save
    await expect(testTab).not.toHaveClass(/Mui-disabled/, { timeout: 10_000 })

    // The config tab label should now reflect the new type
    await expect(page.getByRole('tab', { name: 'Function' })).toBeVisible({ timeout: 5_000 })

    // Revert back to Proxy for remaining tests
    await selectOption(page, 'endpoint-type', 'Proxy')
    const revertConfirm = page.getByRole('button', { name: /Confirm/i })
    await expect(revertConfirm).toBeVisible({ timeout: 5_000 })
    await revertConfirm.click()
    await page.getByRole('button', { name: /Save/i }).click()
    await expect(page.getByRole('tab', { name: 'Proxy' })).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('DELETE — should delete endpoint from detail page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!endpointId, 'No endpoint ID')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints/${endpointId}`,
      DETAIL_PAGE_CLASS
    )

    // Click Delete button in header
    await page.getByRole('button', { name: /Delete/i }).click()

    // Confirm deletion in dialog
    await expect(page.locator('.MuiDialog-root')).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: /Confirm/i }).last().click()

    // Should navigate back to list
    await page.locator(`.${LIST_PAGE_CLASS}`).waitFor({ timeout: 10_000 })

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
