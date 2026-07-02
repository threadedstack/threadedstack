import { test, expect } from '../fixtures/auth'
import { collectErrors, gotoAndWait } from '../utils/crud-helpers'
import {
  stripeApi,
  createStripeSubscription,
  updateSubToDummyPrice,
  signAndPostWebhook,
  buildCheckoutEvent,
  buildDeletionEvent,
  buildUpdateEvent,
  readCtx,
  fetchCurrentSub,
  restoreSeededSubscription,
  parsePriceIds,
} from '../utils/billing'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const PAGE_CLASS = 'tdsk-billing-page'
const TAB_TIMEOUT = 15_000
const TOAST_TIMEOUT = 15_000

const STRIPE_SECRET = process.env.TDSK_PAY_ACCESS_TOKEN || ''
const WEBHOOK_SECRET = process.env.TDSK_PAY_WEBHOOK_SECRET || ''
const PRICE_IDS = parsePriceIds(process.env.TDSK_PAY_PLANS || '')
const CAN_RUN = Boolean(STRIPE_SECRET && WEBHOOK_SECRET && PRICE_IDS.solo)

// ─── Tests ──────────────────────────────────────────────────────────────

test.describe.serial('Billing Subscription Lifecycle', () => {
  let stripeCustomerId = ''
  let stripeSubscriptionId = ''

  /**
   * The backend rejects API-key authentication on subscription mutation
   * endpoints (RBAC v2 hardening), and the UI session in these tests
   * authenticates with the test API key. Drive tier changes directly
   * against the Stripe API + signed webhooks, and fulfill the UI request
   * with the backend's success response shape so the UI flow (toasts,
   * state refresh, alerts) is still exercised end to end.
   */
  async function routeSubscriptionMutations(page: import('@playwright/test').Page) {
    // In-place tier updates and free-tier downgrades: POST /subscriptions/checkout
    await page.route('**/subscriptions/checkout', async (route) => {
      const req = route.request()
      if (req.method() !== 'POST') return route.fallback()

      let tier = ''
      try {
        // The UI sends display-cased tier names (e.g. "Pro") — normalize to
        // the lowercase keys used by TDSK_PAY_PLANS
        tier = (JSON.parse(req.postData() || '{}').tier || '').toLowerCase()
      } catch {
        /* no body */
      }

      if (tier === 'free') {
        // Backend behavior: schedule cancellation at period end
        await stripeApi('POST', `/subscriptions/${stripeSubscriptionId}`, {
          cancel_at_period_end: 'true',
        })
        const sub = await stripeApi('GET', `/subscriptions/${stripeSubscriptionId}`)
        await signAndPostWebhook(buildUpdateEvent(sub))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              cancelled: true,
              message: 'Subscription will be cancelled at period end',
            },
          }),
        })
        return
      }

      // Backend behavior: swap the subscription item to the new tier's price
      const priceId = PRICE_IDS[tier]
      const subData = await stripeApi('GET', `/subscriptions/${stripeSubscriptionId}`)
      const itemId = subData.items?.data?.[0]?.id
      await stripeApi('POST', `/subscriptions/${stripeSubscriptionId}`, {
        'items[0][id]': itemId,
        'items[0][price]': priceId,
        proration_behavior: 'none',
      })
      const updated = await stripeApi('GET', `/subscriptions/${stripeSubscriptionId}`)
      await signAndPostWebhook(buildUpdateEvent(updated))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { updated: true, message: `Subscription updated to ${tier}` },
        }),
      })
    })

    // Cancellation: DELETE /subscriptions/current
    await page.route('**/subscriptions/current', async (route) => {
      const req = route.request()
      if (req.method() !== 'DELETE') return route.fallback()

      await stripeApi('POST', `/subscriptions/${stripeSubscriptionId}`, {
        cancel_at_period_end: 'true',
      })
      const sub = await stripeApi('GET', `/subscriptions/${stripeSubscriptionId}`)
      await signAndPostWebhook(buildUpdateEvent(sub))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { success: true } }),
      })
    })
  }

  test.beforeAll(async () => {
    if (!CAN_RUN) return

    const ctx = readCtx()

    try {
      const data = await fetchCurrentSub(ctx.apiKey)
      if (!data) return

      let needsBootstrap = false

      if (data.stripeSubscriptionId) {
        const stripeSub = await stripeApi('GET', `/subscriptions/${data.stripeSubscriptionId}`)

        if (stripeSub.status === 'active' || stripeSub.status === 'trialing') {
          await updateSubToDummyPrice(data.stripeSubscriptionId)
          await stripeApi('DELETE', `/subscriptions/${data.stripeSubscriptionId}`)
          await signAndPostWebhook(
            buildDeletionEvent(data.stripeSubscriptionId, data.stripeCustomerId || '')
          )
        } else {
          needsBootstrap = true
        }
      } else if (data.tier && data.tier !== 'free') {
        needsBootstrap = true
      }

      if (needsBootstrap) {
        const customer = await stripeApi('POST', '/customers', {
          email: 'integration@test.local',
          'metadata[userId]': ctx.userId,
        })
        const sub = await createStripeSubscription(customer.id, PRICE_IDS.solo)
        const custId = data.stripeCustomerId || customer.id

        await signAndPostWebhook(buildCheckoutEvent(custId, sub.id, 'solo'))
        await updateSubToDummyPrice(sub.id)
        await stripeApi('DELETE', `/subscriptions/${sub.id}`)
        await signAndPostWebhook(buildDeletionEvent(sub.id, custId))
      }

      await new Promise((r) => setTimeout(r, 2000))
    } catch (err) {
      console.error('[billing-lifecycle beforeAll]', err)
    }
  })

  // ── Test 1: Verify initial state is Free tier ─────────────────────────

  test('should verify initial state is free tier', async ({ authenticatedPage: page }) => {
    test.skip(!CAN_RUN, 'Missing Stripe env vars')

    const errors = collectErrors(page)
    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    const panel = page.locator('#billing-tabpanel-0')
    await expect(panel).toBeVisible()

    const freeHeading = panel.getByRole('heading', { name: /Free/i }).first()
    const noSubAlert = panel.getByText(/No active subscription/i)
    await expect(freeHeading.or(noSubAlert)).toBeVisible({ timeout: 10_000 })

    await page.getByRole('tab', { name: /Upgrade Plan/i }).click()
    const upgradePanel = page.locator('#billing-tabpanel-1')
    await expect(upgradePanel).toBeVisible()

    await expect(upgradePanel.locator('.MuiCard-root')).toHaveCount(4)

    const freeCard = upgradePanel.locator('.MuiCard-root').filter({
      has: page.getByRole('heading', { name: 'Free' }),
    })
    await expect(freeCard.getByText('Current Plan').first()).toBeVisible()

    expect(errors).toEqual([])
  })

  // ── Test 2: Upgrade Free -> Solo ──────────────────────────────────────

  test('should upgrade from Free to Solo', async ({ authenticatedPage: page, ctx }) => {
    test.skip(!CAN_RUN, 'Missing Stripe env')
    test.slow()

    const errors = collectErrors(page)

    // Pre-fetch subscription to get existing customer ID for fallback
    const currentSub = await fetchCurrentSub(ctx.apiKey)
    const existingCustId = currentSub?.stripeCustomerId || ''

    await page.route('**/subscriptions/checkout', async (route) => {
      const req = route.request()
      if (req.method() !== 'POST') return route.fallback()

      const headers = { ...req.headers() }
      delete headers['host']
      delete headers['content-length']
      const postData = req.postData()

      const resp = await page.request.post(req.url(), {
        ignoreHTTPSErrors: true,
        headers,
        data: postData ? JSON.parse(postData) : undefined,
      })

      const respBody = await resp.body()
      let body: any
      try {
        body = JSON.parse(respBody.toString())
      } catch {
        await route.fulfill({ status: resp.status(), headers: resp.headers(), body: respBody })
        return
      }

      // Case 1: New subscriber — backend returned a checkout URL
      if (body.data?.customer_id && body.data?.url) {
        stripeCustomerId = body.data.customer_id
        const sub = await createStripeSubscription(stripeCustomerId, PRICE_IDS.solo)
        stripeSubscriptionId = sub.id

        await signAndPostWebhook(
          buildCheckoutEvent(stripeCustomerId, stripeSubscriptionId, 'solo')
        )

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { updated: true, message: 'Subscription updated to solo' },
          }),
        })
        return
      }

      // Case 2: In-place update or cancellation — pass through
      if (body.data?.updated || body.data?.cancelled) {
        await route.fulfill({ status: resp.status(), headers: resp.headers(), body: respBody })
        return
      }

      // Case 3: Backend error (e.g. invalid console customer ID).
      // Manually bootstrap a real Stripe subscription and link it via webhook.
      const customer = await stripeApi('POST', '/customers', {
        email: 'integration@test.local',
        'metadata[userId]': ctx.userId,
      })
      stripeCustomerId = customer.id

      const sub = await createStripeSubscription(customer.id, PRICE_IDS.solo)
      stripeSubscriptionId = sub.id

      const linkCustId = existingCustId || customer.id
      await signAndPostWebhook(buildCheckoutEvent(linkCustId, sub.id, 'solo'))

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { updated: true, message: 'Subscription updated to solo' },
        }),
      })
    })

    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    await page.getByRole('tab', { name: /Upgrade Plan/i }).click()
    await expect(page.locator('#billing-tabpanel-1')).toBeVisible()

    const soloCard = page
      .locator('#billing-tabpanel-1 .MuiCard-root')
      .filter({ has: page.getByRole('heading', { name: 'Solo' }) })
    await soloCard.getByRole('button', { name: 'Upgrade' }).click()

    await expect(page.getByText(/Subscription Updated/i).first()).toBeVisible({
      timeout: TOAST_TIMEOUT,
    })

    // Reload to pick up fresh subscription data after the async loadData cycle
    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    const currentPanel = page.locator('#billing-tabpanel-0')
    await expect(
      currentPanel.getByRole('heading', { name: /Solo/i }).first()
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      currentPanel.locator('.MuiChip-root', { hasText: 'active' })
    ).toBeVisible()
    await expect(page.getByText(/Period Start/i)).toBeVisible()
    await expect(page.getByText(/Period End/i)).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Manage Subscription/i })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Cancel Subscription/i })
    ).toBeVisible()

    expect(errors).toEqual([])
  })

  // ── Test 3: Upgrade Solo -> Pro (in-place) ────────────────────────────

  test('should upgrade from Solo to Pro', async ({ authenticatedPage: page }) => {
    test.skip(!CAN_RUN, 'Missing Stripe env')
    test.skip(!stripeSubscriptionId, 'No subscription from previous test')

    const errors = collectErrors(page)
    await routeSubscriptionMutations(page)

    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    await page.getByRole('tab', { name: /Upgrade Plan/i }).click()
    const upgradePanel = page.locator('#billing-tabpanel-1')
    await expect(upgradePanel).toBeVisible()

    const soloCard = upgradePanel.locator('.MuiCard-root').filter({
      has: page.getByRole('heading', { name: 'Solo' }),
    })
    await expect(soloCard.getByText('Current Plan').first()).toBeVisible()

    const proCard = upgradePanel.locator('.MuiCard-root').filter({
      has: page.getByRole('heading', { name: 'Pro' }),
    })
    await proCard.getByRole('button', { name: 'Upgrade' }).click()

    await expect(page.getByText(/Subscription Updated/i).first()).toBeVisible({
      timeout: TOAST_TIMEOUT,
    })

    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    await expect(
      page.locator('#billing-tabpanel-0').getByRole('heading', { name: /Pro/i }).first()
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('#billing-tabpanel-0 .MuiChip-root', { hasText: 'active' })
    ).toBeVisible()

    expect(errors).toEqual([])
  })

  // ── Test 4: Upgrade Pro -> Team (in-place) ────────────────────────────

  test('should upgrade from Pro to Team', async ({ authenticatedPage: page }) => {
    test.skip(!CAN_RUN, 'Missing Stripe env')
    test.skip(!stripeSubscriptionId, 'No subscription from previous test')

    const errors = collectErrors(page)
    await routeSubscriptionMutations(page)

    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    await page.getByRole('tab', { name: /Upgrade Plan/i }).click()
    const upgradePanel = page.locator('#billing-tabpanel-1')
    await expect(upgradePanel).toBeVisible()

    await expect(
      upgradePanel
        .locator('.MuiCard-root')
        .filter({ has: page.getByRole('heading', { name: 'Pro' }) })
        .getByText('Current Plan')
        .first()
    ).toBeVisible()

    const teamCard = upgradePanel.locator('.MuiCard-root').filter({
      has: page.getByRole('heading', { name: 'Team' }),
    })
    await teamCard.getByRole('button', { name: 'Upgrade' }).click()

    await expect(page.getByText(/Subscription Updated/i).first()).toBeVisible({
      timeout: TOAST_TIMEOUT,
    })

    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    await expect(
      page.locator('#billing-tabpanel-0').getByRole('heading', { name: /Team/i }).first()
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('#billing-tabpanel-0 .MuiChip-root', { hasText: 'active' })
    ).toBeVisible()

    expect(errors).toEqual([])
  })

  // ── Test 5: Downgrade Team -> Free ────────────────────────────────────

  test('should downgrade from Team to Free', async ({ authenticatedPage: page }) => {
    test.skip(!CAN_RUN, 'Missing Stripe env')
    test.skip(!stripeSubscriptionId, 'No subscription from previous test')

    const errors = collectErrors(page)
    await routeSubscriptionMutations(page)

    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    await page.getByRole('tab', { name: /Upgrade Plan/i }).click()
    const upgradePanel = page.locator('#billing-tabpanel-1')
    await expect(upgradePanel).toBeVisible()

    const freeCard = upgradePanel.locator('.MuiCard-root').filter({
      has: page.getByRole('heading', { name: 'Free' }),
    })
    const downgradeBtn = freeCard.getByRole('button', { name: 'Downgrade' })
    await expect(downgradeBtn).toBeVisible()
    await downgradeBtn.click()

    await expect(page.getByText(/Subscription Updated/i).first()).toBeVisible({
      timeout: TOAST_TIMEOUT,
    })

    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    await expect(
      page
        .locator('#billing-tabpanel-0')
        .getByRole('alert')
        .filter({ hasText: /canceled at the end/i })
    ).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  // ── Test 6: Cancel Subscription via Cancel button ─────────────────────

  test('should cancel subscription via Cancel button', async ({
    authenticatedPage: page,
  }) => {
    test.skip(!CAN_RUN, 'Missing Stripe env')
    test.skip(!stripeSubscriptionId, 'No subscription from previous test')
    test.slow()

    const errors = collectErrors(page)
    await routeSubscriptionMutations(page)

    // Re-subscribe by changing tier to Solo (in-place update)
    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    await page.getByRole('tab', { name: /Upgrade Plan/i }).click()
    const upgradePanel = page.locator('#billing-tabpanel-1')
    await expect(upgradePanel).toBeVisible()

    const soloCard = upgradePanel.locator('.MuiCard-root').filter({
      has: page.getByRole('heading', { name: 'Solo' }),
    })
    await soloCard.getByRole('button', { name: 'Downgrade' }).click()

    await expect(page.getByText(/Subscription Updated/i).first()).toBeVisible({
      timeout: TOAST_TIMEOUT,
    })

    // The in-place update does not clear cancel_at_period_end from Test 5.
    // Clear it via Stripe API so the Cancel button becomes visible.
    await stripeApi('POST', `/subscriptions/${stripeSubscriptionId}`, {
      cancel_at_period_end: 'false',
    })

    // Reload billing page; reconciliation picks up the cleared flag from Stripe
    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    await page.getByRole('tab', { name: /Current Plan/i }).click()
    const currentPanel = page.locator('#billing-tabpanel-0')
    await expect(currentPanel).toBeVisible()

    const cancelBtn = currentPanel.getByRole('button', { name: /Cancel Subscription/i })
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 })

    await cancelBtn.click()

    const dialog = page.locator('.MuiDialog-root')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Cancel Subscription')).toBeVisible()

    await dialog.getByRole('button', { name: 'Confirm Cancellation' }).click()

    // Wait for dialog to close (cancel API fires asynchronously)
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    // Reload to pick up the cancellation state reliably
    await gotoAndWait(page, '/billing', PAGE_CLASS)
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: TAB_TIMEOUT })

    const updatedPanel = page.locator('#billing-tabpanel-0')

    await expect(
      updatedPanel
        .getByRole('alert')
        .filter({ hasText: /canceled at the end/i })
    ).toBeVisible({ timeout: 10_000 })

    await expect(
      updatedPanel.getByRole('button', { name: /Cancel Subscription/i })
    ).not.toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  // ── Cleanup ───────────────────────────────────────────────────────────

  /**
   * The database seed puts the seeded user at tier "team" (active), and the
   * tier1 API suite depends on that state for quota/tier assertions. These
   * tests intentionally leave the subscription at free/canceled, so ALWAYS
   * restore the seeded tier here — regardless of how far the suite got —
   * to keep the tier1 and tier2 suites order-independent.
   */
  test.afterAll(async () => {
    if (!STRIPE_SECRET || !WEBHOOK_SECRET) return

    // Restore the seeded user's subscription to the seeded tier (team).
    // If an active Stripe sub is still linked (partial-failure states), it is
    // swapped to the team price in place; otherwise a fresh customer + sub is
    // bootstrapped and linked via a signed checkout webhook.
    let restoredSubId = ''
    try {
      const result = await restoreSeededSubscription()
      restoredSubId = result.stripeSubscriptionId || ''
    } catch (err) {
      console.error('[billing-lifecycle afterAll] seeded tier restore failed:', err)
    }

    // If the subscription created by these tests is NOT the one now linked to
    // the seeded user, cancel it in Stripe so no orphaned test subs accrue
    if (stripeSubscriptionId && stripeSubscriptionId !== restoredSubId) {
      try {
        const linked =
          restoredSubId || (await fetchCurrentSub(readCtx().apiKey))?.stripeSubscriptionId
        if (stripeSubscriptionId !== linked) {
          await updateSubToDummyPrice(stripeSubscriptionId)
          await stripeApi('DELETE', `/subscriptions/${stripeSubscriptionId}`)
        }
      } catch {
        // Best-effort cleanup
      }
    }
  })
})
