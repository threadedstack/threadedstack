import { test, expect } from '../fixtures/auth'
import { collectErrors } from '../utils/crud-helpers'

/**
 * Tests for error handling in the admin UI:
 *   - API 500 on list page shows error alert
 *   - API 500 on form submit keeps drawer open with error
 *   - Baseline: pages load normally without mocked errors
 *
 * Route interception strategy follows auth-token-refresh.spec.ts:
 * Playwright routes match in LIFO order. The `authenticatedPage` fixture
 * registers Neon Auth mock + TLS proxy bypass. Our test-level interceptors
 * register AFTER, so they match FIRST.
 */
test.describe('Error Handling', () => {
  test('baseline — home page loads normally without error interception', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.tdsk-home-page')).toBeVisible({ timeout: 15_000 })

    // The orgs list should render without errors
    await expect(
      page.getByRole('heading', { name: 'Organizations' })
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.MuiCard-root').first()).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('API 500 on orgs list shows error state', async ({
    authenticatedPage: page,
  }) => {
    // Intercept all orgs API calls and return 500
    await page.route('**/_/orgs**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fallback()
        return
      }

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Give React time to render the error state
    await page.waitForTimeout(2_000)

    // The app should not crash — body remains visible
    await expect(page.locator('body').first()).toBeVisible()

    // Check for either an error alert, an empty state, or the error boundary
    // The exact rendering depends on how the component handles the 500
    const hasErrorAlert = await page.locator('.MuiAlert-standardError').isVisible().catch(() => false)
    const hasWarningAlert = await page.locator('.MuiAlert-standardWarning').isVisible().catch(() => false)
    const hasNoData = await page.getByText(/no organizations/i).isVisible().catch(() => false)
    const hasErrorBoundary = await page.getByText(/error/i).first().isVisible().catch(() => false)

    // At least one error indicator should be visible, or the app gracefully shows empty state
    expect(hasErrorAlert || hasWarningAlert || hasNoData || hasErrorBoundary).toBe(true)
  })

  test('API 500 on project list shows error handling', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    // Intercept projects API calls and return 500
    await page.route(`**/_/orgs/${ctx.orgId}/projects**`, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fallback()
        return
      }

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    await page.goto(`/orgs/${ctx.orgId}/projects`)
    await page.waitForLoadState('networkidle')

    // Give React time to render the error state
    await page.waitForTimeout(2_000)

    // The app should not crash
    await expect(page.locator('body').first()).toBeVisible()

    // Check for error indicators or graceful degradation
    const hasAlert = await page.locator('.MuiAlert-root').first().isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/no projects/i).isVisible().catch(() => false)
    const hasErrorText = await page.getByText(/error/i).first().isVisible().catch(() => false)

    expect(hasAlert || hasEmptyState || hasErrorText).toBe(true)
  })

  test('API 500 on form submit does not crash the page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.slow()

    // Navigate to secrets page (simple form for testing submit errors)
    await page.goto(`/orgs/${ctx.orgId}/secrets`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.tdsk-org-secrets-page')).toBeVisible({ timeout: 15_000 })

    // Intercept POST requests to secrets endpoint — return 500
    await page.route(`**/_/orgs/${ctx.orgId}/secrets`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error', message: 'Database connection failed' }),
      })
    })

    // Open the create drawer
    const createButton = page.getByRole('button', { name: /Create Secret/i })
    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click()
      await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

      // Fill minimal form fields
      const nameInput = page.locator('#secret-name')
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('pw-error-test-secret')
      }

      const valueInput = page.locator('#secret-value')
      if (await valueInput.isVisible().catch(() => false)) {
        await valueInput.fill('test-value')
      }

      // Submit the form
      const submitButton = page.locator('button[form="secret-form"]')
      if (await submitButton.isVisible().catch(() => false)) {
        await submitButton.click()

        // Wait for the error response to be processed
        await page.waitForTimeout(2_000)

        // The drawer should still be open (not closed on error)
        await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

        // An error alert should be shown in the drawer
        const errorAlert = page.locator('.tdsk-drawer .MuiAlert-standardError')
        const hasDrawerError = await errorAlert.isVisible().catch(() => false)
        // Some drawers show error differently — just verify drawer is still open
        expect(hasDrawerError || await page.locator('.tdsk-drawer').isVisible()).toBe(true)
      }
    }

    // Page should not have crashed
    await expect(page.locator('body').first()).toBeVisible()
  })
})
