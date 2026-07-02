import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Shared billing helpers for the Stripe subscription lifecycle tests and the
 * seeded-subscription restore flow.
 *
 * All environment access is lazy (function calls, not module constants) so
 * this module works both inside Playwright specs (envs loaded by
 * playwright.config.ts) and as a standalone script (envs loaded by the
 * caller via loadEnvs()).
 */

/** The tier the database seed assigns to the seeded user (fullorg.ts) */
export const SeededTier = `team`

export const backendUrl = () =>
  `http://localhost:${process.env.TDSK_BE_PORT || `5885`}`

export const proxyUrl = () =>
  process.env.TDSK_IT_PROXY_URL ||
  `https://${process.env.TDSK_CADDY_PX_HOST || `px.local.threadedstack.app`}`

export const stripeSecret = () => process.env.TDSK_PAY_ACCESS_TOKEN || ``

export const webhookSecret = () => process.env.TDSK_PAY_WEBHOOK_SECRET || ``

export function parsePriceIds(plans: string): Record<string, string> {
  const ids: Record<string, string> = {}
  if (!plans?.trim()) return ids
  for (const part of plans.split(`,`)) {
    const [name, value] = part.split(`=`).map((s) => s.trim())
    if (!name || !value) continue
    const [priceId] = value.split(`:`).map((s) => s.trim())
    if (priceId) ids[name] = priceId
  }
  return ids
}

export const priceIds = () => parsePriceIds(process.env.TDSK_PAY_PLANS || ``)

// ─── Stripe REST API ────────────────────────────────────────────────────

export async function stripeApi(
  method: string,
  path: string,
  body?: Record<string, string>
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeSecret()}`,
  }
  const init: RequestInit = { method, headers }
  if (body) {
    headers[`Content-Type`] = `application/x-www-form-urlencoded`
    init.body = new URLSearchParams(body).toString()
  }
  const resp = await fetch(`https://api.stripe.com/v1${path}`, init)
  return resp.json()
}

export async function createStripeSubscription(customerId: string, priceId: string) {
  const pm = await stripeApi(`POST`, `/payment_methods`, {
    type: `card`,
    'card[token]': `tok_visa`,
  })
  await stripeApi(`POST`, `/payment_methods/${pm.id}/attach`, {
    customer: customerId,
  })
  await stripeApi(`POST`, `/customers/${customerId}`, {
    'invoice_settings[default_payment_method]': pm.id,
  })
  return stripeApi(`POST`, `/subscriptions`, {
    customer: customerId,
    'items[0][price]': priceId,
  })
}

export async function updateSubToDummyPrice(subId: string) {
  try {
    const dummyPrice = await stripeApi(`POST`, `/prices`, {
      unit_amount: `0`,
      currency: `usd`,
      'recurring[interval]': `month`,
      'product_data[name]': `test-cleanup`,
    })
    const subData = await stripeApi(`GET`, `/subscriptions/${subId}`)
    const itemId = subData.items?.data?.[0]?.id
    if (!itemId) return
    await stripeApi(`POST`, `/subscriptions/${subId}`, {
      'items[0][id]': itemId,
      'items[0][price]': dummyPrice.id,
      proration_behavior: `none`,
    })
  } catch {
    // Sub may already be canceled
  }
}

// ─── Webhook signing ────────────────────────────────────────────────────

export function signAndPostWebhook(event: Record<string, unknown>): Promise<Response> {
  const payload = JSON.stringify(event)
  const ts = Math.floor(Date.now() / 1000)
  const sig = createHmac(`sha256`, webhookSecret())
    .update(`${ts}.${payload}`)
    .digest(`hex`)

  return fetch(`${backendUrl()}/_/payments/webhooks`, {
    method: `POST`,
    headers: {
      'Content-Type': `application/json`,
      'stripe-signature': `t=${ts},v1=${sig}`,
    },
    body: payload,
  })
}

export function buildCheckoutEvent(custId: string, subId: string, tier: string) {
  return {
    id: `evt_checkout_${Date.now()}`,
    object: `event`,
    type: `checkout.session.completed`,
    data: {
      object: {
        id: `cs_test_${Date.now()}`,
        object: `checkout.session`,
        customer: custId,
        subscription: subId,
        metadata: { tier },
        mode: `subscription`,
      },
    },
  }
}

export function buildDeletionEvent(subId: string, custId: string) {
  return {
    id: `evt_delete_${Date.now()}`,
    object: `event`,
    type: `customer.subscription.deleted`,
    data: {
      object: {
        id: subId,
        object: `subscription`,
        customer: custId,
        status: `canceled`,
        cancel_at_period_end: false,
        items: { data: [] },
      },
    },
  }
}

export function buildUpdateEvent(sub: Record<string, unknown>) {
  return {
    id: `evt_update_${Date.now()}`,
    object: `event`,
    type: `customer.subscription.updated`,
    data: { object: sub },
  }
}

// ─── Context ────────────────────────────────────────────────────────────

export function readCtx() {
  return JSON.parse(
    readFileSync(join(tmpdir(), `tdsk-integration`, `context.json`), `utf-8`)
  ) as { apiKey: string; userId: string; orgId: string }
}

export async function fetchCurrentSub(apiKey: string): Promise<any> {
  const resp = await fetch(`${proxyUrl()}/_/subscriptions/current`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!resp.ok) return null
  const { data } = (await resp.json()) as any
  return data
}

// ─── Seeded subscription restore ────────────────────────────────────────

const isSeededState = (sub: any) =>
  sub?.tier === SeededTier &&
  (sub?.status === `active` || sub?.status === `trialing`) &&
  !sub?.cancelAtPeriodEnd

/**
 * Restore the seeded user's subscription to the seeded tier (`team`, active,
 * not pending cancellation) using the same real-Stripe + signed-webhook
 * mechanism the billing lifecycle tests use.
 *
 * Tolerant of any starting state:
 *  - already at the seeded tier            → no-op
 *  - active Stripe sub on another tier or
 *    pending cancellation                  → in-place price swap + update webhook
 *  - no sub / canceled sub / broken link   → bootstrap fresh customer + sub,
 *                                            link via checkout webhook
 *
 * Throws if the subscription cannot be verified at the seeded tier afterwards.
 */
export async function restoreSeededSubscription(): Promise<{
  changed: boolean
  tier: string
  stripeSubscriptionId?: string
}> {
  const prices = priceIds()
  if (!stripeSecret() || !webhookSecret() || !prices[SeededTier])
    throw new Error(
      `[billing restore] Missing Stripe env (TDSK_PAY_ACCESS_TOKEN, ` +
        `TDSK_PAY_WEBHOOK_SECRET, or "${SeededTier}" price in TDSK_PAY_PLANS)`
    )

  const ctx = readCtx()
  const current = await fetchCurrentSub(ctx.apiKey)

  if (isSeededState(current))
    return {
      changed: false,
      tier: current.tier,
      stripeSubscriptionId: current.stripeSubscriptionId,
    }

  // Path 1: an active Stripe subscription is already linked — swap it to the
  // seeded tier's price in place and clear any pending cancellation
  if (current?.stripeSubscriptionId) {
    try {
      const stripeSub = await stripeApi(
        `GET`,
        `/subscriptions/${current.stripeSubscriptionId}`
      )
      const itemId = stripeSub?.items?.data?.[0]?.id
      if (
        (stripeSub?.status === `active` || stripeSub?.status === `trialing`) &&
        itemId
      ) {
        await stripeApi(`POST`, `/subscriptions/${current.stripeSubscriptionId}`, {
          'items[0][id]': itemId,
          'items[0][price]': prices[SeededTier],
          cancel_at_period_end: `false`,
          proration_behavior: `none`,
        })
        const updated = await stripeApi(
          `GET`,
          `/subscriptions/${current.stripeSubscriptionId}`
        )
        await signAndPostWebhook(buildUpdateEvent(updated))
      }
    } catch {
      // Fall through to bootstrap below
    }

    const afterSwap = await fetchCurrentSub(ctx.apiKey)
    if (isSeededState(afterSwap))
      return {
        changed: true,
        tier: afterSwap.tier,
        stripeSubscriptionId: afterSwap.stripeSubscriptionId,
      }
  }

  // Path 2: bootstrap a fresh Stripe customer + subscription and link it via
  // a signed checkout.session.completed webhook (same path a real checkout uses)
  const customer = await stripeApi(`POST`, `/customers`, {
    email: `integration@test.local`,
    'metadata[userId]': ctx.userId,
  })
  const sub = await createStripeSubscription(customer.id, prices[SeededTier])
  if (!sub?.id)
    throw new Error(
      `[billing restore] Failed to create Stripe subscription: ${JSON.stringify(sub)}`
    )

  const resp = await signAndPostWebhook(
    buildCheckoutEvent(customer.id, sub.id, SeededTier)
  )
  if (!resp.ok)
    throw new Error(
      `[billing restore] checkout webhook failed: ${resp.status} ${await resp.text()}`
    )

  const after = await fetchCurrentSub(ctx.apiKey)
  if (!isSeededState(after))
    throw new Error(
      `[billing restore] Subscription not at seeded tier after restore: ` +
        JSON.stringify({
          tier: after?.tier,
          status: after?.status,
          cancelAtPeriodEnd: after?.cancelAtPeriodEnd,
        })
    )

  return {
    changed: true,
    tier: after.tier,
    stripeSubscriptionId: after.stripeSubscriptionId,
  }
}
