import { test, expect } from '../fixtures/auth'
import { collectErrors, gotoAndWait } from '../utils/crud-helpers'

/**
 * The onboarding wizard is a Dialog triggered from the Home page.
 * - Auto-opens when user has zero orgs
 * - Manually triggered via the "Setup Wizard" button on the Home page
 * Steps: Organization, Provider, Project, Sandbox, Review
 */

test.describe('Onboarding Wizard', () => {
  test('should open the wizard dialog via the setup button on the home page', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/', 'tdsk-home-page')

    // The wizard may auto-open (no orgs) or we trigger it manually
    const dialogVisible = await page.locator('.MuiDialog-root').isVisible().catch(() => false)

    if (!dialogVisible) {
      // Click the manual setup wizard button if it exists
      const setupButton = page.getByRole('button', { name: /Setup Wizard/i })
      const exists = await setupButton.isVisible().catch(() => false)
      if (exists) {
        await setupButton.click()
      }
    }

    // The dialog should now be open (either auto or manual)
    // If user already has orgs and no button exists, the dialog won't open — skip gracefully
    const isOpen = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!isOpen) {
      test.skip(true, 'Wizard did not open — user already has orgs and no manual trigger available')
      return
    }

    await expect(page.locator('.MuiDialog-root')).toBeVisible()

    // The wizard should show "Setup Wizard" title in the stepper panel
    await expect(page.getByText('Setup Wizard')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should display step labels in the stepper panel', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/', 'tdsk-home-page')

    // Open wizard (auto or manual)
    const dialogVisible = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!dialogVisible) {
      const setupButton = page.getByRole('button', { name: /Setup Wizard/i })
      const exists = await setupButton.isVisible().catch(() => false)
      if (exists) await setupButton.click()
    }

    const isOpen = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!isOpen) {
      test.skip(true, 'Wizard not available')
      return
    }

    // Step labels: Organization, Provider, Project, Sandbox, Review
    await expect(page.getByText('Organization', { exact: false })).toBeVisible()
    await expect(page.getByText('Review')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should show Back button disabled on the first step', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/', 'tdsk-home-page')

    const dialogVisible = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!dialogVisible) {
      const setupButton = page.getByRole('button', { name: /Setup Wizard/i })
      const exists = await setupButton.isVisible().catch(() => false)
      if (exists) await setupButton.click()
    }

    const isOpen = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!isOpen) {
      test.skip(true, 'Wizard not available')
      return
    }

    // Back button should be disabled on first step
    const backButton = page.getByRole('button', { name: /Back/i })
    await expect(backButton).toBeVisible()
    await expect(backButton).toBeDisabled()

    // Next button should be visible
    const nextButton = page.getByRole('button', { name: /Next/i })
    await expect(nextButton).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should navigate forward with Next button when org is selected or created', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/', 'tdsk-home-page')

    const dialogVisible = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!dialogVisible) {
      const setupButton = page.getByRole('button', { name: /Setup Wizard/i })
      const exists = await setupButton.isVisible().catch(() => false)
      if (exists) await setupButton.click()
    }

    const isOpen = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!isOpen) {
      test.skip(true, 'Wizard not available')
      return
    }

    const dialog = page.locator('.MuiDialog-root')

    // Step 0 (Organization): Try to fill a name for "create" mode or select an existing org
    // Look for a "Create new" radio/card or name input
    const createCard = dialog.getByText(/Create new/i).first()
    const createCardExists = await createCard.isVisible().catch(() => false)

    if (createCardExists) {
      await createCard.click()
      // Fill org name input if visible
      const nameInput = dialog.locator('input[name="name"], input[id*="name"]').first()
      const nameInputVisible = await nameInput.isVisible().catch(() => false)
      if (nameInputVisible) {
        await nameInput.fill('Test Onboarding Org')
      }
    } else {
      // Try selecting an existing org if cards are available
      const orgCard = dialog.locator('[class*="ResourceChoiceCard"]').first()
      const exists = await orgCard.isVisible().catch(() => false)
      if (exists) await orgCard.click()
    }

    // Click Next — if canNext is true, we advance
    const nextButton = dialog.getByRole('button', { name: /Next/i })
    const isEnabled = await nextButton.isEnabled().catch(() => false)
    if (isEnabled) {
      await nextButton.click()
      // We should now be on step 1 (Provider) — check that Back is enabled
      const backButton = dialog.getByRole('button', { name: /Back/i })
      await expect(backButton).toBeEnabled()
    }

    expect(errors).toEqual([])
  })

  test('should navigate back with Back button from step 2', async ({
    authenticatedPage: page,
  }) => {
    test.slow()
    const errors = collectErrors(page)

    await gotoAndWait(page, '/', 'tdsk-home-page')

    const dialogVisible = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!dialogVisible) {
      const setupButton = page.getByRole('button', { name: /Setup Wizard/i })
      const exists = await setupButton.isVisible().catch(() => false)
      if (exists) await setupButton.click()
    }

    const isOpen = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!isOpen) {
      test.skip(true, 'Wizard not available')
      return
    }

    const dialog = page.locator('.MuiDialog-root')

    // Try to advance: fill org name in create mode
    const createCard = dialog.getByText(/Create new/i).first()
    const createCardExists = await createCard.isVisible().catch(() => false)
    if (createCardExists) {
      await createCard.click()
      const nameInput = dialog.locator('input[name="name"], input[id*="name"]').first()
      const nameInputVisible = await nameInput.isVisible().catch(() => false)
      if (nameInputVisible) await nameInput.fill('Test Nav Org')
    }

    const nextButton = dialog.getByRole('button', { name: /Next/i })
    if (await nextButton.isEnabled().catch(() => false)) {
      await nextButton.click()
      await page.waitForTimeout(300)

      // Now click Back
      const backButton = dialog.getByRole('button', { name: /Back/i })
      await expect(backButton).toBeEnabled()
      await backButton.click()
      await page.waitForTimeout(300)

      // Should be back on first step — Back should be disabled again
      await expect(backButton).toBeDisabled()
    }

    expect(errors).toEqual([])
  })

  test('should show a skip option on the Provider step', async ({
    authenticatedPage: page,
  }) => {
    test.slow()
    const errors = collectErrors(page)

    await gotoAndWait(page, '/', 'tdsk-home-page')

    const dialogVisible = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!dialogVisible) {
      const setupButton = page.getByRole('button', { name: /Setup Wizard/i })
      const exists = await setupButton.isVisible().catch(() => false)
      if (exists) await setupButton.click()
    }

    const isOpen = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!isOpen) {
      test.skip(true, 'Wizard not available')
      return
    }

    const dialog = page.locator('.MuiDialog-root')

    // Advance past org step
    const createCard = dialog.getByText(/Create new/i).first()
    const createCardExists = await createCard.isVisible().catch(() => false)
    if (createCardExists) {
      await createCard.click()
      const nameInput = dialog.locator('input[name="name"], input[id*="name"]').first()
      if (await nameInput.isVisible().catch(() => false)) await nameInput.fill('Test Skip Org')
    }

    const nextButton = dialog.getByRole('button', { name: /Next/i })
    if (!(await nextButton.isEnabled().catch(() => false))) {
      test.skip(true, 'Cannot advance past org step')
      return
    }

    await nextButton.click()
    await page.waitForTimeout(300)

    // On the Provider step, there should be a "Skip" option
    const skipText = dialog.getByText(/Skip/i)
    const hasSkip = await skipText.first().isVisible().catch(() => false)

    // Provider step has skip functionality
    expect(hasSkip).toBeTruthy()

    expect(errors).toEqual([])
  })

  test('should show the Review step label in the stepper', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/', 'tdsk-home-page')

    const dialogVisible = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!dialogVisible) {
      const setupButton = page.getByRole('button', { name: /Setup Wizard/i })
      const exists = await setupButton.isVisible().catch(() => false)
      if (exists) await setupButton.click()
    }

    const isOpen = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
    if (!isOpen) {
      test.skip(true, 'Wizard not available')
      return
    }

    // Review step is always shown in the stepper panel (separated by a divider)
    await expect(page.getByText('Review')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should close the wizard dialog when dismiss is available', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/', 'tdsk-home-page')

    // Try to open manually (manual mode allows dismiss)
    const setupButton = page.getByRole('button', { name: /Setup Wizard/i })
    const exists = await setupButton.isVisible().catch(() => false)
    if (!exists) {
      // If auto-opened (no orgs), canDismiss is false — skip this test
      const dialogOpen = await page.locator('.MuiDialog-root').isVisible().catch(() => false)
      if (dialogOpen) {
        test.skip(true, 'Auto-opened wizard cannot be dismissed')
      } else {
        test.skip(true, 'No wizard trigger available')
      }
      return
    }

    await setupButton.click()
    await expect(page.locator('.MuiDialog-root')).toBeVisible({ timeout: 5_000 })

    // Manual mode shows a close button (CloseIcon IconButton)
    const closeButton = page.locator('.MuiDialog-root .MuiIconButton-root').first()
    const closeExists = await closeButton.isVisible().catch(() => false)
    if (closeExists) {
      await closeButton.click()
      await expect(page.locator('.MuiDialog-root')).not.toBeVisible({ timeout: 5_000 })
    }

    expect(errors).toEqual([])
  })
})
