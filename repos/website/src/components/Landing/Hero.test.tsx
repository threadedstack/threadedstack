import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'

const mockAdminUrl = `http://localhost:5887`
vi.mock(`@TAF/constants/envs`, () => ({
  TDSK_AD_APP_URL: `http://localhost:5887`,
}))

vi.mock(`./ArchitectureDiagram`, () => ({
  default: () => <div data-testid='arch-diagram' />,
}))

import Hero from './Hero'

const theme = createTheme()
const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe(`Hero`, () => {
  it(`renders Get Started Free button linking to admin app`, () => {
    renderWithTheme(<Hero />)
    const button = screen.getByRole(`link`, { name: /get started free/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute(`href`, mockAdminUrl)
  })

  it(`does not link Get Started to docs/getting-started`, () => {
    renderWithTheme(<Hero />)
    const button = screen.getByRole(`link`, { name: /get started free/i })
    expect(button).not.toHaveAttribute(`href`, `/docs/getting-started`)
  })

  it(`renders Request a Demo button with mailto link`, () => {
    renderWithTheme(<Hero />)
    const demo = screen.getByRole(`link`, { name: /request a demo/i })
    expect(demo).toHaveAttribute(`href`, `mailto:demo@threadedstack.app`)
  })
})
