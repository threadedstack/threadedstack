import { PlanLimits } from '@tdsk/domain'

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

const free = PlanLimits.free
const solo = PlanLimits.solo
const pro = PlanLimits.pro
const team = PlanLimits.team

export const tiers: PricingTier[] = [
  {
    name: 'Free',
    price: '$0/mo',
    description: 'For experimenting and learning.',
    features: [
      { label: `${fmt(free.sandboxSessions)} Sandbox Session`, included: true },
      { label: `${fmt(free.projects)} Projects`, included: true },
      { label: `${fmt(free.seats)} Seat`, included: true },
      { label: `${fmt(free.secrets)} Secrets`, included: true },
      { label: `${fmt(free.endpoints)} Endpoints`, included: true },
      { label: `${fmt(free.compute)} Compute units`, included: true },
      { label: 'Community Support', included: true },
      { label: 'Custom Domains', included: false },
    ],
    cta: 'Get Started Free',
  },
  {
    name: 'Solo',
    price: '$15/mo',
    description: 'For solo developers shipping real projects.',
    features: [
      { label: `${fmt(solo.sandboxSessions)} Sandbox Sessions`, included: true },
      { label: `${fmt(solo.projects)} Projects`, included: true },
      { label: `${fmt(solo.seats)} Seat`, included: true },
      { label: `${fmt(solo.secrets)} Secrets`, included: true },
      { label: `${fmt(solo.endpoints)} Endpoints`, included: true },
      { label: `${fmt(solo.compute)} Compute units`, included: true },
      { label: 'Email Support', included: true },
      { label: 'Custom Domains', included: false },
    ],
    cta: 'Start Solo',
  },
  {
    name: 'Pro',
    price: '$39/mo',
    description: 'For small teams building together.',
    highlighted: true,
    subtitle: '+$10/seat/mo',
    features: [
      { label: `${fmt(pro.sandboxSessions)} Sandbox Sessions`, included: true },
      { label: `${fmt(pro.projects)} Projects`, included: true },
      { label: `${fmt(pro.seats)} Seats included`, included: true },
      { label: `${fmt(pro.secrets)} Secrets`, included: true },
      { label: `${fmt(pro.endpoints)} Endpoints`, included: true },
      { label: `${fmt(pro.compute)} Compute units`, included: true },
      { label: 'Priority Support', included: true },
      { label: 'Custom Domains', included: true },
    ],
    cta: 'Start Pro',
  },
  {
    name: 'Team',
    price: '$99/mo',
    description: 'For organizations at scale.',
    subtitle: '+$8/seat/mo',
    features: [
      { label: `${fmt(team.sandboxSessions)} Sandbox Sessions`, included: true },
      { label: `${fmt(team.projects)} Projects`, included: true },
      { label: `${fmt(team.seats)} Seats included`, included: true },
      { label: `${fmt(team.secrets)} Secrets`, included: true },
      { label: `${fmt(team.endpoints)} Endpoints`, included: true },
      { label: `${fmt(team.compute)} Compute units`, included: true },
      { label: 'Dedicated Support', included: true },
      { label: 'Custom Domains', included: true },
    ],
    cta: 'Start Team',
  },
]
