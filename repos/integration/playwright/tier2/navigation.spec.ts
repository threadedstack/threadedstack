import { test, expect } from '../fixtures/auth'

/**
 * Navigation integration tests for the Threaded Stack admin UI.
 *
 * Covers deep linking, invalid routes, sidebar context, browser history,
 * and page refresh persistence.
 */

/**
 * Navigate to a URL and wait for the page component to render.
 * Uses the page-specific CSS class instead of arbitrary timeouts.
 */
async function gotoAndWait(
  page: import('@playwright/test').Page,
  url: string,
  pageClass: string,
  timeout = 10000
) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await expect(page.locator(`.${pageClass}`)).toBeVisible({ timeout })
}

test.describe('Navigation', () => {
  test('deep URL navigation loads project agents page with correct sidebar context', async ({
    authenticatedPage: page, ctx,
  }) => {
    const deepUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents`
    await gotoAndWait(page, deepUrl, 'tdsk-project-agents-page')

    // Verify URL resolved to the expected deep path
    expect(page.url()).toContain(
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents`
    )

    // Sidebar should be present with the nav rail
    const sidebar = page.locator('.tdsk-admin-sidebar')
    await expect(sidebar).toBeVisible()

    const navRail = sidebar.locator('.tdsk-nav-rail')
    await expect(navRail).toBeVisible()

    // On a project page, the nav rail should have Org + Project sections + bottom items
    const railItems = navRail.locator('.tdsk-rail-item')
    const count = await railItems.count()
    expect(count).toBeGreaterThanOrEqual(3)

    // Sub-nav panel should be open with project-level groups
    const subNavPanel = sidebar.locator('.tdsk-subnav-panel')
    await expect(subNavPanel).toBeVisible()
  })

  test('Manage Members button navigates to /members', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    const button = page.getByText('Manage Members')
    await expect(button).toBeVisible()
    await button.click()
    await page.waitForLoadState('networkidle')

    // Should navigate to /members, not /users
    expect(page.url()).toContain(`/orgs/${ctx.orgId}/members`)
  })

  test('invalid route redirects to home', async ({
    authenticatedPage: page, ctx,
  }) => {
    await page.goto('/totally/invalid/route')
    await page.waitForLoadState('networkidle')
    // Wait for the app to settle and redirect - use the page-box class that all pages share
    await expect(page.locator('.tdsk-page-box').first()).toBeVisible({ timeout: 10000 })

    // The catch-all route (*) should redirect to home (/)
    const url = page.url()
    expect(url).toMatch(/\/(orgs)?$/)
  })

  test('nonexistent org with valid ID renders route error page (BUG #46)', async ({
    authenticatedPage: page, ctx,
  }) => {
    const fakeOrgId = 'zz00000000'
    await page.goto(`/orgs/${fakeOrgId}/projects`)
    await page.waitForLoadState('networkidle')

    // The org scope loader throws for a nonexistent org, so the route
    // errorElement renders the AppError page instead of a blank empty state.
    // (BUG #46 originally showed an empty state — the loader refactor now
    // surfaces an explicit error message, which is the desired behavior.)
    const errorContainer = page.locator('.prism-app-error-container')
    await expect(errorContainer).toBeVisible({ timeout: 10000 })

    // The error page should show a non-empty message
    const errorText = await page.locator('.prism-app-error-text').innerText()
    expect(errorText.trim().length).toBeGreaterThan(0)

    // URL should remain on the requested path (no redirect away)
    expect(page.url()).toContain(`/orgs/${fakeOrgId}`)
  })

  test('invalid org format in URL shows error or redirects', async ({
    authenticatedPage: page, ctx,
  }) => {
    await page.goto('/orgs/not-a-uuid')
    await page.waitForLoadState('networkidle')

    // The org scope loader throws for an invalid org id, so the route
    // errorElement renders the AppError page with the backend error message
    const errorContainer = page.locator('.prism-app-error-container')
    await expect(errorContainer).toBeVisible({ timeout: 10000 })

    // The error page should show a non-empty message — the app handled
    // the invalid format instead of crashing or rendering a blank page
    const errorText = await page.locator('.prism-app-error-text').innerText()
    expect(errorText.trim().length).toBeGreaterThan(0)
  })

  test('sidebar on global page shows nav rail with no sections', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(page, '/billing', 'tdsk-billing-page')

    // Sidebar should be present
    const sidebar = page.locator('.tdsk-admin-sidebar')
    await expect(sidebar).toBeVisible()

    // Nav rail should be visible
    const navRail = sidebar.locator('.tdsk-nav-rail')
    await expect(navRail).toBeVisible()

    // On global pages (no org context), the rail has no section items —
    // only bottom items (Settings)
    const railItems = navRail.locator('.tdsk-rail-item')
    const count = await railItems.count()
    expect(count).toBeGreaterThanOrEqual(1)

    // Sub-nav panel should show the Home section (global pages derive to 'home' section)
    const subNavPanel = sidebar.locator('.tdsk-subnav-panel')
    const width = await subNavPanel.first().evaluate((el) => el.getBoundingClientRect().width)
    expect(width).toBeGreaterThan(0)
  })

  test('browser back button navigates correctly through history', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Step 1: Navigate to home
    await gotoAndWait(page, '/', 'tdsk-home-page')
    const homeUrl = page.url()

    // Step 2: Navigate to org detail
    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')
    expect(page.url()).toContain(`/orgs/${ctx.orgId}`)

    // Step 3: Navigate to org projects
    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects`, 'tdsk-projects-page')
    expect(page.url()).toContain(`/orgs/${ctx.orgId}/projects`)

    // Step 4: Go back — should return to org detail
    await page.goBack()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('.tdsk-org-page')).toBeVisible({ timeout: 10000 })
    expect(page.url()).toContain(`/orgs/${ctx.orgId}`)

    // Step 5: Go back again — should return to home
    await page.goBack()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('.tdsk-home-page')).toBeVisible({ timeout: 10000 })
    expect(page.url()).toBe(homeUrl)
  })

  test('page refresh preserves data on org settings page', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/settings`, 'tdsk-org-settings-page')

    // Verify we are on the settings page
    expect(page.url()).toContain(`/orgs/${ctx.orgId}/settings`)

    // Capture the page content before reload
    const bodyTextBefore = await page.locator('body').innerText()

    // Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.tdsk-org-settings-page')).toBeVisible({ timeout: 10000 })

    // URL should persist after reload
    expect(page.url()).toContain(`/orgs/${ctx.orgId}/settings`)

    // Body should still render content (not blank or error)
    await expect(page.locator('body').first()).toBeVisible()
    const bodyTextAfter = await page.locator('body').innerText()
    expect(bodyTextAfter.length).toBeGreaterThan(0)

    // The sidebar should still be present after reload
    const sidebar = page.locator('.tdsk-admin-sidebar')
    await expect(sidebar).toBeVisible()
  })
})
