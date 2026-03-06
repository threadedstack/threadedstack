import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  collectErrors,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-org-domains-page'
const FORM_ID = 'domain-form'

test.describe('Domains UI', () => {
  test('should navigate to domains page and display the table', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/domains`, PAGE_CLASS)

    // Verify the page header and DataTable are visible
    await expect(page.getByRole('heading', { name: 'Domains' })).toBeVisible()
    await expect(page.locator('.MuiTable-root')).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('should open the Add Domain drawer and validate form', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/domains`, PAGE_CLASS)

    // Open the create drawer
    await openDrawer(page, /Add.*Domain/i)

    // Verify the drawer title
    await expect(page.getByText('Add New Domain')).toBeVisible()

    // Verify form fields are present
    await expect(page.locator('#tdsk-domain-name-input')).toBeVisible()
    await expect(page.locator('#tdsk-ssl-private-key-input')).toBeVisible()
    await expect(page.locator('#tdsk-ssl-certificate-input')).toBeVisible()

    // Submit without filling — should show validation error (invalid domain)
    await submitForm(page, FORM_ID)
    await expect(page.getByText(/valid domain/i)).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('should show DNS error for non-resolvable domain', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/domains`, PAGE_CLASS)

    // Open the create drawer
    await openDrawer(page, /Add.*Domain/i)

    // Fill a valid-format domain that won't resolve in DNS
    await fillField(page, 'tdsk-domain-name-input', 'pw-test-nonexistent.example.com')

    // Submit — should show DNS verification error from the backend
    await submitForm(page, FORM_ID)

    // Wait for the API error to display (DNS lookup can take several seconds)
    await expect(
      page.locator('.MuiAlert-message', { hasText: /Failed to create domain/i })
    ).toBeVisible({ timeout: 30_000 })

    // Drawer should still be open (error state)
    await expect(page.locator('.tdsk-drawer')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should open edit drawer when clicking a domain row', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/domains`, PAGE_CLASS)

    // Check if there are any existing domains in the table
    const rows = page.locator('.MuiTableBody-root tr')
    const rowCount = await rows.count()

    if (rowCount === 0) {
      test.skip(true, 'No existing domains to test edit drawer')
      return
    }

    // Click the first domain row to open the edit drawer
    await rows.first().click()

    // Verify the edit drawer opens
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Edit Domain')).toBeVisible()

    // Verify the Delete button is available in edit mode
    const deleteButton = page.locator('.tdsk-drawer').getByRole('button', {
      name: /Delete/i,
    })
    await expect(deleteButton).toBeVisible({ timeout: 3_000 })

    expect(errors).toEqual([])
  })
})
