import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@mui/material/styles'

let mockUsage: any
let mockLimits: any

vi.mock('@TAF/state/selectors', () => ({
  useOrgQuota: () => [mockUsage, vi.fn(), vi.fn()],
  useOrgLimits: () => [mockLimits, vi.fn(), vi.fn()],
}))

import { QuotaUsage } from './QuotaUsage'

const theme = createTheme()
const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)
const renderWithTheme = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper })

describe('QuotaUsage', () => {
  beforeEach(() => {
    mockUsage = undefined
    mockLimits = undefined
  })

  it('renders the "no quota data available" alert when usage or limits are missing', () => {
    renderWithTheme(<QuotaUsage orgId='org_1' />)
    expect(screen.getByText(/no quota data available/i)).toBeDefined()
  })

  it('renders a Sandbox Sessions card with the live count and plan limit', () => {
    mockUsage = {
      orgId: 'org_1',
      period: '2026-07',
      projects: 1,
      compute: 0,
      threads: 0,
      messages: 0,
      endpoints: 0,
      secrets: 0,
      sandboxSessions: 4,
    }
    mockLimits = {
      organizations: 1,
      projects: 10,
      compute: 1000,
      threads: 100,
      messages: 1000,
      endpoints: 10,
      secrets: 10,
      retention: 30,
      seats: 5,
      additionalSeats: false,
      sandboxSessions: 25,
    }

    renderWithTheme(<QuotaUsage orgId='org_1' />)

    expect(screen.getByText('Sandbox Sessions')).toBeDefined()
    expect(screen.getByText('4 / 25')).toBeDefined()
  })

  it('renders "Unlimited" for an unlimited sandbox session limit without crashing the progress bar', () => {
    mockUsage = {
      orgId: 'org_1',
      period: '2026-07',
      projects: 1,
      compute: 0,
      threads: 0,
      messages: 0,
      endpoints: 0,
      secrets: 0,
      sandboxSessions: 2,
    }
    mockLimits = {
      organizations: 1,
      projects: 10,
      compute: 1000,
      threads: 100,
      messages: 1000,
      endpoints: 10,
      secrets: 10,
      retention: 30,
      seats: 5,
      additionalSeats: false,
      sandboxSessions: -1,
    }

    expect(() => renderWithTheme(<QuotaUsage orgId='org_1' />)).not.toThrow()
    expect(screen.getByText('2 / Unlimited')).toBeDefined()
  })

  it('defaults sandboxSessions to 0 when absent from usage/limits data', () => {
    mockUsage = {
      orgId: 'org_1',
      period: '2026-07',
      projects: 1,
      compute: 0,
      threads: 0,
      messages: 0,
      endpoints: 0,
      secrets: 0,
    }
    mockLimits = {
      organizations: 1,
      projects: 10,
      compute: 1000,
      threads: 100,
      messages: 1000,
      endpoints: 10,
      secrets: 10,
      retention: 30,
      seats: 5,
      additionalSeats: false,
    }

    renderWithTheme(<QuotaUsage orgId='org_1' />)

    expect(screen.getByText('0 / 0')).toBeDefined()
  })
})
