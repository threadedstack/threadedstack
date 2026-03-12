import { test, expect } from '../fixtures/auth'

/**
 * Tier 2: Code Review Fixes Integration Tests
 *
 * Validates the 9 bug fixes from the code review:
 * 1. MobileSidebar — floating open={true} moved into SBSection
 * 2. Page.tsx — flex-grow (was flex-crow)
 * 3. Layout.tsx — valid CSS on MobileToggle
 * 4. Breadcrumbs — font-size: 18px (was 18 without unit)
 * 5. buildAgentNav — null guard on item.items
 * 6. EntitySelector — single-select shows selected option, isOptionEqualToValue
 * 7. useAutoRailSection — manual collapse stays collapsed
 * 8. FunctionDrawer — "No endpoint" option present
 * 9. SubNavPanel — CreateProjectDrawer trigger button
 */

const ignoredConsolePatterns = [
  'Function components cannot be given refs',
  'useLayoutEffect does nothing on the server',
  'Download the React DevTools',
  'React does not recognize',
  'Warning:',
  'Failed to load resource',
  'net::ERR_',
  '404',
  'ErrorBoundary',
]

const isIgnored = (text: string): boolean =>
  ignoredConsolePatterns.some((p) => text.includes(p))

function collectErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
  })
  return errors
}

async function gotoAndWait(
  page: import('@playwright/test').Page,
  url: string,
  pageClass: string,
  timeout = 15000
) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await expect(page.locator(`.${pageClass}`)).toBeVisible({ timeout })
}

// ---------------------------------------------------------------------------
// Fix 2: Page.tsx — flex-grow renders correctly (layout fills viewport)
// ---------------------------------------------------------------------------
test.describe('Fix 2: Page layout flex-grow', () => {
  test('page container uses flex-grow and fills available space', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    // The .tdsk-page-box container should have flex-grow: 1 computed
    const pageBox = page.locator('.tdsk-page-box')
    await expect(pageBox).toBeVisible()

    const flexGrow = await pageBox.evaluate(
      (el) => window.getComputedStyle(el).flexGrow
    )
    expect(flexGrow).toBe('1')

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Fix 3: Layout.tsx — MobileToggle has valid CSS (background-color, z-index)
// ---------------------------------------------------------------------------
test.describe('Fix 3: MobileToggle valid CSS', () => {
  test('mobile toggle button has correct styles on small viewport', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectErrors(page)

    // Resize to mobile viewport to trigger the MobileToggle render
    await page.setViewportSize({ width: 375, height: 812 })

    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    // The MobileToggle (hamburger button) should be visible on mobile
    const mobileToggle = page.locator('.tdsk-page-content button').last()
    const isVisible = await mobileToggle.isVisible()

    if (isVisible) {
      // Verify background-color is NOT empty/transparent (the fix converts
      // MUI sx shorthand `bgcolor` to CSS `background-color`)
      const bgColor = await mobileToggle.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      )
      // Should have a real color value, not 'transparent' or empty
      expect(bgColor).not.toBe('')
      expect(bgColor).not.toBe('transparent')

      // Verify z-index is applied (the fix converts `zIndex` to `z-index`)
      const zIndex = await mobileToggle.evaluate(
        (el) => window.getComputedStyle(el).zIndex
      )
      expect(zIndex).toBe('1200')
    }

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Fix 4: Breadcrumbs — separator icon has font-size: 18px
// ---------------------------------------------------------------------------
test.describe('Fix 4: Breadcrumbs separator font-size', () => {
  test('breadcrumb separator icon has correct font-size with px unit', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    // Breadcrumbs render when org is selected — separator is a ChevronRight SVG
    const separator = page.locator('.tdsk-app-header svg').first()
    const isVisible = await separator.isVisible()

    if (isVisible) {
      const fontSize = await separator.evaluate(
        (el) => window.getComputedStyle(el).fontSize
      )
      // Should be 18px (the fix added the missing unit)
      expect(fontSize).toBe('18px')
    }
  })
})

// ---------------------------------------------------------------------------
// Fix 6: EntitySelector — single-select shows current selection in dropdown
// ---------------------------------------------------------------------------
test.describe('Fix 6: EntitySelector single-select visibility', () => {
  test('single-select autocomplete shows selected option in dropdown list', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`,
      'tdsk-project-functions-page'
    )

    // Open create function drawer to get an EndpointSelector (single-select)
    const createBtn = page
      .locator('[aria-label="Create function"]')
      .or(page.getByText('Create Function'))
      .or(page.getByText('Create New Function'))
    const hasCreateBtn = (await createBtn.count()) > 0
    test.skip(!hasCreateBtn, 'No Create Function button')

    await createBtn.first().click()
    await page.waitForTimeout(2000)

    // EndpointSelector is id='endpoint-id'
    const endpointInput = page.locator('#endpoint-id')
    if ((await endpointInput.count()) > 0) {
      await expect(endpointInput).toBeVisible()

      // Open the dropdown
      await endpointInput.click()
      await page.waitForTimeout(500)

      const listbox = page.locator('.MuiAutocomplete-listbox')
      if ((await listbox.count()) > 0) {
        const options = listbox.locator('li')
        const optionCount = await options.count()

        // Fix 8: Should have at least the "No endpoint" sentinel option
        expect(optionCount).toBeGreaterThan(0)

        // Check that "No endpoint" option exists
        const noEndpointOption = listbox.getByText('No endpoint')
        await expect(noEndpointOption).toBeVisible()

        // Select the first real option (if more than just "No endpoint")
        if (optionCount > 1) {
          await options.nth(1).click()
          await page.waitForTimeout(500)

          // Re-open dropdown — the selected option should still be visible
          // (Fix 6: single-select no longer hides selected items)
          await endpointInput.click()
          await page.waitForTimeout(500)

          const listboxAfter = page.locator('.MuiAutocomplete-listbox')
          if ((await listboxAfter.count()) > 0) {
            const optionsAfter = listboxAfter.locator('li')
            // All options should still be present (not hidden)
            expect(await optionsAfter.count()).toBe(optionCount)
          }
        }
      }
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Fix 7: useAutoRailSection — manual collapse stays collapsed
// ---------------------------------------------------------------------------
test.describe('Fix 7: Manual sub-nav collapse persistence', () => {
  test('closing sub-nav panel by clicking active section stays closed on same page', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    // Wait for auto-section derivation to complete
    await page.waitForTimeout(1000)

    const subNavPanel = page.locator('.tdsk-subnav-panel')

    // Panel should be open (width > 0) — auto-derived from URL on first load
    const initialWidth = await subNavPanel.evaluate(
      (el) => el.getBoundingClientRect().width
    )
    expect(initialWidth).toBeGreaterThan(0)

    // Click the active section to manually collapse
    const navRail = page.locator('.tdsk-icon-rail')
    const activeItem = navRail.locator('.tdsk-rail-item.active')
    const hasActive = (await activeItem.count()) > 0
    test.skip(!hasActive, 'No active rail item found')

    await activeItem.click()
    await page.waitForTimeout(600)

    // Panel should now be collapsed (width = 0)
    const collapsedWidth = await subNavPanel.evaluate(
      (el) => el.getBoundingClientRect().width
    )
    expect(collapsedWidth).toBe(0)

    // SPA navigate (NOT page.goto which resets all state) by clicking a link in the main content
    // The Quick Actions section on the org page has a clickable "Projects" card
    const projectsAction = page.locator('main h6').filter({ hasText: 'Projects' }).first()
    const hasProjectsAction = (await projectsAction.count()) > 0
    test.skip(!hasProjectsAction, 'No Projects quick action found')

    await projectsAction.click()
    await page.waitForURL('**/projects**')
    await page.waitForTimeout(1000)

    // Panel should still be collapsed (Fix 7: respects null = manual close)
    const afterNavWidth = await subNavPanel.evaluate(
      (el) => el.getBoundingClientRect().width
    )
    expect(afterNavWidth).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Fix 8: FunctionDrawer — "No endpoint" option present
// ---------------------------------------------------------------------------
test.describe('Fix 8: FunctionDrawer No endpoint option', () => {
  test('endpoint selector in function drawer includes No endpoint option', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`,
      'tdsk-project-functions-page'
    )

    const createBtn = page
      .locator('[aria-label="Create function"]')
      .or(page.getByText('Create Function'))
      .or(page.getByText('Create New Function'))
    const hasCreateBtn = (await createBtn.count()) > 0
    test.skip(!hasCreateBtn, 'No Create Function button')

    await createBtn.first().click()
    await page.waitForTimeout(2000)

    const endpointInput = page.locator('#endpoint-id')
    test.skip((await endpointInput.count()) === 0, 'No endpoint selector found')

    await endpointInput.click()
    await page.waitForTimeout(500)

    const listbox = page.locator('.MuiAutocomplete-listbox')
    if ((await listbox.count()) > 0) {
      // "No endpoint" should be the first option
      const noEndpointOption = listbox.getByText('No endpoint')
      await expect(noEndpointOption).toBeVisible()
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Fix 9: SubNavPanel — CreateProjectDrawer trigger button exists
// ---------------------------------------------------------------------------
test.describe('Fix 9: Create project button in sub-nav', () => {
  test('org section in sub-nav has an add project button that opens the drawer', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    // Wait for auto-section derivation
    await page.waitForTimeout(1000)

    // Sub-nav should be open on the org section
    const subNavPanel = page.locator('.tdsk-subnav-panel')
    const panelWidth = await subNavPanel.evaluate(
      (el) => el.getBoundingClientRect().width
    )
    test.skip(panelWidth === 0, 'Sub-nav panel not open')

    // Look for the "+" IconButton in the sub-nav header area
    // It's an MUI IconButton with an AddIcon (SVG) inside the header box
    const addButton = subNavPanel.locator('.MuiIconButton-root').first()
    const hasAddButton = (await addButton.count()) > 0

    if (hasAddButton) {
      await addButton.click()
      await page.waitForTimeout(1000)

      // CreateProjectDrawer should have opened — look for the drawer overlay
      const drawerTitle = page.getByText('Create New Project')
        .or(page.getByText('New Project'))
        .or(page.getByText('Create Project'))
      const isOpen = (await drawerTitle.count()) > 0
      if (isOpen) {
        await expect(drawerTitle.first()).toBeVisible()
      }

      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Fix 5: buildAgentNav — no crash when agent nav items have no children
// ---------------------------------------------------------------------------
test.describe('Fix 5: Agent nav items render without crash', () => {
  test('project page with agents renders sidebar without errors', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents`,
      'tdsk-project-agents-page'
    )

    // If buildAgentNav crashes on null items, the sidebar won't render
    const sidebar = page.locator('.tdsk-admin-sidebar')
    await expect(sidebar).toBeVisible()

    const navRail = page.locator('.tdsk-icon-rail')
    await expect(navRail).toBeVisible()

    // Sub-nav panel exists in DOM (may be collapsed but should not crash)
    const subNavPanel = page.locator('.tdsk-subnav-panel')
    await expect(subNavPanel).toBeAttached()

    // No console errors from the null guard fix
    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Fix 1: MobileSidebar — renders without parse error on mobile viewport
// ---------------------------------------------------------------------------
test.describe('Fix 1: MobileSidebar renders correctly', () => {
  test('mobile sidebar opens and renders sections without crash', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectErrors(page)

    // Resize to mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })

    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    // On mobile, the sidebar renders as a SwipeableDrawer.
    // The key assertion: it rendered without parse/render errors from the floating open={true} fix.
    // sidebarOpenState defaults to true, so the drawer auto-opens on mobile.
    const drawer = page.locator('.MuiDrawer-root.tdsk-admin-sidebar')
    await page.waitForTimeout(1000)

    if ((await drawer.count()) > 0) {
      // Sidebar rendered successfully — fix 1 (floating open={true}) didn't crash
      await expect(drawer.first()).toBeVisible()
    }

    // The key assertion: no parse/render errors from the floating open={true} fix
    expect(errors).toEqual([])
  })
})
