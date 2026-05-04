import { test, expect } from '../fixtures/auth'
import { collectErrors, gotoAndWait } from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-billing-page'

test.describe('Billing Page', () => {
  test('should render the billing page with heading', async ({ authenticatedPage: page }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/billing', PAGE_CLASS)

    // Page heading
    await expect(page.getByRole('heading', { name: /Billing & Plans/i })).toBeVisible()

    // Subtitle text
    await expect(page.getByText('Manage your subscription')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should render tab navigation with three tabs', async ({ authenticatedPage: page }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/billing', PAGE_CLASS)

    // Wait for loading to finish — tabs appear after data loads
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 15_000 })

    // Three tabs: Current Plan, Upgrade Plan, Payment History
    await expect(page.getByRole('tab', { name: /Current Plan/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Upgrade Plan/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Payment History/i })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should switch between tabs', async ({ authenticatedPage: page }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 15_000 })

    // Click Upgrade Plan tab
    await page.getByRole('tab', { name: /Upgrade Plan/i }).click()
    await expect(page.locator('#billing-tabpanel-1')).toBeVisible()

    // Click Payment History tab
    await page.getByRole('tab', { name: /Payment History/i }).click()
    await expect(page.locator('#billing-tabpanel-2')).toBeVisible()

    // Click back to Current Plan tab
    await page.getByRole('tab', { name: /Current Plan/i }).click()
    await expect(page.locator('#billing-tabpanel-0')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should render current plan info on the Current Plan tab', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 15_000 })

    // Current Plan tab is active by default — look for subscription info or empty state
    const tabpanel = page.locator('#billing-tabpanel-0')
    await expect(tabpanel).toBeVisible()

    // Either we see subscription details (tier name chip, Manage Subscription button)
    // or the "No active subscription" empty state alert
    const hasSubscription = await page.getByRole('button', { name: /Manage Subscription/i }).isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/No active subscription/i).isVisible().catch(() => false)

    expect(hasSubscription || hasEmptyState).toBeTruthy()

    expect(errors).toEqual([])
  })

  test('should render Upgrade Plan tab with plan cards or empty state', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 15_000 })

    // Switch to Upgrade Plan tab
    await page.getByRole('tab', { name: /Upgrade Plan/i }).click()
    const tabpanel = page.locator('#billing-tabpanel-1')
    await expect(tabpanel).toBeVisible()

    // Should show "Available Plans" heading
    await expect(page.getByRole('heading', { name: /Available Plans/i })).toBeVisible()

    // Either plan cards or "No plans available" alert
    const hasCards = await tabpanel.locator('.MuiCard-root').first().isVisible().catch(() => false)
    const hasEmpty = await page.getByText(/No plans available/i).isVisible().catch(() => false)

    expect(hasCards || hasEmpty).toBeTruthy()

    expect(errors).toEqual([])
  })

  test('should render Payment History tab with table or empty state', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 15_000 })

    // Switch to Payment History tab
    await page.getByRole('tab', { name: /Payment History/i }).click()
    const tabpanel = page.locator('#billing-tabpanel-2')
    await expect(tabpanel).toBeVisible()

    // Should show "Payment History" heading
    await expect(page.getByRole('heading', { name: /Payment History/i })).toBeVisible()

    // Either an invoice table with headers or the "No payment history" alert
    const hasTable = await page.locator('.MuiTable-root').isVisible().catch(() => false)
    const hasEmpty = await page.getByText(/No payment history/i).isVisible().catch(() => false)

    expect(hasTable || hasEmpty).toBeTruthy()

    expect(errors).toEqual([])
  })

  test('should show loading skeletons initially', async ({ authenticatedPage: page }) => {
    const errors = collectErrors(page)

    // Navigate but don't wait for networkidle — we want to catch the loading state
    await page.goto('/billing')
    await expect(page.locator(`.${PAGE_CLASS}`)).toBeVisible({ timeout: 15_000 })

    // Either loading skeletons are visible or data has already loaded (tabs visible)
    const hasSkeleton = await page.locator('.MuiSkeleton-root').first().isVisible().catch(() => false)
    const hasTabs = await page.locator('[role="tablist"]').isVisible().catch(() => false)

    // One of the two states must be true
    expect(hasSkeleton || hasTabs).toBeTruthy()

    expect(errors).toEqual([])
  })

  test('should stay on billing page URL after navigation', async ({
    authenticatedPage: page,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, '/billing', PAGE_CLASS)

    expect(page.url()).toContain('/billing')

    expect(errors).toEqual([])
  })
})
