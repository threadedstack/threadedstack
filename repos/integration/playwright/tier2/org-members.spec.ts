import { test, expect } from '../fixtures/auth'

test.describe('Org Members', () => {
  test('org page shows members section with actual member data', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto(`/orgs/${ctx.orgId}`)
    await page.waitForLoadState('networkidle')

    // Should show "Org Members" header with count
    await expect(page.getByRole('heading', { name: /Org Members/ })).toBeVisible()

    // The old placeholder text should NOT be present
    await expect(
      page.getByText('Visit the Users page to invite and manage organization members.')
    ).not.toBeVisible()

    // Should show at least one member in the main content area
    const mainContent = page.locator('main')
    await expect(mainContent.locator('.MuiListItem-root').first()).toBeVisible()

    // "Manage Members" button should be visible
    await expect(page.getByText('Manage Members')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('users page renders DataTable with columns', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto(`/orgs/${ctx.orgId}/members`)
    await page.waitForLoadState('networkidle')

    // Should render table column headers
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible()

    // Should have at least one data row (the test user)
    const dataRows = page.locator('tbody tr')
    expect(await dataRows.count()).toBeGreaterThan(0)

    // Should show a role chip in the main content area
    const roleChip = page.locator('main .MuiChip-root').first()
    await expect(roleChip).toBeVisible()

    expect(errors).toEqual([])
  })
})
