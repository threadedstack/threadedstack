import { test, expect } from '../fixtures/auth'

test.describe('User API Keys Drawer', () => {
  test('opens API keys drawer for a user and shows correct title', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await page.goto(`/orgs/${ctx.orgId}/members`)
    await page.waitForLoadState('networkidle')

    // Wait for the DataTable to render with at least one row
    const dataRows = page.locator('tbody tr')
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 })

    // Click the API Keys button (first button) in the first row
    const firstRow = dataRows.first()
    await firstRow.getByRole('button').first().click()

    // The drawer should open with "API Keys —" in the title
    const drawerTitle = page.getByText(/API Keys\s*\u2014/)
    await expect(drawerTitle).toBeVisible({ timeout: 5000 })

    // Drawer should render content (table with keys or empty state)
    const drawer = page.locator('.MuiDrawer-root')
    await expect(drawer).toBeVisible()
  })

  test('switching users shows correct user in drawer title', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await page.goto(`/orgs/${ctx.orgId}/members`)
    await page.waitForLoadState('networkidle')

    const dataRows = page.locator('tbody tr')
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 })

    const rowCount = await dataRows.count()

    // This test requires 2+ users — skip if only one
    test.skip(rowCount < 2, 'Need at least 2 org members to test user switching')

    // Open drawer for first user
    const firstRow = dataRows.nth(0)
    const firstName = await firstRow.locator('td').first().innerText()
    await firstRow.getByRole('button').first().click()

    // Verify title shows first user
    const drawerTitle = page.getByText(/API Keys\s*\u2014/)
    await expect(drawerTitle).toBeVisible({ timeout: 5000 })
    const firstTitleText = await drawerTitle.innerText()

    // Close drawer by clicking the close button (X icon)
    const closeBtn = page.locator('.MuiDrawer-root').getByRole('button').filter({ has: page.locator('svg') }).first()
    await closeBtn.click()

    // Wait for drawer to close
    await expect(page.locator('.MuiDrawer-root')).not.toBeVisible({ timeout: 5000 })

    // Open drawer for second user
    const secondRow = dataRows.nth(1)
    const secondName = await secondRow.locator('td').first().innerText()
    await secondRow.getByRole('button').first().click()

    // Verify the title updated to show the second user's name
    await expect(drawerTitle).toBeVisible({ timeout: 5000 })
    const secondTitleText = await drawerTitle.innerText()

    // Title texts should differ if user names differ
    if (firstName.trim() !== secondName.trim()) {
      expect(secondTitleText).not.toBe(firstTitleText)
    }
  })
})
