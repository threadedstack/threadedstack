// biome-ignore-all lint: is a test file

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock(`@tdsk/components`, () => ({
  SwitchInput: ({ id, label, checked, disabled, onChange }: any) => (
    <div
      data-testid={id}
      data-label={label}
      data-checked={checked}
    >
      <input
        id={id}
        type='checkbox'
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e, e.target.checked)}
      />
    </div>
  ),
  SelectInput: ({ id, label, value, items, disabled, helperText, onChange }: any) => (
    <div
      data-testid={id}
      data-label={label}
      data-value={value}
      data-helper={helperText}
    >
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.({ target: { value: e.target.value } })}
      >
        {items?.map((item: any) => (
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

vi.mock(`@TAF/components/FormSection/FormSection`, () => ({
  FormSection: ({ title, children }: any) => (
    <div data-testid='form-section'>
      <div data-testid='form-section-title'>{title}</div>
      {children}
    </div>
  ),
}))

import { AgentSettingsForm } from './AgentSettingsForm'

describe(`AgentSettingsForm`, () => {
  const defaultProps = {
    active: true,
    loading: false,
    streaming: true,
    autonomous: false,
    onActiveChange: vi.fn(),
    onStreamingChange: vi.fn(),
    onAutonomousChange: vi.fn(),
    onBrainChange: vi.fn(),
  }

  it(`should render the brain selector with default value api`, () => {
    render(<AgentSettingsForm {...defaultProps} />)
    const selector = screen.getByTestId(`agent-brain`)
    expect(selector.getAttribute(`data-label`)).toBe(`Brain`)
    expect(selector.getAttribute(`data-value`)).toBe(`api`)
  })

  it(`should render both brain options`, () => {
    render(<AgentSettingsForm {...defaultProps} />)
    expect(screen.getByText(`API (built-in runner)`)).toBeTruthy()
    expect(screen.getByText(`Sandbox runtime (CLI tool)`)).toBeTruthy()
  })

  it(`should call onBrainChange when a new brain is selected`, () => {
    const onBrainChange = vi.fn()
    render(
      <AgentSettingsForm
        {...defaultProps}
        onBrainChange={onBrainChange}
      />
    )

    fireEvent.change(screen.getByTestId(`agent-brain`).querySelector(`select`)!, {
      target: { value: `runtime` },
    })
    expect(onBrainChange).toHaveBeenCalledWith(`runtime`)
  })

  it(`should show the api helper text by default`, () => {
    render(<AgentSettingsForm {...defaultProps} />)
    expect(screen.getByTestId(`agent-brain`).getAttribute(`data-helper`)).toBe(
      `Calls LLM provider APIs directly via the built-in runner.`
    )
  })

  it(`should show the runtime helper text when brain is runtime`, () => {
    render(
      <AgentSettingsForm
        {...defaultProps}
        brain={`runtime` as any}
      />
    )
    expect(screen.getByTestId(`agent-brain`).getAttribute(`data-helper`)).toBe(
      `Runs the body sandbox's AI tool; requires a sandbox in Environment and credentials via the sandbox's providers.`
    )
  })

  it(`should hide the brain selector when onBrainChange is not provided`, () => {
    render(
      <AgentSettingsForm
        {...defaultProps}
        onBrainChange={undefined}
      />
    )
    expect(screen.queryByTestId(`agent-brain`)).toBeNull()
  })

  it(`should hide the autonomous toggle when onAutonomousChange is not provided`, () => {
    render(
      <AgentSettingsForm
        {...defaultProps}
        onAutonomousChange={undefined}
      />
    )
    expect(screen.queryByTestId(`agent-autonomous`)).toBeNull()
  })
})
