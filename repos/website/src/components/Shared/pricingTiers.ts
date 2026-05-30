import type { Plan } from '@tdsk/domain'

export type PricingTier = {
  name: string
  price: string
  description: string
  features: { label: string; included: boolean }[]
  cta: string
  highlighted?: boolean
  subtitle?: string
}

const fmt = (value: number, suffix?: string): string => {
  if (value === -1) return 'Unlimited'
  const formatted = value.toLocaleString('en-US')
  return suffix ? `${formatted}${suffix}` : formatted
}

const fmtPrice = (cents: number): string => {
  if (cents === 0) return '$0/mo'
  return `$${cents / 100}/mo`
}

const fmtSeatPrice = (cents: number): string | undefined => {
  if (!cents) return undefined
  return `+$${cents / 100}/seat/mo`
}

type TierMeta = {
  cta: string
  support: string
  description: string
  highlighted?: boolean
  customDomains: boolean
}

const tierMeta: Record<string, TierMeta> = {
  free: {
    description: `Try Threaded Stack with one sandbox session. No credit card.`,
    cta: `Get Started Free`,
    support: `Community Support`,
    customDomains: false,
  },
  solo: {
    cta: `Start Solo`,
    customDomains: false,
    support: `Email Support`,
    description: `For developers who use AI tools daily and need more than one session.`,
  },
  pro: {
    cta: `Start Pro`,
    highlighted: true,
    customDomains: true,
    support: `Priority Support`,
    description: `For teams sharing credentials, sandboxes, and sessions across projects.`,
  },
  team: {
    cta: `Start Team`,
    customDomains: true,
    support: `Dedicated Support`,
    description: `Unlimited everything. Dedicated support. Custom domains.`,
  },
}

export const buildTiers = (plans: Plan[]): PricingTier[] => {
  return plans.map((plan) => {
    const meta = tierMeta[plan.id] ?? tierMeta.free
    const lim = plan.limits

    return {
      name: plan.name,
      price: fmtPrice(plan.price),
      subtitle: fmtSeatPrice(plan.seatPrice),
      description: meta.description,
      highlighted: meta.highlighted,
      cta: meta.cta,
      features: [
        {
          label: `${fmt(lim.sandboxSessions)} Sandbox Session${lim.sandboxSessions !== 1 ? 's' : ''}`,
          included: true,
        },
        { label: `${fmt(lim.projects)} Projects`, included: true },
        {
          label: `${fmt(lim.seats)} Seat${lim.seats !== 1 ? 's' : ''}${lim.additionalSeats ? ' included' : ''}`,
          included: true,
        },
        { label: `${fmt(lim.secrets)} Secrets`, included: true },
        { label: `${fmt(lim.endpoints)} Endpoints`, included: true },
        { label: `${fmt(lim.compute)} Compute units`, included: true },
        { label: meta.support, included: true },
        { label: 'Custom Domains', included: meta.customDomains },
      ],
    }
  })
}
