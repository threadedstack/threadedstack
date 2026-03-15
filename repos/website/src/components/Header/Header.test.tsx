import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { MemoryRouter } from 'react-router'

const mockAdminUrl = `http://localhost:5887`
vi.mock(`@TAF/constants/envs`, () => ({
  TDSK_AD_APP_URL: `http://localhost:5887`,
}))

vi.mock(`@TAF/hooks/useScrollPosition`, () => ({
  useScrollPosition: () => false,
}))

vi.mock(`./ThemeToggle`, () => ({
  default: () => <div data-testid='theme-toggle' />,
}))

import Header from './Header'

const theme = createTheme()
const renderHeader = (route = `/`) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider theme={theme}>
        <Header />
      </ThemeProvider>
    </MemoryRouter>
  )

describe(`Header`, () => {
  it(`renders Get Started button linking to admin app`, () => {
    renderHeader()
    const button = screen.getByRole(`link`, { name: /^get started$/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute(`href`, mockAdminUrl)
  })

  it(`does not link Get Started to docs/getting-started`, () => {
    renderHeader()
    const button = screen.getByRole(`link`, { name: /^get started$/i })
    expect(button).not.toHaveAttribute(`href`, `/docs/getting-started`)
  })

  it(`renders nav items for Features, Pricing, and Docs`, () => {
    renderHeader()
    expect(screen.getByRole(`link`, { name: /features/i })).toBeInTheDocument()
    expect(screen.getByRole(`link`, { name: /pricing/i })).toBeInTheDocument()
    expect(screen.getByRole(`link`, { name: /docs/i })).toBeInTheDocument()
  })
})
