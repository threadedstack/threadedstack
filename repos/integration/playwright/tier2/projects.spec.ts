import { test, expect } from '../fixtures/auth'

test.describe('Projects Page', () => {
  test('should render the projects page without errors', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto(`/orgs/${ctx.orgId}/projects`)
    await page.waitForLoadState('networkidle')

    // Page should render at least one visible element
    await expect(
      page.locator('body').first()
    ).toBeVisible()

    // Verify we are on the projects page
    expect(page.url()).toContain(`/orgs/${ctx.orgId}/projects`)

    expect(errors).toEqual([])
  })
})
