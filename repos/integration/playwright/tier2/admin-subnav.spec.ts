import { test, expect } from '../fixtures/auth'

/**
 * Tier 2: Admin Sub-Navigation Panel Integration Tests
 *
 * Verifies the desktop nav rail + sub-nav panel navigation:
 * - Nav rail renders with correct section icons
 * - Clicking a section opens the sub-nav panel with grouped items
 * - Navigation links work and show active state
 * - Section switching updates sub-nav content
 * - Auto-section selection from URL
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

test.describe('Sub-Navigation Panel', () => {
  test('nav rail renders with Org section on org page', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    const sidebar = page.locator('.tdsk-admin-sidebar')
    await expect(sidebar).toBeVisible()

    // Nav rail should be present
    const navRail = page.locator('.tdsk-icon-rail')
    await expect(navRail).toBeVisible()

    // Should have at least Org section + Settings bottom item
    const railItems = navRail.locator('.tdsk-rail-item')
    const count = await railItems.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('org section sub-nav opens with grouped items on org page', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    // The auto-section hook should have selected 'org' based on URL
    const subNavPanel = page.locator('.tdsk-subnav-panel')
    await expect(subNavPanel).toBeVisible()

    // Sub-nav should have section headers (Resources, Security, Management)
    const sectionHeaders = subNavPanel.locator('.MuiTypography-root')
    const headerCount = await sectionHeaders.count()
    expect(headerCount).toBeGreaterThan(0)
  })

  test('sub-nav links navigate to correct pages', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    // Wait for sub-nav panel to be visible
    const subNavPanel = page.locator('.tdsk-subnav-panel')
    await expect(subNavPanel).toBeVisible()

    // Find and click the "Projects" link in the sub-nav
    const projectsLink = subNavPanel.locator('.tdsk-list-item').filter({ hasText: 'Projects' }).first()
    if (await projectsLink.isVisible()) {
      await projectsLink.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain(`/orgs/${ctx.orgId}/projects`)
    }
  })

  test('Project section appears when navigating to a project page', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      'tdsk-project-endpoints-page'
    )

    const navRail = page.locator('.tdsk-icon-rail')
    await expect(navRail).toBeVisible()

    // Should have Org + Project section items + Settings bottom item
    const railItems = navRail.locator('.tdsk-rail-item')
    const count = await railItems.count()
    expect(count).toBeGreaterThanOrEqual(3)

    // Sub-nav should be visible and showing project-level items
    const subNavPanel = page.locator('.tdsk-subnav-panel')
    await expect(subNavPanel).toBeVisible()
  })

  test('switching between Org and Project sections updates sub-nav', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Start on a project page (project section auto-selected)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      'tdsk-project-endpoints-page'
    )

    const subNavPanel = page.locator('.tdsk-subnav-panel')
    await expect(subNavPanel).toBeVisible()

    // Capture project sub-nav content
    const projectContent = await subNavPanel.innerText()

    // Click the Org section in the nav rail (first section item, index 0)
    const navRail = page.locator('.tdsk-icon-rail')
    const railItems = navRail.locator('.tdsk-rail-item')
    const orgItem = railItems.nth(0)
    await orgItem.click()

    // Wait for sub-nav to update
    await page.waitForTimeout(500)

    // Sub-nav content should be different (org items vs project items)
    const orgContent = await subNavPanel.innerText()
    expect(orgContent).not.toBe(projectContent)
  })

  test('clicking Org rail section navigates to org root route', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Start on a project page so the org rail section is NOT already active
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      'tdsk-project-endpoints-page'
    )

    // Click the Org section in the nav rail (first section, index 0)
    const navRail = page.locator('.tdsk-icon-rail')
    const orgItem = navRail.locator('.tdsk-rail-item').nth(0)
    await orgItem.click()

    // Should navigate to the org root route
    await expect(page.locator('.tdsk-org-page')).toBeVisible({ timeout: 10000 })
    expect(page.url()).toContain(`/orgs/${ctx.orgId}`)
    // Should NOT still be on the project endpoints page
    expect(page.url()).not.toContain('/projects/')
  })

  test('clicking Project rail section navigates to project root route', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Start on a nested project page (e.g. endpoints)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      'tdsk-project-endpoints-page'
    )

    // First switch to Org section so Project section is not active
    const navRail = page.locator('.tdsk-icon-rail')
    const orgItem = navRail.locator('.tdsk-rail-item').nth(0)
    await orgItem.click()
    await expect(page.locator('.tdsk-org-page')).toBeVisible({ timeout: 10000 })

    // Now click the Project section (second section, index 1)
    const projectItem = navRail.locator('.tdsk-rail-item').nth(1)
    await projectItem.click()

    // Should navigate to the project root route
    await expect(page.locator('.tdsk-project-page')).toBeVisible({ timeout: 10000 })
    expect(page.url()).toContain(`/orgs/${ctx.orgId}/projects/${ctx.projectId}`)
    // Should be at the project root, not a sub-page
    expect(page.url()).not.toContain('/endpoints')
    expect(page.url()).not.toContain('/agents')
    expect(page.url()).not.toContain('/functions')
  })

  test('clicking active section toggles sub-nav closed', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    const subNavPanel = page.locator('.tdsk-subnav-panel')
    await expect(subNavPanel).toBeVisible()

    // Click the already-active Org section to close
    const navRail = page.locator('.tdsk-icon-rail')
    const activeItem = navRail.locator('.tdsk-rail-item.active')
    await activeItem.click()

    // Sub-nav panel should collapse (width transitions to 0)
    await page.waitForTimeout(500)

    // The panel box is still in the DOM but its width should be 0
    const panelBox = subNavPanel.first()
    const width = await panelBox.evaluate((el) => el.getBoundingClientRect().width)
    expect(width).toBe(0)
  })

  test('nav rail expands on hover to show text labels', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    const navRail = page.locator('.tdsk-icon-rail')
    await expect(navRail).toBeVisible()

    // Get initial width
    const initialWidth = await navRail.evaluate((el) => el.getBoundingClientRect().width)

    // Hover over the nav rail
    await navRail.hover()
    // Wait for the 500ms animation to complete
    await page.waitForTimeout(600)

    // Width should have expanded
    const hoveredWidth = await navRail.evaluate((el) => el.getBoundingClientRect().width)
    expect(hoveredWidth).toBeGreaterThan(initialWidth)
  })
})
