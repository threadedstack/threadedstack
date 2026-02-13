import { test, expect } from '../fixtures/auth'

test.describe('Org Detail Page', () => {
  test('should render org detail without errors', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto(`/orgs/${ctx.orgId}`)
    await page.waitForLoadState('networkidle')

    // Page should render at least one visible element
    await expect(
      page.locator('body').first()
    ).toBeVisible()

    // Verify we are on the org detail page
    expect(page.url()).toContain(`/orgs/${ctx.orgId}`)

    expect(errors).toEqual([])
  })
})
