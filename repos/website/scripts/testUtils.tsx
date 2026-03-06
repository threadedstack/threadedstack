import type { ReactElement, ReactNode } from 'react'
import { makeTheme } from '@tdsk/components'
import { ThemeProvider } from '@mui/material/styles'
import type { RenderOptions } from '@testing-library/react'
import { render } from '@testing-library/react'

type TAllProviders = {
  children: ReactNode
}

/**
 * Creates a wrapper component with MUI ThemeProvider
 * Uses makeTheme from @tdsk/components to create the theme
 */
const AllProviders = ({ children }: TAllProviders) => {
  const theme = makeTheme('light')
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>
}

/**
 * Custom render function that wraps components with ThemeProvider
 * Use this instead of @testing-library/react's render for components
 * that require MUI theme context
 */
export const renderWithTheme = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options })
