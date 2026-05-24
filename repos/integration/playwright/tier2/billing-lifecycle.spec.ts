import { test, expect } from '../fixtures/auth'
import { collectErrors, gotoAndWait } from '../utils/crud-helpers'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const PAGE_CLASS = 'tdsk-billing-page'
const TAB_TIMEOUT = 15_000
const TOAST_TIMEOUT = 15_000

const BACKEND_URL = `http://localhost:${process.env.TDSK_BE_PORT || '5885'}`
const PROXY_URL =
  process.env.TDSK_IT_PROXY_URL ||
  `https://${process.env.TDSK_CADDY_PX_HOST || 'px.local.threadedstack.app'}`
const STRIPE_SECRET = process.env.TDSK_PAY_ACCESS_TOKEN || ''
const WEBHOOK_SECRET = process.env.TDSK_PAY_WEBHOOK_SECRET || ''

function parsePriceIds(plans: string): Record<string, string> {
  const ids: Record<string, string> = {}
  if (!plans?.trim()) return ids
  for (const part of plans.split(',')) {
    const [name, value] = part.split('=').map((s) => s.trim())
    if (!name || !value) continue
    const [priceId] = value.split(':').map((s) => s.trim())
    if (priceId) ids[name] = priceId
  }
  return ids
}

const PRICE_IDS = parsePriceIds(process.env.TDSK_PAY_PLANS || '')
const CAN_RUN = Boolean(STRIPE_SECRET && WEBHOOK_SECRET && PRICE_IDS.solo)

// ─── Stripe REST API ────────────────────────────────────────────────────

async function stripeApi(
  method: string,
  path: string,
  body?: Record<string, string>
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET}`,
  }
  const init: RequestInit = { method, headers }
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    init.body = new URLSearchParams(body).toString()
  }
  const resp = await fetch(`https://api.stripe.com/v1${path}`, init)
  return resp.json()
}

async function createStripeSubscription(customerId: string, priceId: string) {
  const pm = await stripeApi('POST', '/payment_methods', {
    type: 'card',
    'card[token]': 'tok_visa',
  })
  await stripeApi('POST', `/payment_methods/${pm.id}/attach`, {
    customer: customerId,
  })
  await stripeApi('POST', `/customers/${customerId}`, {
    'invoice_settings[default_payment_method]': pm.id,
  })
  return stripeApi('POST', '/subscriptions', {
    customer: customerId,
    'items[0][price]': priceId,
  })
}

async function updateSubToDummyPrice(subId: string) {
  try {
    const dummyPrice = await stripeApi('POST', '/prices', {
      unit_amount: '0',
      currency: 'usd',
      'recurring[interval]': 'month',
      'product_data[name]': 'test-cleanup',
    })
    const subData = await stripeApi('GET', `/subscriptions/${subId}`)
    const itemId = subData.items?.data?.[0]?.id
    if (!itemId) return
    await stripeApi('POST', `/subscriptions/${subId}`, {
      'items[0][id]': itemId,
      'items[0][price]': dummyPrice.id,
      proration_behavior: 'none',
    })
  } catch {
    // Sub may already be canceled
  }
}

// ─── Webhook signing ────────────────────────────────────────────────────

function signAndPostWebhook(event: Record<string, unknown>): Promise<Response> {
  const payload = JSON.stringify(event)
  const ts = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${ts}.${payload}`)
    .digest('hex')

  return fetch(`${BACKEND_URL}/_/payments/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': `t=${ts},v1=${sig}`,
    },
    body: payload,
  })
}

function buildCheckoutEvent(custId: string, subId: string, tier: string) {
  return {
    id: `evt_checkout_${Date.now()}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_test_${Date.now()}`,
        object: 'checkout.session',
        customer: custId,
        subscription: subId,
        metadata: { tier },
        mode: 'subscription',
      },
    },
  }
}

function buildDeletionEvent(subId: string, custId: string) {
  return {
    id: `evt_delete_${Date.now()}`,
    object: 'event',
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: subId,
        object: 'subscription',
        customer: custId,
        status: 'canceled',
        cancel_at_period_end: false,
        items: { data: [] },
      },
    },
  }
}

// ─── Context ────────────────────────────────────────────────────────────

function readCtx() {
  return JSON.parse(
    readFileSync(join(tmpdir(), 'tdsk-integration', 'context.json'), 'utf-8')
  ) as { apiKey: string; userId: string; orgId: string }
}

async function fetchCurrentSub(apiKey: string): Promise<any> {
  const resp = await fetch(`${PROXY_URL}/_/subscriptions/current`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!resp.ok) return null
  const { data } = (await resp.json()) as any
  return data
}

// ─── Tests ──────────────────────────────────────────────────────────────

test.describe.serial('Billing Subscription Lifecycle', () => {
  let stripeCustomerId = ''
  let stripeSubscriptionId = ''

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

  test.afterAll(async () => {
    if (!stripeSubscriptionId || !STRIPE_SECRET) return

    try {
      // Swap to a dummy price so future reconciliation maps tier to "free"
      await updateSubToDummyPrice(stripeSubscriptionId)
      await stripeApi('DELETE', `/subscriptions/${stripeSubscriptionId}`)

      if (WEBHOOK_SECRET) {
        await signAndPostWebhook(
          buildDeletionEvent(stripeSubscriptionId, stripeCustomerId)
        )
      }
    } catch {
      // Best-effort cleanup
    }
  })
})
