import { test, expect } from '../fixtures/auth'

test.describe('API Keys Page', () => {
  test('should render the API keys page without errors', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto(`/orgs/${ctx.orgId}/api-keys`)
    await page.waitForLoadState('networkidle')

    // Page should render at least one visible element
    await expect(
      page.locator('body').first()
    ).toBeVisible()

    // Verify we are on the API keys page
    expect(page.url()).toContain(`/orgs/${ctx.orgId}/api-keys`)

    expect(errors).toEqual([])
  })

  test('CreateApiKeyDrawer shows user selector when opened from org page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await page.goto(`/orgs/${ctx.orgId}/api-keys`)
    await page.waitForLoadState('networkidle')

    // Click "Generate API Key" button (either in the page header or empty state)
    const generateBtn = page.getByRole('button', { name: /Generate API Key/i })
    await expect(generateBtn).toBeVisible({ timeout: 10000 })
    await generateBtn.click()

    // The CreateApiKeyDrawer should open
    const drawer = page.locator('.MuiDrawer-root')
    await expect(drawer).toBeVisible({ timeout: 5000 })

    // User selector (EntitySelectorSingle with id="entity-user") should be visible
    // since no userId is pre-selected from this page
    await expect(drawer.locator('#entity-user')).toBeVisible({ timeout: 5000 })
  })
})
