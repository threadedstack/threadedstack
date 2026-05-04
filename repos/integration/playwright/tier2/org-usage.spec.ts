import { test, expect } from '../fixtures/auth'
import { gotoAndWait, collectErrors } from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-org-usage-page'

/**
 * Tests for the Org Usage page:
 *   - Page renders with quota items (Projects, Compute, Threads, etc.)
 *   - Progress bars (LinearProgress) are visible for limited quotas
 *   - "Upgrade Plan" link is present
 *   - "Current Usage" heading is visible
 */
test.describe('Org Usage Page', () => {
  test('Usage page renders with heading and quota section', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/usage`, PAGE_CLASS)

    // Page title includes "Usage"
    await expect(page.getByRole('heading', { name: /Usage/i }).first()).toBeVisible({ timeout: 10_000 })

    // Description text about monitoring resource usage
    await expect(page.getByText(/Monitor your organization/i)).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Quota items are displayed', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/usage`, PAGE_CLASS)

    // The QuotaUsage component renders either quota cards or a "No quota data" alert.
    // Both are valid depending on whether the org has a subscription.
    const currentUsageHeading = page.getByText('Current Usage')
    const noDataAlert = page.getByText('No quota data available')

    // One of these two should be visible
    const hasUsageData = await currentUsageHeading.isVisible().catch(() => false)
    const hasNoData = await noDataAlert.isVisible().catch(() => false)

    expect(hasUsageData || hasNoData).toBe(true)

    if (hasUsageData) {
      // When quota data is available, check that at least one resource label is visible
      // The component renders: Projects, Compute, Threads, Messages, Endpoints, Secrets
      const quotaLabels = ['Projects', 'Compute', 'Threads', 'Messages', 'Endpoints', 'Secrets']
      let foundCount = 0
      for (const label of quotaLabels) {
        const el = page.getByText(label, { exact: true })
        if (await el.first().isVisible().catch(() => false)) foundCount++
      }
      expect(foundCount).toBeGreaterThan(0)
    }

    expect(errors).toEqual([])
  })

  test('Progress bars are visible when quota data exists', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/usage`, PAGE_CLASS)

    // If quota data is available, LinearProgress bars should be rendered
    const currentUsageHeading = page.getByText('Current Usage')
    const hasUsageData = await currentUsageHeading.isVisible().catch(() => false)

    if (hasUsageData) {
      // LinearProgress elements should be in the page
      const progressBars = page.locator('.MuiLinearProgress-root')
      const count = await progressBars.count()
      // At least one progress bar should exist when quota data is available
      expect(count).toBeGreaterThan(0)
    }

    expect(errors).toEqual([])
  })

  test('Upgrade Plan button is present', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/usage`, PAGE_CLASS)

    // The "Upgrade Plan" button links to the billing page
    const upgradeButton = page.getByRole('link', { name: /Upgrade Plan/i })
    await expect(upgradeButton).toBeVisible({ timeout: 10_000 })

    // The "Need more resources?" section should be visible
    await expect(page.getByText(/Need more resources/i)).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })
})
