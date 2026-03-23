import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock(`@tdsk/components`, async () => {
  const actual = await vi.importActual(`@tdsk/components`)
  return {
    ...(actual as any),
    TextInput: ({
      label,
      value,
      onChange,
      id,
      type,
      disabled,
      required,
      autoComplete,
      ...props
    }: any) => (
      <div>
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
        />
      </div>
    ),
  }
})

import { EmailLoginForm } from './EmailLoginForm'

const mockOnSignIn = vi.fn().mockResolvedValue(undefined)
const mockOnSignUp = vi.fn().mockResolvedValue(undefined)
const mockOnForgotPassword = vi.fn().mockResolvedValue(undefined)

describe(`EmailLoginForm`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`renders email and password fields`, () => {
    render(
      <EmailLoginForm
        onSignIn={mockOnSignIn}
        onSignUp={mockOnSignUp}
      />
    )

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it(`calls onSignIn with email and password on submit in sign-in mode`, async () => {
    const user = userEvent.setup()

    render(
      <EmailLoginForm
        onSignIn={mockOnSignIn}
        onSignUp={mockOnSignUp}
      />
    )

    await user.type(screen.getByLabelText(/email/i), `test@example.com`)
    await user.type(screen.getByLabelText(/password/i), `secret123`)
    await user.click(screen.getByRole(`button`, { name: /sign in/i }))

    expect(mockOnSignIn).toHaveBeenCalledWith(`test@example.com`, `secret123`)
    expect(mockOnSignUp).not.toHaveBeenCalled()
  })

  it(`toggles to sign-up mode and calls onSignUp`, async () => {
    const user = userEvent.setup()

    render(
      <EmailLoginForm
        onSignIn={mockOnSignIn}
        onSignUp={mockOnSignUp}
      />
    )

    await user.click(screen.getByRole(`button`, { name: /create account/i }))

    expect(screen.getByRole(`button`, { name: /sign up/i })).toBeInTheDocument()

    await user.type(screen.getByLabelText(/email/i), `new@example.com`)
    await user.type(screen.getByLabelText(/password/i), `newpass456`)
    await user.click(screen.getByRole(`button`, { name: /sign up/i }))

    expect(mockOnSignUp).toHaveBeenCalledWith(`new@example.com`, `newpass456`)
    expect(mockOnSignIn).not.toHaveBeenCalled()
  })

  it(`shows error message when error prop is set`, () => {
    render(
      <EmailLoginForm
        onSignIn={mockOnSignIn}
        onSignUp={mockOnSignUp}
        error='Invalid credentials'
      />
    )

    expect(screen.getByText(`Invalid credentials`)).toBeInTheDocument()
    expect(screen.getByRole(`alert`)).toBeInTheDocument()
  })

  it(`disables submit button when loading is true`, () => {
    render(
      <EmailLoginForm
        onSignIn={mockOnSignIn}
        onSignUp={mockOnSignUp}
        loading={true}
      />
    )

    const submitButton = screen.getByRole(`button`, { name: /sign in/i })
    expect(submitButton).toBeDisabled()
  })

  it(`shows Sign In button by default and Sign Up after toggle`, async () => {
    const user = userEvent.setup()

    render(
      <EmailLoginForm
        onSignIn={mockOnSignIn}
        onSignUp={mockOnSignUp}
      />
    )

    expect(screen.getByRole(`button`, { name: /sign in/i })).toBeInTheDocument()

    await user.click(screen.getByRole(`button`, { name: /create account/i }))

    expect(screen.getByRole(`button`, { name: /sign up/i })).toBeInTheDocument()
    expect(screen.getByRole(`button`, { name: /sign in$/i })).toBeInTheDocument()
  })

  it(`does not show error alert when error prop is not set`, () => {
    render(
      <EmailLoginForm
        onSignIn={mockOnSignIn}
        onSignUp={mockOnSignUp}
      />
    )

    expect(screen.queryByRole(`alert`)).not.toBeInTheDocument()
  })

  it(`shows forgot password link when onForgotPassword is provided`, () => {
    render(
      <EmailLoginForm
        onSignIn={mockOnSignIn}
        onSignUp={mockOnSignUp}
        onForgotPassword={mockOnForgotPassword}
      />
    )

    expect(screen.getByRole(`button`, { name: /forgot password/i })).toBeInTheDocument()
  })

  it(`does not show forgot password link when onForgotPassword is not provided`, () => {
    render(
      <EmailLoginForm
        onSignIn={mockOnSignIn}
        onSignUp={mockOnSignUp}
      />
    )

    expect(
      screen.queryByRole(`button`, { name: /forgot password/i })
    ).not.toBeInTheDocument()
  })

  it(`calls onForgotPassword with current email value`, async () => {
    const user = userEvent.setup()

    render(
      <EmailLoginForm
        onSignIn={mockOnSignIn}
        onSignUp={mockOnSignUp}
        onForgotPassword={mockOnForgotPassword}
      />
    )

    await user.type(screen.getByLabelText(/email/i), `forgot@example.com`)
    await user.click(screen.getByRole(`button`, { name: /forgot password/i }))

    expect(mockOnForgotPassword).toHaveBeenCalledWith(`forgot@example.com`)
  })

  it(`hides forgot password link in sign-up mode`, async () => {
    const user = userEvent.setup()

    render(
      <EmailLoginForm
        onSignIn={mockOnSignIn}
        onSignUp={mockOnSignUp}
        onForgotPassword={mockOnForgotPassword}
      />
    )

    expect(screen.getByRole(`button`, { name: /forgot password/i })).toBeInTheDocument()

    await user.click(screen.getByRole(`button`, { name: /create account/i }))

    expect(
      screen.queryByRole(`button`, { name: /forgot password/i })
    ).not.toBeInTheDocument()
  })
})
