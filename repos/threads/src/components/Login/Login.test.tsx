import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock(`@TTH/components/Login/GithubBtn`, () => ({
  GhButton: (props: any) => (
    <button
      data-testid='gh-btn'
      onClick={() => props.onLogin({ provider: `github` })}
      disabled={props.disabled}
    >
      GitHub
    </button>
  ),
}))
vi.mock(`@TTH/components/Login/GoogleBtn`, () => ({
  GgButton: (props: any) => (
    <button
      data-testid='gg-btn'
      onClick={() => props.onLogin({ provider: `google` })}
      disabled={props.disabled}
    >
      Google
    </button>
  ),
}))
vi.mock(`@TTH/components/Login/VercelBtn`, () => ({
  VrButton: (props: any) => (
    <button
      data-testid='vr-btn'
      onClick={() => props.onLogin({ provider: `vercel` })}
      disabled={props.disabled}
    >
      Vercel
    </button>
  ),
}))
vi.mock(`@TTH/components/Login/EmailLoginForm`, () => ({
  EmailLoginForm: (props: any) => (
    <div
      data-testid='email-form'
      data-error={props.error}
      data-loading={props.loading}
    />
  ),
}))
vi.mock(`@TTH/components/Login/Login.styles`, () => ({
  ErrorText: ({ children, ...p }: any) => <span {...p}>{children}</span>,
  BtnSection: ({ children }: any) => <div>{children}</div>,
  BrandBlob1: () => <div />,
  BrandBlob2: () => <div />,
  BrandGlow: () => <div />,
  BrandLogo: () => <div />,
  BrandHeadline: ({ children }: any) => <span>{children}</span>,
  BrandSubtitle: ({ children }: any) => <span>{children}</span>,
  LoginStack: ({ children }: any) => <div>{children}</div>,
  ErrorTitle: ({ children }: any) => <span>{children}</span>,
  LoginContent: ({ children }: any) => <div>{children}</div>,
  ErrorSection: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  LoginContainer: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  LoginMainContainer: ({ children }: any) => <div>{children}</div>,
}))
vi.mock(`@mui/material/Divider`, () => ({
  default: ({ children }: any) => <hr>{children}</hr>,
}))

import { Login } from './Login'

const mockOnLogin = vi.fn()
const mockOnEmailSignIn = vi.fn().mockResolvedValue(undefined)
const mockOnEmailSignUp = vi.fn().mockResolvedValue(undefined)
const mockOnForgotPassword = vi.fn().mockResolvedValue(undefined)

describe(`Login`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should render Threaded Stack header text`, () => {
    render(
      <Login
        onLogin={mockOnLogin}
        providers={[]}
      />
    )

    expect(screen.getByText(`Threaded Stack`)).toBeInTheDocument()
  })

  it(`should render social provider buttons for known providers`, () => {
    render(
      <Login
        onLogin={mockOnLogin}
        providers={[`github`, `google`]}
      />
    )

    expect(screen.getByTestId(`gh-btn`)).toBeInTheDocument()
    expect(screen.getByTestId(`gg-btn`)).toBeInTheDocument()
  })

  it(`should not render buttons for unknown providers`, () => {
    render(
      <Login
        onLogin={mockOnLogin}
        providers={[`unknown`]}
      />
    )

    expect(screen.queryByTestId(`gh-btn`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`gg-btn`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`vr-btn`)).not.toBeInTheDocument()
  })

  it(`should render email form when showEmailForm and handlers are provided`, () => {
    render(
      <Login
        onLogin={mockOnLogin}
        providers={[]}
        showEmailForm={true}
        onEmailSignIn={mockOnEmailSignIn}
        onEmailSignUp={mockOnEmailSignUp}
      />
    )

    expect(screen.getByTestId(`email-form`)).toBeInTheDocument()
  })

  it(`should not render email form when showEmailForm is false`, () => {
    render(
      <Login
        onLogin={mockOnLogin}
        providers={[]}
        showEmailForm={false}
        onEmailSignIn={mockOnEmailSignIn}
        onEmailSignUp={mockOnEmailSignUp}
      />
    )

    expect(screen.queryByTestId(`email-form`)).not.toBeInTheDocument()
  })

  it(`should not render email form when onEmailSignIn is missing`, () => {
    render(
      <Login
        onLogin={mockOnLogin}
        providers={[]}
        showEmailForm={true}
        onEmailSignUp={mockOnEmailSignUp}
      />
    )

    expect(screen.queryByTestId(`email-form`)).not.toBeInTheDocument()
  })

  it(`should display error section when error prop is set`, () => {
    render(
      <Login
        onLogin={mockOnLogin}
        providers={[]}
        error='Auth failed'
      />
    )

    expect(screen.getByText(`Authentication Error`)).toBeInTheDocument()
    expect(screen.getByText(`Auth failed`)).toBeInTheDocument()
  })

  it(`should not display error section when no error`, () => {
    render(
      <Login
        onLogin={mockOnLogin}
        providers={[]}
      />
    )

    expect(screen.queryByText(`Authentication Error`)).not.toBeInTheDocument()
  })
})
