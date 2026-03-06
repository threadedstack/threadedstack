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

const PAGE_CLASS = 'tdsk-org-providers-page'
const FORM_ID = 'provider-form'

test.describe.serial('CRUD Providers', () => {
  const providerName = uniqueName('pw-provider')
  const updatedName = uniqueName('pw-provider-upd')
  let providerId: string | undefined

  test('CREATE — should create a new provider via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/providers`, PAGE_CLASS)

    // Open create drawer
    await openDrawer(page, /Create Provider/i)

    // Select provider type: "ai"
    await selectOption(page, 'provider-type', 'AI')

    // Select brand: "openai"
    await selectOption(page, 'provider-brand', 'OpenAI')

    // Brand selection triggers a useEffect that auto-fills the name.
    // Wait for the effect to settle, then overwrite with our custom name.
    const nameInput = page.locator('#provider-name')
    await expect(nameInput).not.toHaveValue('', { timeout: 3_000 })
    // Let React effects and MUI animations fully settle
    await page.waitForTimeout(1000)

    // Use triple-click + keyboard.type for reliable React controlled input override
    await nameInput.click({ clickCount: 3 })
    await page.keyboard.type(providerName)

    // Verify our name stuck
    await expect(nameInput).toHaveValue(providerName)

    // Submit the form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // Search for the provider in the table
    await searchInPage(page, providerName)

    // Verify the provider appears in the DataTable
    await expect(page.getByText(providerName)).toBeVisible({ timeout: 10_000 })

    // Get provider ID via API for subsequent tests
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/providers?limit=200`,
      ctx.apiKey
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data)
      ? body.data
      : []
    const found = arr.find((p) => p.name === providerName)
    if (found?.id) providerId = found.id as string

    expect(providerId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('READ — should display the created provider in the table', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!providerId, 'No provider ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/providers`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/providers`, PAGE_CLASS)

    // Search for the provider
    await searchInPage(page, providerName)

    // Verify provider name is visible
    await expect(page.getByText(providerName)).toBeVisible({ timeout: 10_000 })

    // Verify the type chip shows AI
    const row = page.locator('tr', { has: page.getByText(providerName) })
    await expect(row.locator('.MuiChip-root').getByText('ai')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('UPDATE — should edit the provider name', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!providerId, 'No provider ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/providers`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/providers`, PAGE_CLASS)

    // Search for and click the provider row to open edit drawer
    await searchInPage(page, providerName)
    const nameCell = page.locator('.MuiTableBody-root').getByText(providerName)
    await nameCell.click()

    // Wait for edit drawer to open
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // Update the name
    await fillField(page, 'provider-name', updatedName)

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

  test('DELETE — should delete the provider', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!providerId, 'No provider ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/providers`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/providers`, PAGE_CLASS)

    // Search for the provider (using updated name from UPDATE test)
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

    // Verify the provider is removed from the table
    await expect(
      page.locator('.MuiTableBody-root').getByText(updatedName)
    ).not.toBeVisible({ timeout: 10_000 })

    // Mark as cleaned up
    providerId = undefined

    expect(errors).toEqual([])
  })

  // Safety-net cleanup
  test.afterAll(async ({ browser }) => {
    if (!providerId) return
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
        `/orgs/${ctx.orgId}/providers/${providerId}`,
        ctx.apiKey
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
