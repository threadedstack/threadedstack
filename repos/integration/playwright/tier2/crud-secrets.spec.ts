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
  findResourceByNamePaginated,
  searchInPage,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-org-secrets-page'
const FORM_ID = 'secret-form'

test.describe.serial('CRUD Secrets', () => {
  const secretName = uniqueName('pw-secret')
  const secretValue = 'test-value-12345'
  const secretDescription = 'Playwright CRUD test secret'
  const updatedDescription = 'Updated by Playwright CRUD test'
  let secretId: string | undefined

  // Clean up stale pw-secret-* entries from previous failed runs
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()
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
      let offset = 0
      const limit = 200
      while (true) {
        const res = await apiRequest(page, 'GET', `/orgs/${ctx.orgId}/secrets?limit=${limit}&offset=${offset}`, ctx.apiKey)
        const body = await res.json()
        const arr = Array.isArray(body?.data) ? body.data : []
        const stale = arr.filter((s: any) => typeof s.name === 'string' && s.name.startsWith('pw-secret-'))
        for (const s of stale) {
          await apiDeleteResource(page, `/orgs/${ctx.orgId}/secrets/${s.id}`, ctx.apiKey)
        }
        if (arr.length < limit) break
        offset += limit
      }
    } catch {
      // Best-effort cleanup
    } finally {
      await context.close()
    }
  })

  test('CREATE — should create a new secret via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/secrets`, PAGE_CLASS)

    // Open create drawer
    await openDrawer(page, /Create Secret/i)

    // Fill form fields
    await fillField(page, 'tdsk-secret-name-input', secretName)
    await fillField(page, 'tdsk-secret-value-input', secretValue)
    await fillField(page, 'tdsk-secret-description-input', secretDescription)

    // Submit the form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close (indicates API success)
    await waitForDrawerClose(page)

    // Search for the secret in the filtered list
    await searchInPage(page, secretName)

    // Verify the secret appears in the DataTable
    await expect(page.getByText(secretName)).toBeVisible({ timeout: 10_000 })

    // Verify the secret was actually persisted via API (paginated search)
    const found = await findResourceByNamePaginated(
      page,
      `/orgs/${ctx.orgId}/secrets`,
      ctx.apiKey,
      secretName
    )

    expect(found, `Secret "${secretName}" not found via paginated API search`).toBeTruthy()

    secretId = found!.id as string

    expect(errors).toEqual([])
  })

  test('READ — should display the created secret in the list', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!secretId, 'No secret ID — CREATE must have failed')

    const errors = collectErrors(page)

    // Verify the secret exists via paginated API search
    const apiFound = await findResourceByNamePaginated(
      page,
      `/orgs/${ctx.orgId}/secrets`,
      ctx.apiKey,
      secretName
    )

    expect(apiFound, `Secret "${secretName}" should exist in API`).toBeTruthy()

    // Now check the UI
    await gotoAndWait(page, `/orgs/${ctx.orgId}/secrets`, PAGE_CLASS)

    // Search for our test secret to filter the list
    await searchInPage(page, secretName)

    // Verify secret name is visible in the table
    await expect(page.getByText(secretName)).toBeVisible({ timeout: 10_000 })

    // Verify the description column shows our text
    await expect(page.getByText(secretDescription)).toBeVisible()

    // Verify the scope chip shows "Org"
    const row = page.locator('tr', { has: page.getByText(secretName) })
    await expect(row.getByText('Org')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('UPDATE — should edit the secret description', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!secretId, 'No secret ID — CREATE must have failed')

    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/secrets`, PAGE_CLASS)

    // Search for our test secret
    await searchInPage(page, secretName)

    // Click on the secret row to open the edit drawer
    const nameCell = page.locator('.MuiTableBody-root').getByText(secretName)
    await nameCell.click()

    // Wait for drawer to open in edit mode
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // Update the description
    await fillField(page, 'tdsk-secret-description-input', updatedDescription)

    // Submit the form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // Re-search to see the updated secret
    await searchInPage(page, secretName)

    // Verify updated description appears in the table
    await expect(page.getByText(updatedDescription)).toBeVisible({
      timeout: 10_000,
    })

    expect(errors).toEqual([])
  })

  test('DELETE — should delete the secret', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!secretId, 'No secret ID — CREATE must have failed')

    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/secrets`, PAGE_CLASS)

    // Search for our test secret
    await searchInPage(page, secretName)

    // Find the row and click the delete action button (red/error colored)
    const row = page.locator('tr', { has: page.getByText(secretName) })
    const deleteButton = row.locator('.MuiIconButton-colorError').first()
    await deleteButton.click()

    // Confirm the deletion and wait for dialog to close
    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    // Verify the secret is removed from the table
    await expect(
      page.locator('.MuiTableBody-root').getByText(secretName)
    ).not.toBeVisible({ timeout: 10_000 })

    // Mark as cleaned up
    secretId = undefined

    expect(errors).toEqual([])
  })

  // Safety-net cleanup if DELETE test didn't run or failed
  test.afterAll(async ({ browser }) => {
    if (!secretId) return
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()
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
        page,
        `/orgs/${ctx.orgId}/secrets/${secretId}`,
        ctx.apiKey
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
