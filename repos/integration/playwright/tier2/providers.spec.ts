import { test, expect } from '../fixtures/auth'

test.describe('Providers Page', () => {
  test('should render the providers page without errors', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto(`/orgs/${ctx.orgId}/providers`)
    await page.waitForLoadState('networkidle')

    // Page should render at least one visible element
    await expect(
      page.locator('body').first()
    ).toBeVisible()

    // Verify we are on the providers page
    expect(page.url()).toContain(`/orgs/${ctx.orgId}/providers`)

    expect(errors).toEqual([])
  })
})
