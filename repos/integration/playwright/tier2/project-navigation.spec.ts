import { test, expect } from '../fixtures/auth'

test.describe('Project Navigation State Scoping', () => {
  test('navigating to endpoints page renders without infinite spinner', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    if (!ctx.projectId) {
      test.skip()
      return
    }

    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await page.waitForLoadState('networkidle')

    // Page should render at least one visible element
    await expect(page.locator('body').first()).toBeVisible()

    // After networkidle, spinner should be gone — data should be loaded or empty state shown
    const spinner = page.locator('[role="progressbar"]')
    const hasSpinner = await spinner.isVisible().catch(() => false)

    if (hasSpinner) {
      // Allow extra time for React state to settle
      await page.waitForTimeout(2000)
      await expect(spinner).not.toBeVisible()
    }

    expect(errors).toEqual([])
  })

  test('endpoint page does not produce MUI out-of-range errors', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    if (!ctx.projectId) {
      test.skip()
      return
    }

    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await page.waitForLoadState('networkidle')

    // No MUI "out of range" console errors should appear
    const muiErrors = errors.filter(e => e.includes('out of range') || e.includes('MUI'))
    expect(muiErrors).toEqual([])
  })

  test('functions page renders without errors', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    if (!ctx.projectId) {
      test.skip()
      return
    }

    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body').first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('members page renders without errors', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    if (!ctx.projectId) {
      test.skip()
      return
    }

    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/members`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body').first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('agents page renders without errors', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    if (!ctx.projectId) {
      test.skip()
      return
    }

    await page.goto(`/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body').first()).toBeVisible()
    expect(errors).toEqual([])
  })
})
