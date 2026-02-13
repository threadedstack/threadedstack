import { test, expect } from '../fixtures/auth'

test.describe('Orgs List Page', () => {
  test('should render the org list without errors', async ({ authenticatedPage: page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/orgs')
    await page.waitForLoadState('networkidle')

    // Page should render at least one visible element
    await expect(
      page.locator('body').first()
    ).toBeVisible()

    // Verify we are on the orgs page
    expect(page.url()).toContain('/orgs')

    expect(errors).toEqual([])
  })
})
