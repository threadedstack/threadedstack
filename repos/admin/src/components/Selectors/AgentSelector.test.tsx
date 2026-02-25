import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentSelector } from './AgentSelector'

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

const mockAgents = [
  { id: `agent-1`, name: `Support Bot` },
  { id: `agent-2`, name: `Research Agent` },
  { id: `agent-3`, name: `Code Helper` },
]

describe(`AgentSelector`, () => {
  const defaultProps = {
    agentId: ``,
    agents: mockAgents,
    onChange: vi.fn(),
  }

  it(`should render the selector`, () => {
    render(<AgentSelector {...defaultProps} />)
    expect(screen.getByTestId(`input-state-handler`)).toBeTruthy()
    expect(screen.getByTestId(`input-state-handler`).getAttribute(`data-label`)).toBe(
      `Agent`
    )
  })

  it(`should show description for selecting agents`, () => {
    render(<AgentSelector {...defaultProps} />)
    expect(
      screen.getByTestId(`input-state-handler`).getAttribute(`data-description`)
    ).toBe(`Select the AI agent to handle requests`)
  })

  it(`should show empty state when no agents available`, () => {
    render(
      <AgentSelector
        {...defaultProps}
        agents={[]}
      />
    )
    expect(
      screen.getByTestId(`input-state-handler`).getAttribute(`data-description`)
    ).toBe(`No agents available. Create an agent first.`)
  })

  it(`should show loading description when loading`, () => {
    render(
      <AgentSelector
        {...defaultProps}
        loading={true}
      />
    )
    expect(
      screen.getByTestId(`input-state-handler`).getAttribute(`data-description`)
    ).toBe(`Loading agents...`)
  })

  it(`should call onChange when an agent is selected`, async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <AgentSelector
        {...defaultProps}
        onChange={onChange}
      />
    )

    const input = screen.getByRole(`combobox`)
    await user.click(input)
    const option = await screen.findByText(`Support Bot`)
    await user.click(option)
    expect(onChange).toHaveBeenCalledWith(`agent-1`)
  })

  it(`should call onChange with empty string when cleared`, async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <AgentSelector
        {...defaultProps}
        agentId='agent-1'
        onChange={onChange}
      />
    )

    const clearBtn = screen.getByTitle(`Clear`)
    await user.click(clearBtn)
    expect(onChange).toHaveBeenCalledWith(``)
  })
})
