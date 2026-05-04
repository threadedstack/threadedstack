import { test, expect } from '../fixtures/auth'
import { collectErrors, gotoAndWait } from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-profile-page'

test.describe('Profile Page', () => {
  test('should render the profile page with heading', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/profile', PAGE_CLASS)

    // Page heading
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should render user info card with display name and email', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/profile', PAGE_CLASS)

    // The top card shows an Avatar with display name and email
    // The auth fixture mocks the user as "Integration Test" / "integration@test.local"
    await expect(page.getByText('Integration Test')).toBeVisible()
    await expect(page.getByText('integration@test.local')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should render the Personal Information form with name fields', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/profile', PAGE_CLASS)

    // SettingsFormCard with title "Personal Information"
    await expect(page.getByText('Personal Information')).toBeVisible()

    // First Name field (id="tdsk-settings-first")
    const firstNameInput = page.locator('#tdsk-settings-first')
    await expect(firstNameInput).toBeVisible()

    // Last Name field (id="tdsk-settings-last")
    const lastNameInput = page.locator('#tdsk-settings-last')
    await expect(lastNameInput).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should render the email field as disabled', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/profile', PAGE_CLASS)

    // Email field (id="tdsk-settings-email") should be present and disabled
    const emailInput = page.locator('#tdsk-settings-email')
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toBeDisabled()

    expect(errors).toEqual([])
  })

  test('should render the Account Information card with User ID', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/profile', PAGE_CLASS)

    // InfoCard with title "Account Information"
    await expect(page.getByText('Account Information')).toBeVisible()

    // User ID label should be visible
    await expect(page.getByText('User ID')).toBeVisible()

    expect(errors).toEqual([])
  })
})
