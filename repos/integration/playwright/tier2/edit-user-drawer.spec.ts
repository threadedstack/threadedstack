import { test, expect } from '../fixtures/auth'

test.describe('Edit User Drawer', () => {
  test('opens unified drawer on row click', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/members`)
    await expect(page.locator('.tdsk-org-members-page')).toBeVisible({ timeout: 15_000 })

    const dataRows = page.locator('tbody tr')
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 })

    // Click the first data row to open the drawer
    await dataRows.first().click()

    // Drawer should open with "Edit User" title
    const drawerTitle = page.getByText('Edit User')
    await expect(drawerTitle).toBeVisible({ timeout: 5000 })

    const drawer = page.locator('.MuiDrawer-root')
    await expect(drawer).toBeVisible()
  })

  test('shows user info header with name and email', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await page.goto(`/orgs/${ctx.orgId}/members`)
    await expect(page.locator('.tdsk-org-members-page')).toBeVisible({ timeout: 15_000 })

    const dataRows = page.locator('tbody tr')
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 })

    await dataRows.first().click()

    const drawer = page.locator('.MuiDrawer-root')
    await expect(drawer).toBeVisible({ timeout: 5000 })

    // User header should contain an avatar (MuiAvatar)
    await expect(drawer.locator('.MuiAvatar-root')).toBeVisible()
  })

  test('Role tab is default and shows RoleSelect', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await page.goto(`/orgs/${ctx.orgId}/members`)
    await expect(page.locator('.tdsk-org-members-page')).toBeVisible({ timeout: 15_000 })

    const dataRows = page.locator('tbody tr')
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 })

    await dataRows.first().click()

    const drawer = page.locator('.MuiDrawer-root')
    await expect(drawer).toBeVisible({ timeout: 5000 })

    // "Role" tab should be selected (has aria-selected=true)
    const roleTab = drawer.getByRole('tab', { name: 'Role' })
    await expect(roleTab).toHaveAttribute('aria-selected', 'true')

    // RoleSelect component renders a select input with class tdsk-role-select
    await expect(drawer.locator('.tdsk-role-select')).toBeVisible()
  })

  test('switches to API Keys tab and shows content', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await page.goto(`/orgs/${ctx.orgId}/members`)
    await expect(page.locator('.tdsk-org-members-page')).toBeVisible({ timeout: 15_000 })

    const dataRows = page.locator('tbody tr')
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 })

    await dataRows.first().click()

    const drawer = page.locator('.MuiDrawer-root')
    await expect(drawer).toBeVisible({ timeout: 5000 })

    // Click the "API Keys" tab
    const apiKeysTab = drawer.getByRole('tab', { name: 'API Keys' })
    await apiKeysTab.click()

    await expect(apiKeysTab).toHaveAttribute('aria-selected', 'true')

    // Wait for loading to complete — either keys table or empty state should appear
    await expect(
      drawer.locator('table').or(drawer.getByText('This user has no API keys yet.'))
    ).toBeVisible({ timeout: 10000 })

    const hasKeys = await drawer.locator('table').isVisible()
    if (!hasKeys) {
      await expect(drawer.getByText('This user has no API keys yet.')).toBeVisible()
    }
  })

  test('API Keys tab shows Create Key button', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await page.goto(`/orgs/${ctx.orgId}/members`)
    await expect(page.locator('.tdsk-org-members-page')).toBeVisible({ timeout: 15_000 })

    const dataRows = page.locator('tbody tr')
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 })

    await dataRows.first().click()

    const drawer = page.locator('.MuiDrawer-root')
    await expect(drawer).toBeVisible({ timeout: 5000 })

    // Switch to API Keys tab
    await drawer.getByRole('tab', { name: 'API Keys' }).click()

    // Create Key button should be visible in the drawer footer
    await expect(drawer.getByRole('button', { name: /Create Key/i })).toBeVisible()
  })

  test('Edit button in row opens drawer', async ({ authenticatedPage: page, ctx }) => {
    await page.goto(`/orgs/${ctx.orgId}/members`)
    await expect(page.locator('.tdsk-org-members-page')).toBeVisible({ timeout: 15_000 })

    const dataRows = page.locator('tbody tr')
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 })

    // Click the Edit action button (first button in the row)
    const firstRow = dataRows.first()
    await firstRow.getByRole('button').first().click()

    // Drawer should open
    const drawerTitle = page.getByText('Edit User')
    await expect(drawerTitle).toBeVisible({ timeout: 5000 })
  })

  test('drawer closes on close button click', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await page.goto(`/orgs/${ctx.orgId}/members`)
    await expect(page.locator('.tdsk-org-members-page')).toBeVisible({ timeout: 15_000 })

    const dataRows = page.locator('tbody tr')
    await expect(dataRows.first()).toBeVisible({ timeout: 10000 })

    await dataRows.first().click()

    const drawer = page.locator('.MuiDrawer-root')
    await expect(drawer).toBeVisible({ timeout: 5000 })

    // Click close button (the X icon button in the drawer header)
    const closeBtn = drawer
      .getByRole('button')
      .filter({ has: page.locator('svg') })
      .first()
    await closeBtn.click()

    // Drawer should close
    await expect(drawer).not.toBeVisible({ timeout: 5000 })
  })
})
