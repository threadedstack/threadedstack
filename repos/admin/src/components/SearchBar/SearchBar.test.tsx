import type { ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { createTheme, ThemeProvider } from '@mui/material/styles'

vi.mock(`@tdsk/components`, () => ({
  TextInput: (props: any) => {
    const {
      id,
      value,
      disabled,
      placeholder,
      onChange,
      onBlur,
      startAdornment,
      endAdornment,
      ...rest
    } = props
    return (
      <div data-testid={id}>
        {startAdornment}
        <input
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={onChange}
          onBlur={onBlur}
        />
        {endAdornment}
      </div>
    )
  },
}))

import { SearchBar } from './SearchBar'

const theme = createTheme()
const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)

const renderWithTheme = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper })

describe(`SearchBar`, () => {
  it(`renders with correct placeholder`, () => {
    renderWithTheme(
      <SearchBar
        value=''
        onChange={vi.fn()}
        placeholder='Find something...'
      />
    )
    expect(screen.getByPlaceholderText(`Find something...`)).toBeInTheDocument()
  })

  it(`renders with default placeholder when none provided`, () => {
    renderWithTheme(
      <SearchBar
        value=''
        onChange={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText(`Search...`)).toBeInTheDocument()
  })

  it(`calls onChange when input value changes`, async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    renderWithTheme(
      <SearchBar
        value=''
        onChange={onChange}
      />
    )

    const input = screen.getByPlaceholderText(`Search...`)
    await user.type(input, `hello`)

    expect(onChange).toHaveBeenCalledTimes(5)
    expect(onChange).toHaveBeenCalledWith(`h`)
  })

  it(`shows clear button when value is non-empty`, () => {
    renderWithTheme(
      <SearchBar
        value='some text'
        onChange={vi.fn()}
      />
    )
    expect(screen.getByLabelText(`Clear search`)).toBeInTheDocument()
  })

  it(`does not show clear button when value is empty`, () => {
    renderWithTheme(
      <SearchBar
        value=''
        onChange={vi.fn()}
      />
    )
    expect(screen.queryByLabelText(`Clear search`)).not.toBeInTheDocument()
  })

  it(`calls onChange with empty string when clear button is clicked`, async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    renderWithTheme(
      <SearchBar
        value='some text'
        onChange={onChange}
      />
    )

    const clearButton = screen.getByLabelText(`Clear search`)
    await user.click(clearButton)

    expect(onChange).toHaveBeenCalledWith(``)
  })

  it(`renders the search icon`, () => {
    renderWithTheme(
      <SearchBar
        value=''
        onChange={vi.fn()}
      />
    )
    expect(screen.getByTestId(`SearchIcon`)).toBeInTheDocument()
  })
})
