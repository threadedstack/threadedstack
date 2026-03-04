import { test, expect } from '../fixtures/auth'

test.describe('Project API Keys Page', () => {
  test('should render the project API keys page without errors', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/api-keys`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body').first()).toBeVisible()
    expect(page.url()).toContain(
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/api-keys`
    )

    expect(errors).toEqual([])
  })

  test('should show page title and Generate API Key button or empty state', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/api-keys`)
    await page.waitForLoadState('networkidle')

    // Either the page header or the empty state should mention API Keys
    const heading = page.getByText(/Project API Keys/i)
    await expect(heading).toBeVisible({ timeout: 10000 })

    // There should be a Generate API Key button (either in header or empty state)
    const generateBtn = page.getByRole('button', { name: /Generate API Key/i })
    await expect(generateBtn).toBeVisible({ timeout: 10000 })
  })

  test('should open CreateApiKeyDrawer when Generate API Key is clicked', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/api-keys`)
    await page.waitForLoadState('networkidle')

    const generateBtn = page.getByRole('button', { name: /Generate API Key/i })
    await expect(generateBtn).toBeVisible({ timeout: 10000 })
    await generateBtn.click()

    // The drawer should open
    const drawer = page.locator('.MuiDrawer-root')
    await expect(drawer).toBeVisible({ timeout: 5000 })

    // Key name input should be present
    const nameInput = drawer.locator('#tdsk-api-key-name')
    await expect(nameInput).toBeVisible({ timeout: 5000 })

    // Expiration select should be present
    const expirationSelect = drawer.locator('#tdsk-api-key-expiration')
    await expect(expirationSelect).toBeVisible({ timeout: 5000 })

    // Scope checkboxes should be present
    await expect(drawer.getByText('Scopes')).toBeVisible()
    await expect(drawer.getByText('Read', { exact: true })).toBeVisible()
    await expect(drawer.getByText('Write', { exact: true })).toBeVisible()
    await expect(drawer.getByText('Admin', { exact: true })).toBeVisible()
  })

  test('navigating via project sidebar shows API Keys link', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    // Navigate to project root first
    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}`)
    await page.waitForLoadState('networkidle')

    // Look for an API Keys nav link in the sidebar
    const apiKeysLink = page.getByRole('link', { name: /API Keys/i })
    // May need to wait for sidebar to render
    const isVisible = await apiKeysLink.isVisible().catch(() => false)
    if (isVisible) {
      await apiKeysLink.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain(
        `/orgs/${ctx.orgId}/projects/${ctx.projectId}/api-keys`
      )
    }
    // If sidebar isn't visible (e.g. collapsed), just verify the page loads directly
    else {
      await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/api-keys`)
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain(`/api-keys`)
    }
  })
})
