import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EntitySelector, EntitySelectorSingle } from './EntitySelector'
import type { TEntitySelectorOption } from './EntitySelector'

vi.mock(`@keg-hub/jsutils/cls`, () => ({
  cls: (...args: any[]) => args.filter(Boolean).join(` `),
}))

vi.mock(`@tdsk/components`, () => ({
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  AutoInputText: ({ inputProps, InputProps, InputLabelProps, ...props }: any) => (
    <div
      data-testid='auto-input'
      ref={InputProps?.ref}
    >
      <input
        {...props}
        {...(inputProps || {})}
      />
      {InputProps?.endAdornment}
    </div>
  ),
  InputStateHandler: ({ children, label, description, disabled }: any) => (
    <div
      data-testid='input-state-handler'
      data-label={label}
      data-description={description}
      data-disabled={disabled}
    >
      {children}
    </div>
  ),
}))

const mockOptions: TEntitySelectorOption[] = [
  { id: `opt-1`, label: `Option One`, secondary: `First option` },
  { id: `opt-2`, label: `Option Two`, secondary: `Second option` },
  { id: `opt-3`, label: `Option Three` },
]

describe(`EntitySelector`, () => {
  const defaultProps = {
    id: `test-selector`,
    label: `Test Label`,
    value: [] as string[],
    options: mockOptions,
    onChange: vi.fn(),
  }

  it(`should render with title when provided`, () => {
    render(
      <EntitySelector
        {...defaultProps}
        title='Test Title'
      />
    )
    expect(screen.getByText(`Test Title`)).toBeTruthy()
  })

  it(`should not render title when not provided`, () => {
    render(<EntitySelector {...defaultProps} />)
    expect(screen.queryByText(`Test Title`)).toBeNull()
  })

  it(`should pass label and description to InputStateHandler`, () => {
    render(
      <EntitySelector
        {...defaultProps}
        description='Some description'
      />
    )
    const handler = screen.getByTestId(`input-state-handler`)
    expect(handler.getAttribute(`data-label`)).toBe(`Test Label`)
    expect(handler.getAttribute(`data-description`)).toBe(`Some description`)
  })

  it(`should disable when loading is true`, () => {
    render(
      <EntitySelector
        {...defaultProps}
        loading={true}
      />
    )
    const handler = screen.getByTestId(`input-state-handler`)
    expect(handler.getAttribute(`data-disabled`)).toBe(`true`)
  })

  it(`should disable when disabled prop is true`, () => {
    render(
      <EntitySelector
        {...defaultProps}
        disabled={true}
      />
    )
    const handler = screen.getByTestId(`input-state-handler`)
    expect(handler.getAttribute(`data-disabled`)).toBe(`true`)
  })

  it(`should render the autocomplete input with placeholder`, () => {
    render(
      <EntitySelector
        {...defaultProps}
        placeholder='Pick one...'
      />
    )
    expect(screen.getByTestId(`auto-input`)).toBeTruthy()
  })

  it(`should call onChange when selection changes`, async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <EntitySelector
        {...defaultProps}
        onChange={onChange}
      />
    )

    const input = screen.getByRole(`combobox`)
    await user.click(input)
    const option = await screen.findByText(`Option One`)
    await user.click(option)
    expect(onChange).toHaveBeenCalled()
  })
})

describe(`EntitySelectorSingle`, () => {
  const defaultProps = {
    id: `single-selector`,
    label: `Single Label`,
    value: null as string | null,
    options: mockOptions,
    onChange: vi.fn(),
  }

  it(`should render without errors`, () => {
    render(<EntitySelectorSingle {...defaultProps} />)
    expect(screen.getByTestId(`input-state-handler`)).toBeTruthy()
  })

  it(`should render with a selected value`, () => {
    render(
      <EntitySelectorSingle
        {...defaultProps}
        value='opt-1'
      />
    )
    expect(screen.getByTestId(`input-state-handler`)).toBeTruthy()
  })
})
