import { test, expect } from '../fixtures/auth'
import { gotoAndWait, collectErrors } from '../utils/crud-helpers'

/**
 * Tests for role-gated page access.
 *
 * The authenticated test fixture logs in as the org admin (the user who created
 * the test org). These tests verify that admin-only pages are accessible with
 * admin credentials.
 *
 * Member-role tests are documented but skipped — they require a separate
 * `memberPage` fixture that authenticates as a member-role user, which does
 * not exist yet. When the fixture is added, remove the skips and verify that
 * member users are denied access to admin-only pages.
 */
test.describe('Role-Gated Access', () => {
  test('Admin user can access org settings page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/settings`, 'tdsk-org-settings-page')

    // Verify the settings page rendered with expected content
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10_000 })

    // The settings page should show the General card with org name
    await expect(page.getByText('General')).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Admin user can access org API keys page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/api-keys`, 'tdsk-org-api-keys-page')

    // Verify the API keys page rendered — heading or page content visible
    await expect(page.getByText(/API Keys/i).first()).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('Admin user can access org members page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/members`, 'tdsk-org-members-page')

    // Verify the members page rendered with the table
    const tableBody = page.locator('.MuiTableBody-root')
    await expect(tableBody).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  // Member-role fixture does not exist yet.
  // When a `memberPage` fixture is added to `fixtures/auth.ts`, these tests
  // should be unskipped and updated to use the member-authenticated page.
  test.skip('Member user cannot access org settings page', async () => {
    // Expected: navigating to /orgs/:orgId/settings as a member redirects
    // to the org detail page or shows an access-denied message.
  })

  test.skip('Member user cannot access org API keys page', async () => {
    // Expected: navigating to /orgs/:orgId/api-keys as a member redirects
    // or shows an access-denied message.
  })
})
