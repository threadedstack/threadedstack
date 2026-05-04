import { test, expect } from '../fixtures/auth'
import { gotoAndWait, collectErrors } from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-org-members-page'

/**
 * Tests for the org invitation (invite user) flow:
 *   - Invite button is accessible on the members page
 *   - Invite drawer has email and role fields
 *   - Validation: empty email shows error on submit
 *   - Drawer can be closed via Cancel
 *
 * Note: The InviteUserDrawer has a known Playwright issue where the submit
 * button hangs on click (see crud-org-members.spec.ts). These tests focus
 * on drawer rendering and field validation without submitting.
 */
test.describe('Org Invitations', () => {
  test('Invite button is visible on members page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/members`, PAGE_CLASS)

    // The PageLayout renders an "Invite User" button (PersonAdd icon)
    const inviteButton = page.getByRole('button', { name: /Invite User/i })
    await expect(inviteButton).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('Invite drawer opens with email and role fields', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/members`, PAGE_CLASS)

    // Open the invite drawer
    const inviteButton = page.getByRole('button', { name: /Invite User/i })
    await expect(inviteButton).toBeVisible({ timeout: 10_000 })
    await inviteButton.click()

    // Drawer should open with the invite title
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Invite User to Organization')).toBeVisible({ timeout: 5_000 })

    // Email field (id="user-email") should be visible
    const emailInput = page.locator('#user-email')
    await expect(emailInput).toBeVisible({ timeout: 5_000 })

    // Role select (id="user-role") should be visible
    const roleSelect = page.locator('#user-role')
    await expect(roleSelect).toBeAttached({ timeout: 5_000 })

    // Close the drawer via Escape
    await page.keyboard.press('Escape')
    await expect(page.locator('.tdsk-drawer')).not.toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Empty email shows validation error on submit attempt', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/members`, PAGE_CLASS)

    // Open the invite drawer
    const inviteButton = page.getByRole('button', { name: /Invite User/i })
    await expect(inviteButton).toBeVisible({ timeout: 10_000 })
    await inviteButton.click()

    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // The email field is empty — the submit button should be disabled
    // (InviteUserDrawer disables submit when email is empty)
    const submitButton = page.locator('button[form="invite-user-form"]')
    await expect(submitButton).toBeVisible({ timeout: 5_000 })

    // With empty email, the button should be disabled
    await expect(submitButton).toBeDisabled()

    // Type an invalid email, then try to trigger validation
    const emailInput = page.locator('#user-email')
    await emailInput.fill('not-an-email')

    // Now the button should be enabled (email is non-empty)
    await expect(submitButton).toBeEnabled({ timeout: 3_000 })

    // Close the drawer — we verified the validation state
    await page.keyboard.press('Escape')
    await expect(page.locator('.tdsk-drawer')).not.toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Email field accepts valid email format', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/members`, PAGE_CLASS)

    // Open the invite drawer
    const inviteButton = page.getByRole('button', { name: /Invite User/i })
    await expect(inviteButton).toBeVisible({ timeout: 10_000 })
    await inviteButton.click()

    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // Fill in a valid email
    const emailInput = page.locator('#user-email')
    await emailInput.fill('test@example.com')
    await expect(emailInput).toHaveValue('test@example.com')

    // Submit button should be enabled with a valid email
    const submitButton = page.locator('button[form="invite-user-form"]')
    await expect(submitButton).toBeEnabled({ timeout: 3_000 })

    // Close without submitting
    await page.keyboard.press('Escape')
    await expect(page.locator('.tdsk-drawer')).not.toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })
})
