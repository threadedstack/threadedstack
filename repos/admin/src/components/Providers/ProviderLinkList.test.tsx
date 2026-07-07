import type { ReactNode } from 'react'
import type { TProviderLinkItem } from '@TAF/types'

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { createTheme, ThemeProvider } from '@mui/material/styles'

vi.mock(`@tdsk/components`, () => ({
  TextInput: ({ label, id, value, onChange }: any) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        onChange={onChange}
      />
    </div>
  ),
  SelectInput: ({ label, id, value, items, onChange, placeholder }: any) => (
    <div>
      <label htmlFor={id}>{label || placeholder}</label>
      <select
        id={id}
        value={value}
        onChange={onChange}
      >
        <option value=''>--</option>
        {items?.map?.((item: any) => (
          <option
            key={item.value}
            value={item.value}
          >
            {item.label}
          </option>
        ))}
      </select>
    </div>
  ),
}))

vi.mock(`@TAF/components/Agents/ModelSelect`, () => ({
  ModelSelect: ({ id, brand }: any) => (
    <div data-testid={`model-select-${id || brand}`} />
  ),
}))

import { ProviderLinkList } from './ProviderLinkList'

const theme = createTheme()
const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)
const renderWithTheme = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper })

const provider = (overrides: Partial<TProviderLinkItem> = {}): TProviderLinkItem => ({
  id: `prov-1`,
  name: `My Provider`,
  brand: `openai`,
  secretId: `secret-1`,
  ...overrides,
})

describe(`ProviderLinkList`, () => {
  it(`does not show a secret warning when warnMissingSecret is false`, () => {
    renderWithTheme(
      <ProviderLinkList
        orgId='org-1'
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        providers={[provider({ secretId: null })]}
        availableProviders={[]}
      />
    )

    expect(screen.queryByTestId(`WarningIcon`)).not.toBeInTheDocument()
  })

  it(`does not show a secret warning when the provider already has a secret`, () => {
    renderWithTheme(
      <ProviderLinkList
        orgId='org-1'
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        warnMissingSecret
        providers={[provider({ secretId: `secret-1` })]}
        availableProviders={[]}
      />
    )

    expect(screen.queryByTestId(`WarningIcon`)).not.toBeInTheDocument()
  })

  it(`shows a secret warning when warnMissingSecret is true and the provider has no secretId`, () => {
    renderWithTheme(
      <ProviderLinkList
        orgId='org-1'
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        warnMissingSecret
        providers={[provider({ secretId: null })]}
        availableProviders={[]}
      />
    )

    expect(screen.getByTestId(`WarningIcon`)).toBeInTheDocument()
  })

  it(`calls onFixSecret with the provider id when the warning is clicked`, async () => {
    const onFixSecret = vi.fn()
    const user = userEvent.setup()

    renderWithTheme(
      <ProviderLinkList
        orgId='org-1'
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        warnMissingSecret
        onFixSecret={onFixSecret}
        providers={[provider({ id: `prov-2`, secretId: undefined })]}
        availableProviders={[]}
      />
    )

    await user.click(screen.getByTestId(`WarningIcon`))

    expect(onFixSecret).toHaveBeenCalledWith(`prov-2`)
  })
})
