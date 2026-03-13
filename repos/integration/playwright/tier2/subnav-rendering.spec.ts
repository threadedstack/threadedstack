import { test, expect } from '../fixtures/auth'

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

test.describe('Sub-Navigation Rendering', () => {
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
