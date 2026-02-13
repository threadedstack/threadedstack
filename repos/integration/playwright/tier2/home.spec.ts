import { test, expect } from '../fixtures/auth'

test.describe('Home Page', () => {
  test('should render and redirect to orgs', async ({ authenticatedPage: page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Home should redirect to /orgs or render content
    await expect(
      page.locator('body').first()
    ).toBeVisible()

    // Verify we either stayed on home or redirected to orgs
    const url = page.url()
    expect(url).toMatch(/\/(orgs)?$/)

    expect(errors).toEqual([])
  })
})
