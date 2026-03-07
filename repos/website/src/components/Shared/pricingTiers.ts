export type PricingTier = {
  name: string
  price: string
  description: string
  features: { label: string; included: boolean }[]
  cta: string
  highlighted?: boolean
}

export const tiers: PricingTier[] = [
  {
    name: 'Free',
    price: '$0/mo',
    description: 'For experimenting and learning.',
    features: [
      { label: '1 Project', included: true },
      { label: '1 Team Member', included: true },
      { label: '5 Endpoints', included: true },
      { label: '10 Threads', included: true },
      { label: '100 Messages', included: true },
      { label: 'Community Support', included: true },
      { label: 'Custom Domains', included: false },
      { label: 'Priority Support', included: false },
    ],
    cta: 'Get Started Free',
  },
  {
    name: 'Basic',
    price: '$19/mo',
    description: 'For individuals building their first agents.',
    features: [
      { label: '3 Projects', included: true },
      { label: '5 Team Members', included: true },
      { label: '25 Endpoints', included: true },
      { label: '100 Threads', included: true },
      { label: '1,000 Messages', included: true },
      { label: 'Email Support', included: true },
      { label: 'Custom Domains', included: false },
      { label: 'Priority Support', included: false },
    ],
    cta: 'Start Basic',
  },
  {
    name: 'Developer',
    price: '$49/mo',
    description: 'For teams shipping production agents.',
    highlighted: true,
    features: [
      { label: '10 Projects', included: true },
      { label: '15 Team Members', included: true },
      { label: '100 Endpoints', included: true },
      { label: '1,000 Threads', included: true },
      { label: '10,000 Messages', included: true },
      { label: 'Priority Support', included: true },
      { label: 'Custom Domains', included: true },
      { label: 'Advanced Analytics', included: false },
    ],
    cta: 'Start Developer',
  },
  {
    name: 'Pro',
    price: '$149/mo',
    description: 'For organizations at scale.',
    features: [
      { label: 'Unlimited Projects', included: true },
      { label: 'Unlimited Members', included: true },
      { label: 'Unlimited Endpoints', included: true },
      { label: 'Unlimited Threads', included: true },
      { label: 'Unlimited Messages', included: true },
      { label: 'Dedicated Support', included: true },
      { label: 'Custom Domains', included: true },
      { label: 'Advanced Analytics', included: true },
    ],
    cta: 'Start Pro',
  },
]
