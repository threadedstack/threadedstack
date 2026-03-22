import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { MemoryRouter } from 'react-router'

const mockAdminUrl = `http://localhost:5887`
vi.mock(`@TAF/constants/envs`, () => ({
  TDSK_AD_APP_URL: `http://localhost:5887`,
}))

import MobileMenu from './MobileMenu'

const theme = createTheme()
const navItems = [
  { label: `Features`, path: `/features` },
  { label: `Pricing`, path: `/pricing` },
  { label: `Docs`, path: `/docs` },
]

const renderMenu = (open = true) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <MobileMenu
          open={open}
          onClose={vi.fn()}
          navItems={navItems}
        />
      </ThemeProvider>
    </MemoryRouter>
  )

describe(`MobileMenu`, () => {
  it(`renders Get Started button linking to admin app`, () => {
    renderMenu()
    const button = screen.getByRole(`link`, { name: /get started/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute(`href`, mockAdminUrl)
  })

  it(`does not link Get Started to docs/getting-started`, () => {
    renderMenu()
    const button = screen.getByRole(`link`, { name: /get started/i })
    expect(button).not.toHaveAttribute(`href`, `/docs/getting-started`)
  })

  it(`renders nav items when open`, () => {
    renderMenu()
    expect(screen.getByText(`Features`)).toBeInTheDocument()
    expect(screen.getByText(`Pricing`)).toBeInTheDocument()
    expect(screen.getByText(`Docs`)).toBeInTheDocument()
  })
})
