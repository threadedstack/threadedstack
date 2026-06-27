import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@mui/material/styles'

let mockPlans: any
let mockSubscription: any
let mockInvoices: any

vi.mock('@TAF/state/selectors', () => ({
  usePaymentPlans: () => [mockPlans, vi.fn(), vi.fn()],
  useSubscription: () => [mockSubscription, vi.fn(), vi.fn()],
  useInvoices: () => [mockInvoices, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/state/accessors', () => ({
  resetInvoices: vi.fn(),
  resetSubscription: vi.fn(),
  resetPaymentPlans: vi.fn(),
}))

vi.mock('@TAF/actions', () => ({
  createCheckoutSession: vi.fn(),
}))

vi.mock('react-router', () => ({
  useRevalidator: () => ({ revalidate: vi.fn(), state: 'idle' }),
}))

vi.mock('@TAF/pages/Page/Page', () => ({
  Page: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

vi.mock('@TAF/components/Billing', () => ({
  CurrentPlan: () => <div data-testid='current-plan' />,
  PlanCard: ({ plan }: any) => <div data-testid={`plan-${plan.id}`}>{plan.name}</div>,
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import { Billing } from './Billing'

const theme = createTheme()
const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)
const renderWithTheme = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper })

const clickTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }))

describe('Billing', () => {
  beforeEach(() => {
    mockPlans = undefined
    mockSubscription = null
    mockInvoices = undefined
  })

  it('does not crash when plans, subscription, and invoices are all undefined/null', () => {
    expect(() => renderWithTheme(<Billing />)).not.toThrow()
  })

  it('renders all three tabs unconditionally (no loading-gate)', () => {
    renderWithTheme(<Billing />)
    expect(screen.getByRole('tab', { name: /current plan/i })).toBeDefined()
    expect(screen.getByRole('tab', { name: /upgrade plan/i })).toBeDefined()
    expect(screen.getByRole('tab', { name: /payment history/i })).toBeDefined()
  })

  it('shows "No plans available" alert on Upgrade tab when plans is undefined', () => {
    mockPlans = undefined
    renderWithTheme(<Billing />)
    clickTab(/upgrade plan/i)
    expect(screen.getByText(/no plans available at this time/i)).toBeDefined()
  })

  it('shows "No plans available" alert on Upgrade tab when plans is [] (fetched-empty)', () => {
    mockPlans = []
    renderWithTheme(<Billing />)
    clickTab(/upgrade plan/i)
    expect(screen.getByText(/no plans available at this time/i)).toBeDefined()
  })

  it('renders a PlanCard for each plan when plans are loaded', () => {
    mockPlans = [
      { id: 'p1', name: 'Solo', price: 1900, limits: {} },
      { id: 'p2', name: 'Pro', price: 4900, limits: {} },
    ]
    renderWithTheme(<Billing />)
    clickTab(/upgrade plan/i)
    expect(screen.getByTestId('plan-p1')).toBeDefined()
    expect(screen.getByTestId('plan-p2')).toBeDefined()
  })

  it('shows "No payment history available" on History tab when invoices is undefined', () => {
    mockInvoices = undefined
    renderWithTheme(<Billing />)
    clickTab(/payment history/i)
    expect(screen.getByText(/no payment history available/i)).toBeDefined()
  })

  it('shows "No payment history available" on History tab when invoices is []', () => {
    mockInvoices = []
    renderWithTheme(<Billing />)
    clickTab(/payment history/i)
    expect(screen.getByText(/no payment history available/i)).toBeDefined()
  })
})
