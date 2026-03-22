import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { MemoryRouter } from 'react-router'

const mockAdminUrl = `http://localhost:5887`
vi.mock(`@TAF/constants/envs`, () => ({
  TDSK_AD_APP_URL: `http://localhost:5887`,
}))

import CTABanner from './CTABanner'

const theme = createTheme()
const renderBanner = () =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <CTABanner />
      </ThemeProvider>
    </MemoryRouter>
  )

describe(`CTABanner`, () => {
  it(`renders Get Started Free button linking to admin app`, () => {
    renderBanner()
    const button = screen.getByRole(`link`, { name: /get started free/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute(`href`, mockAdminUrl)
  })

  it(`does not link Get Started to docs/getting-started`, () => {
    renderBanner()
    const button = screen.getByRole(`link`, { name: /get started free/i })
    expect(button).not.toHaveAttribute(`href`, `/docs/getting-started`)
  })

  it(`renders Read the Docs button linking to /docs`, () => {
    renderBanner()
    const docsButton = screen.getByRole(`link`, { name: /read the docs/i })
    expect(docsButton).toBeInTheDocument()
    expect(docsButton).toHaveAttribute(`href`, `/docs`)
  })
})
