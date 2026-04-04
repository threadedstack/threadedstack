import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'

const mockAdminUrl = `http://localhost:5887`
vi.mock(`@TAF/constants/envs`, () => ({
  TDSK_AD_APP_URL: `http://localhost:5887`,
}))

import PricingCard from './PricingCard'

const theme = createTheme()
const defaultProps = {
  name: `Free`,
  price: `$0/mo`,
  description: `For experimenting and learning.`,
  features: [
    { label: `2 Projects`, included: true },
    { label: `1 Seat`, included: true },
    { label: `Custom Domains`, included: false },
  ],
  cta: `Get Started Free`,
}

const renderCard = (props = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <PricingCard
        {...defaultProps}
        {...props}
      />
    </ThemeProvider>
  )

describe(`PricingCard`, () => {
  it(`renders CTA button linking to admin app`, () => {
    renderCard()
    const button = screen.getByRole(`link`, { name: /get started free/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute(`href`, mockAdminUrl)
  })

  it(`calls onCtaClick when provided`, async () => {
    const onClick = vi.fn()
    renderCard({ onCtaClick: onClick })
    const user = userEvent.setup()
    await user.click(screen.getByRole(`link`, { name: /get started free/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it(`renders tier name, price, and description`, () => {
    renderCard()
    expect(screen.getByText(`Free`)).toBeInTheDocument()
    expect(screen.getByText(`$0/mo`)).toBeInTheDocument()
    expect(screen.getByText(`For experimenting and learning.`)).toBeInTheDocument()
  })

  it(`renders features list`, () => {
    renderCard()
    expect(screen.getByText(`2 Projects`)).toBeInTheDocument()
    expect(screen.getByText(`1 Seat`)).toBeInTheDocument()
    expect(screen.getByText(`Custom Domains`)).toBeInTheDocument()
  })

  it(`shows Popular chip when highlighted`, () => {
    renderCard({ highlighted: true })
    expect(screen.getByText(`Popular`)).toBeInTheDocument()
  })

  it(`renders subtitle when provided`, () => {
    renderCard({ subtitle: `+$10/seat/mo` })
    expect(screen.getByText(`+$10/seat/mo`)).toBeInTheDocument()
  })

  it(`does not render subtitle when not provided`, () => {
    renderCard()
    expect(screen.queryByText(/seat\/mo/)).not.toBeInTheDocument()
  })
})
