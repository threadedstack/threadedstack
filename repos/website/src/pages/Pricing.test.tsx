import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { MemoryRouter } from 'react-router'
import { HelmetProvider } from 'react-helmet-async'

vi.mock(`@TAF/constants/envs`, () => ({
  TDSK_AD_APP_URL: `http://localhost:5887`,
}))

vi.mock(`react-router`, async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return {
    ...actual,
    useRouteLoaderData: () => [],
  }
})

import Pricing from './Pricing'

const theme = createTheme()
const renderPricing = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <Pricing />
        </ThemeProvider>
      </MemoryRouter>
    </HelmetProvider>
  )

describe(`Pricing`, () => {
  it(`renders the enterprise contact email as a clickable mailto link`, async () => {
    renderPricing()
    const user = userEvent.setup()

    await user.click(screen.getByText(`Do you offer custom enterprise plans?`))

    const link = screen.getByRole(`link`, { name: `enterprise@threadedstack.com` })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute(`href`, `mailto:enterprise@threadedstack.com`)
  })

  it(`renders every other FAQ answer as plain text, not a link`, async () => {
    renderPricing()
    const user = userEvent.setup()

    await user.click(screen.getByText(`Can I switch plans at any time?`))

    expect(
      screen.getByText(/You can upgrade or downgrade your plan at any time/)
    ).toBeInTheDocument()
    expect(
      screen.queryAllByRole(`link`, { name: `enterprise@threadedstack.com` })
    ).toHaveLength(0)
  })
})
