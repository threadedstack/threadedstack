import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { ESubscriptionTier } from '@tdsk/domain'

let mockPlans: any
let mockSubscription: any

vi.mock('@TAF/state/selectors', () => ({
  usePaymentPlans: () => [mockPlans, vi.fn(), vi.fn()],
  useSubscription: () => [mockSubscription, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/actions', () => ({
  cancelSubscription: vi.fn(),
  createPortalSession: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { CurrentPlan } from './CurrentPlan'

const theme = createTheme()
const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)
const renderWithTheme = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper })

describe('CurrentPlan', () => {
  beforeEach(() => {
    mockPlans = undefined
    mockSubscription = null
  })

  it('renders the "no active subscription" alert when subscription is null', () => {
    mockSubscription = null
    renderWithTheme(<CurrentPlan />)
    expect(screen.getByText(/no active subscription found/i)).toBeDefined()
  })

  it('does not crash when plans is undefined and a subscription exists', () => {
    mockPlans = undefined
    mockSubscription = {
      tier: ESubscriptionTier.solo,
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodStart: '2025-01-01T00:00:00Z',
      currentPeriodEnd: '2025-02-01T00:00:00Z',
    }

    expect(() => renderWithTheme(<CurrentPlan />)).not.toThrow()
    expect(screen.getByText(/Solo/i)).toBeDefined()
    expect(screen.getByText(/Manage Subscription/i)).toBeDefined()
  })

  it('handles empty plans array (loaded but no match) without crash', () => {
    mockPlans = []
    mockSubscription = {
      tier: ESubscriptionTier.solo,
      status: 'active',
      cancelAtPeriodEnd: false,
    }

    expect(() => renderWithTheme(<CurrentPlan />)).not.toThrow()
  })
})
