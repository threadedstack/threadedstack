import type { TApp } from '@TBE/types'
import type { Plan } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'
import {
  PlanLimits,
  WaitlistRole,
  ESubscriptionTier,
  ESubscriptionStatus,
  BusinessMetricsInjectMaxChars,
} from '@tdsk/domain'

/** Recent window (days) for signups + churn counts in the injected metrics. */
const BusinessMetricsWindowDays = 30

/** Tier render order for the active-subscriptions breakdown. */
const TierOrder: string[] = [
  ESubscriptionTier.free,
  ESubscriptionTier.solo,
  ESubscriptionTier.pro,
  ESubscriptionTier.team,
]

const fmtInt = (value: number): string => Math.round(value).toLocaleString(`en-US`)

/**
 * Monthly-equivalent revenue (in cents) a plan contributes for one active
 * subscription: the base price plus per-seat add-on revenue for seats beyond the
 * plan's included seat count. Annual plans are amortized to a monthly figure.
 * Returns 0 when the plan carries no price (dev/console payments), which the
 * caller treats as "MRR not derivable" rather than fabricating a number.
 */
const monthlyMrrCents = (plan: Plan, seats: number): number => {
  const divisor = plan.interval === `year` ? 12 : 1
  const base = (plan.price ?? 0) / divisor
  const includedSeats = PlanLimits[plan.id as ESubscriptionTier]?.seats ?? 1
  const extraSeats = plan.seatPrice > 0 ? Math.max(0, seats - includedSeats) : 0
  const seatRevenue = (extraSeats * (plan.seatPrice ?? 0)) / divisor
  return base + seatRevenue
}

/**
 * Build the injected `## Business metrics` context for a cycle that consumes the
 * executive faculty. Aggregates READ-ONLY, company-wide business signals:
 *   - active subscriptions grouped by tier (+ total) and an MRR estimate,
 *   - new signups + waitlist demand (from the users table),
 *   - churn (canceled in-window + pending cancel-at-period-end),
 *   - current-period engagement (quota consumption summed across all orgs).
 *
 * Subscriptions/users/quotas are not scoped to `orgId` — they represent the whole
 * company's book of business; `orgId` identifies the executive org whose cycle is
 * being assembled (used for defensive logging + injection-convention parity with
 * buildCompanyStrategyContext).
 *
 * Dormant + defensive (mirrors buildCompanyStrategyContext): the primary read
 * failing (or the whole builder throwing) degrades context to '' (logged) and
 * never throws — safe in prod before any data exists. Secondary signals
 * (signups/waitlist/engagement/MRR) degrade individually to zero/omitted so a
 * single missing source never blanks the revenue picture. Capped at
 * BusinessMetricsInjectMaxChars.
 */
export async function buildBusinessMetricsContext(
  app: TApp,
  orgId: string
): Promise<string> {
  try {
    const { db, payments } = app.locals

    // ── Revenue / customers (platform-wide). A subscriptions read failure is
    // fatal to the section (returns '') — the tier breakdown is the core signal.
    const { data: subs, error: subErr } = await db.services.subscription.list()
    if (subErr || !subs) {
      if (subErr)
        logger.error(
          `[Executor] buildBusinessMetricsContext subscriptions read failed for org ${orgId}:`,
          subErr.message
        )
      return ``
    }

    const activeSubs = subs.filter((sub) => sub.status === ESubscriptionStatus.active)

    const byTier = new Map<string, number>()
    for (const sub of activeSubs) byTier.set(sub.tier, (byTier.get(sub.tier) ?? 0) + 1)

    // ── Churn. A cancellation flips status to `canceled` and stamps updatedAt, so
    // canceled rows are windowed by updatedAt (there is no dedicated canceledAt
    // column). cancelAtPeriodEnd is a live pending-churn flag, counted as-is.
    const windowStart = Date.now() - BusinessMetricsWindowDays * 24 * 60 * 60 * 1000
    const canceledInWindow = subs.filter(
      (sub) =>
        sub.status === ESubscriptionStatus.canceled &&
        sub.updatedAt !== undefined &&
        new Date(sub.updatedAt).getTime() >= windowStart
    ).length
    const pendingCancel = subs.filter((sub) => sub.cancelAtPeriodEnd === true).length

    // ── MRR estimate. Plan prices live in the payments provider (Stripe), not a
    // code constant, so MRR is derivable only when live prices are available. Omit
    // (never fabricate) when prices are missing (dev/console mode / provider error).
    let mrrCents = 0
    let mrrDerivable = false
    try {
      const { data: plans } = await payments.service.fetchPlans()
      const plansByTier = new Map<string, Plan>()
      for (const plan of plans ?? []) plansByTier.set(plan.id, plan)

      if ((plans ?? []).some((plan) => (plan.price ?? 0) > 0)) {
        mrrDerivable = true
        for (const sub of activeSubs) {
          const plan = plansByTier.get(sub.tier)
          if (plan) mrrCents += monthlyMrrCents(plan, sub.seats ?? 1)
        }
      }
    } catch (err) {
      logger.error(
        `[Executor] buildBusinessMetricsContext MRR estimate failed for org ${orgId}:`,
        (err as Error).message
      )
    }

    // ── Demand + signups (platform-wide). One users scan yields both the recent
    // signup count (createdAt window) and the pending waitlist count (role flag).
    // A users read failure degrades these two signals to zero, not the section.
    let signups = 0
    let waitlist = 0
    const { data: users = [] } = await db.services.user.list()
    for (const user of users) {
      if (user.role === WaitlistRole) waitlist += 1
      if (
        user.createdAt !== undefined &&
        new Date(user.createdAt).getTime() >= windowStart
      )
        signups += 1
    }

    // ── Engagement (current period, platform-wide). Sum the consumption counters
    // across every org's quota row for the current billing period.
    const period = getBillingPeriod()
    const { data: quotaRows = [] } = await db.services.quota.list({ where: { period } })
    let threads = 0
    let messages = 0
    let compute = 0
    for (const quota of quotaRows) {
      threads += quota.threads ?? 0
      messages += quota.messages ?? 0
      compute += quota.compute ?? 0
    }

    // ── Render ─────────────────────────────────────────────────────────────
    const lines: string[] = [`## Business metrics`]

    lines.push(`Active subscriptions: ${fmtInt(activeSubs.length)} total`)
    for (const tier of TierOrder) {
      const count = byTier.get(tier) ?? 0
      if (count > 0) lines.push(`- ${tier}: ${fmtInt(count)}`)
    }

    lines.push(
      mrrDerivable
        ? `Estimated MRR: $${fmtInt(mrrCents / 100)}/mo`
        : `Estimated MRR: unavailable (plan prices not configured)`
    )

    lines.push(`New signups (${BusinessMetricsWindowDays}d): ${fmtInt(signups)}`)
    lines.push(
      `Churn: ${fmtInt(canceledInWindow)} canceled (${BusinessMetricsWindowDays}d), ` +
        `${fmtInt(pendingCancel)} pending cancel-at-period-end`
    )
    lines.push(
      `Engagement (${period}, all orgs): ${fmtInt(threads)} threads, ` +
        `${fmtInt(messages)} messages, ${fmtInt(compute)} compute`
    )
    lines.push(`Waitlist: ${fmtInt(waitlist)} pending`)

    const out = `${lines.join(`\n`)}\n\n`
    return out.length > BusinessMetricsInjectMaxChars
      ? out.slice(0, BusinessMetricsInjectMaxChars)
      : out
  } catch (err) {
    logger.error(
      `[Executor] buildBusinessMetricsContext failed for org ${orgId}:`,
      (err as Error).message
    )
    return ``
  }
}
