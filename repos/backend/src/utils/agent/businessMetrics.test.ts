import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ESubscriptionStatus } from '@tdsk/domain'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { buildBusinessMetricsContext } from './businessMetrics'

type TBuildOpts = {
  subscription?: { list: any }
  user?: { list: any }
  quota?: { list: any }
  fetchPlans?: any
}

const buildApp = (opts: TBuildOpts) =>
  ({
    locals: {
      db: {
        services: {
          subscription: opts.subscription ?? {
            list: vi.fn().mockResolvedValue({ data: [] }),
          },
          user: opts.user ?? { list: vi.fn().mockResolvedValue({ data: [] }) },
          quota: opts.quota ?? { list: vi.fn().mockResolvedValue({ data: [] }) },
        },
      },
      payments: {
        service: {
          fetchPlans: opts.fetchPlans ?? vi.fn().mockResolvedValue({ data: [] }),
        },
      },
    },
  }) as any

const nowIso = () => new Date().toISOString()
const daysAgoIso = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

// Monthly-priced plans; pro/team carry a $10/seat add-on. Included seats mirror
// PlanLimits (pro=3, team=10), so seat revenue only kicks in above those counts.
const monthlyPlans = () => ({
  data: [
    { id: `free`, price: 0, seatPrice: 0, interval: `month` },
    { id: `solo`, price: 1900, seatPrice: 0, interval: `month` },
    { id: `pro`, price: 4900, seatPrice: 1000, interval: `month` },
    { id: `team`, price: 9900, seatPrice: 1000, interval: `month` },
  ],
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`buildBusinessMetricsContext — aggregation math`, () => {
  it(`groups active subs by tier, totals them, and estimates MRR (incl. seat add-ons)`, async () => {
    const subs = [
      { tier: `free`, status: ESubscriptionStatus.active },
      { tier: `free`, status: ESubscriptionStatus.active },
      { tier: `free`, status: ESubscriptionStatus.active },
      { tier: `solo`, status: ESubscriptionStatus.active },
      { tier: `solo`, status: ESubscriptionStatus.active },
      // pro w/ 5 seats → base 4900 + (5-3)*1000 = 6900
      { tier: `pro`, status: ESubscriptionStatus.active, seats: 5 },
      // team w/ 10 seats → base 9900 + (10-10)*1000 = 9900
      { tier: `team`, status: ESubscriptionStatus.active, seats: 10 },
      // canceled inside the 30d window → churn = 1
      { tier: `solo`, status: ESubscriptionStatus.canceled, updatedAt: nowIso() },
      // canceled OUTSIDE the window → not counted
      { tier: `pro`, status: ESubscriptionStatus.canceled, updatedAt: daysAgoIso(60) },
      // active but flagged to cancel at period end → active + pending churn = 1
      {
        tier: `team`,
        status: ESubscriptionStatus.active,
        seats: 10,
        cancelAtPeriodEnd: true,
      },
    ]

    const users = [
      { role: `approved`, createdAt: nowIso() }, // signup in window
      { role: `approved`, createdAt: daysAgoIso(60) }, // old, not a signup
      { role: `waitlist`, createdAt: nowIso() }, // signup + waitlist
      { role: `waitlist`, createdAt: daysAgoIso(90) }, // waitlist only
    ]

    const quotaRows = [
      { threads: 10, messages: 100, compute: 500 },
      { threads: 5, messages: 50, compute: 200 },
    ]

    const out = await buildBusinessMetricsContext(
      buildApp({
        subscription: { list: vi.fn().mockResolvedValue({ data: subs }) },
        user: { list: vi.fn().mockResolvedValue({ data: users }) },
        quota: { list: vi.fn().mockResolvedValue({ data: quotaRows }) },
        fetchPlans: vi.fn().mockResolvedValue(monthlyPlans()),
      }),
      `org-1`
    )

    expect(out).toContain(`## Business metrics`)
    // 3 free + 2 solo + 1 pro + 2 team (row7 + the cancelAtPeriodEnd team) = 8 active
    expect(out).toContain(`Active subscriptions: 8 total`)
    expect(out).toContain(`- free: 3`)
    expect(out).toContain(`- solo: 2`)
    expect(out).toContain(`- pro: 1`)
    expect(out).toContain(`- team: 2`)
    // MRR = 3800 (solo) + 6900 (pro) + 9900 + 9900 (two team) = 30500c = $305/mo
    expect(out).toContain(`Estimated MRR: $305/mo`)
    // signups (A + C) = 2
    expect(out).toContain(`New signups (30d): 2`)
    // 1 canceled inside window, 1 pending cancel-at-period-end
    expect(out).toContain(`Churn: 1 canceled (30d), 1 pending cancel-at-period-end`)
    // engagement summed across orgs
    expect(out).toContain(`15 threads, 150 messages, 700 compute`)
    expect(out).toContain(`Engagement (${getBillingPeriod()}, all orgs)`)
    // waitlist (C + D) = 2
    expect(out).toContain(`Waitlist: 2 pending`)
  })

  it(`renders a zeros section for an empty org (not an error, not '')`, async () => {
    const out = await buildBusinessMetricsContext(buildApp({}), `org-empty`)

    expect(out).not.toBe(``)
    expect(out).toContain(`## Business metrics`)
    expect(out).toContain(`Active subscriptions: 0 total`)
    // no tier rows when every count is zero
    expect(out).not.toContain(`- free:`)
    expect(out).toContain(`New signups (30d): 0`)
    expect(out).toContain(`Churn: 0 canceled (30d), 0 pending cancel-at-period-end`)
    expect(out).toContain(`0 threads, 0 messages, 0 compute`)
    expect(out).toContain(`Waitlist: 0 pending`)
    // no plan prices in scope → MRR omitted (never fabricated)
    expect(out).toContain(`Estimated MRR: unavailable (plan prices not configured)`)
  })

  it(`omits MRR (not fabricated) when plan prices are all zero (dev/console mode)`, async () => {
    const out = await buildBusinessMetricsContext(
      buildApp({
        subscription: {
          list: vi
            .fn()
            .mockResolvedValue({
              data: [{ tier: `solo`, status: ESubscriptionStatus.active }],
            }),
        },
        fetchPlans: vi
          .fn()
          .mockResolvedValue({
            data: [{ id: `solo`, price: 0, seatPrice: 0, interval: `month` }],
          }),
      }),
      `org-dev`
    )

    expect(out).toContain(`Active subscriptions: 1 total`)
    expect(out).toContain(`Estimated MRR: unavailable (plan prices not configured)`)
  })

  it(`still renders the section (MRR unavailable) when the payments provider throws`, async () => {
    const out = await buildBusinessMetricsContext(
      buildApp({
        subscription: {
          list: vi
            .fn()
            .mockResolvedValue({
              data: [{ tier: `pro`, status: ESubscriptionStatus.active }],
            }),
        },
        fetchPlans: vi.fn().mockRejectedValue(new Error(`stripe down`)),
      }),
      `org-2`
    )

    expect(out).toContain(`## Business metrics`)
    expect(out).toContain(`Active subscriptions: 1 total`)
    expect(out).toContain(`Estimated MRR: unavailable (plan prices not configured)`)
  })

  it(`returns '' (never throws) when the subscriptions service rejects`, async () => {
    const out = await buildBusinessMetricsContext(
      buildApp({
        subscription: { list: vi.fn().mockRejectedValue(new Error(`db down`)) },
      }),
      `org-3`
    )
    expect(out).toBe(``)
  })

  it(`returns '' when the subscriptions service resolves an error result`, async () => {
    const out = await buildBusinessMetricsContext(
      buildApp({
        subscription: { list: vi.fn().mockResolvedValue({ error: new Error(`boom`) }) },
      }),
      `org-4`
    )
    expect(out).toBe(``)
  })
})
