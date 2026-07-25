import type { Plan } from '@tdsk/domain'

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'

const mockAdminUrl = `http://localhost:5887`
vi.mock(`@TAF/constants/envs`, () => ({
  TDSK_AD_APP_URL: `http://localhost:5887`,
}))

import PricingTierGrid from './PricingTierGrid'

const theme = createTheme()
const renderGrid = (plans: Plan[] = []) =>
  render(
    <ThemeProvider theme={theme}>
      <PricingTierGrid plans={plans} />
    </ThemeProvider>
  )

describe(`PricingTierGrid`, () => {
  it(`renders an Enterprise card with a mailto Contact Sales CTA`, () => {
    renderGrid([])

    expect(screen.getByText(`Enterprise`)).toBeInTheDocument()
    const link = screen.getByRole(`link`, { name: `Contact Sales` })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute(`href`, `mailto:enterprise@threadedstack.com`)
  })

  it(`does not change the CTA href of the other tiers`, () => {
    const plan = {
      id: `free`,
      name: `Free`,
      price: 0,
      seatPrice: 0,
      limits: {
        organizations: 1,
        projects: 2,
        compute: 100,
        threads: 10,
        messages: 100,
        endpoints: 5,
        secrets: 5,
        retention: 7,
        seats: 1,
        additionalSeats: false,
        sandboxSessions: 1,
      },
    } as Plan

    renderGrid([plan])

    const freeLink = screen.getByRole(`link`, { name: `Get Started Free` })
    expect(freeLink).toHaveAttribute(`href`, mockAdminUrl)

    const enterpriseLink = screen.getByRole(`link`, { name: `Contact Sales` })
    expect(enterpriseLink).toHaveAttribute(`href`, `mailto:enterprise@threadedstack.com`)
  })
})
