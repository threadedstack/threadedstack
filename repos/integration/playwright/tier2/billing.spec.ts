import { test, expect } from '../fixtures/auth'

/**
 * React dev-mode warnings from third-party libraries that are not actionable.
 * These come from @neondatabase/neon-js auth UI components.
 */
const ignoredPatterns = [
  'Function components cannot be given refs',
  'useLayoutEffect does nothing on the server',
]

test.describe('Billing Page', () => {
  test('should render the billing page without errors', async ({ authenticatedPage: page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!ignoredPatterns.some((p) => text.includes(p))) {
          errors.push(text)
        }
      }
    })

    await page.goto('/account/billing')
    await page.waitForLoadState('networkidle')

    // Page should render at least one visible element
    await expect(
      page.locator('body').first()
    ).toBeVisible()

    // Verify we are on the billing page
    expect(page.url()).toContain('/account/billing')

    expect(errors).toEqual([])
  })
})
