import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const mockSignin = vi.fn()
const mockSignInWithEmail = vi.fn()
const mockSignUpWithEmail = vi.fn()
const mockForgotPassword = vi.fn()
const mockSetUser = vi.fn()

let capturedLoginProps: any = {}

vi.mock(`@tdsk/components`, async () => {
  const actual = await vi.importActual(`@tdsk/components`)
  return {
    ...actual,
    Login: (props: any) => {
      capturedLoginProps = props
      return <div data-testid='login-component' />
    },
  }
})

vi.mock(`@TAF/services/auth`, () => ({
  auth: {
    signInWithEmail: (...args: any[]) => mockSignInWithEmail(...args),
    signUpWithEmail: (...args: any[]) => mockSignUpWithEmail(...args),
    forgotPassword: (...args: any[]) => mockForgotPassword(...args),
  },
}))

vi.mock(`@TAF/state/accessors`, () => ({
  setUser: (...args: any[]) => mockSetUser(...args),
}))

vi.mock(`@TAF/constants/envs`, () => ({
  TDSK_AUTH_PROVIDERS: [`github`, `google`, `email`],
}))

vi.mock(`@TAF/actions/auth/local/signin`, () => ({
  signin: (...args: any[]) => mockSignin(...args),
}))

import { LoginPage } from './Login'

describe(`LoginPage`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedLoginProps = {}
  })

  it(`should render Login component`, () => {
    render(<LoginPage />)
    expect(screen.getByTestId(`login-component`)).toBeInTheDocument()
  })

  it(`should pass providers from TDSK_AUTH_PROVIDERS`, () => {
    render(<LoginPage />)
    expect(capturedLoginProps.providers).toEqual([`github`, `google`, `email`])
  })

  it(`should pass showEmailForm as true when email is in providers`, () => {
    render(<LoginPage />)
    expect(capturedLoginProps.showEmailForm).toBe(true)
  })

  it(`should call auth.signInWithEmail on onEmailSignIn`, async () => {
    mockSignInWithEmail.mockResolvedValue({})
    render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onEmailSignIn(`a@b.com`, `pass`)
    })
    expect(mockSignInWithEmail).toHaveBeenCalledWith(`a@b.com`, `pass`)
  })

  it(`should set emailError when signInWithEmail returns error`, async () => {
    mockSignInWithEmail.mockResolvedValue({ error: { message: `Bad credentials` } })
    const { rerender } = render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onEmailSignIn(`a@b.com`, `pass`)
    })
    rerender(<LoginPage />)
    expect(capturedLoginProps.emailError).toBe(`Bad credentials`)
  })

  it(`should call setUser on successful signInWithEmail`, async () => {
    mockSignInWithEmail.mockResolvedValue({ user: { id: `u1` } })
    render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onEmailSignIn(`a@b.com`, `pass`)
    })
    expect(mockSetUser).toHaveBeenCalledWith({ id: `u1` })
  })

  it(`should call auth.signUpWithEmail on onEmailSignUp`, async () => {
    mockSignUpWithEmail.mockResolvedValue({})
    render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onEmailSignUp(`a@b.com`, `pass`)
    })
    expect(mockSignUpWithEmail).toHaveBeenCalledWith(`a@b.com`, `pass`)
  })

  it(`should set emailError when signUpWithEmail returns error`, async () => {
    mockSignUpWithEmail.mockResolvedValue({ error: { message: `Sign up failed` } })
    const { rerender } = render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onEmailSignUp(`a@b.com`, `pass`)
    })
    rerender(<LoginPage />)
    expect(capturedLoginProps.emailError).toBe(`Sign up failed`)
  })

  it(`should call auth.forgotPassword on onForgotPassword`, async () => {
    mockForgotPassword.mockResolvedValue({})
    render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onForgotPassword(`a@b.com`)
    })
    expect(mockForgotPassword).toHaveBeenCalledWith(`a@b.com`)
  })

  it(`should set emailError when signInWithEmail throws exception`, async () => {
    mockSignInWithEmail.mockRejectedValue(new Error(`Network failure`))
    const { rerender } = render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onEmailSignIn(`a@b.com`, `pass`)
    })
    rerender(<LoginPage />)
    expect(capturedLoginProps.emailError).toBe(`Network failure`)
  })

  it(`should set emailError when signUpWithEmail throws exception`, async () => {
    mockSignUpWithEmail.mockRejectedValue(new Error(`Network failure`))
    const { rerender } = render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onEmailSignUp(`a@b.com`, `pass`)
    })
    rerender(<LoginPage />)
    expect(capturedLoginProps.emailError).toBe(`Network failure`)
  })

  it(`should set emailError when forgotPassword throws exception`, async () => {
    mockForgotPassword.mockRejectedValue(new Error(`Network failure`))
    const { rerender } = render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onForgotPassword(`a@b.com`)
    })
    rerender(<LoginPage />)
    expect(capturedLoginProps.emailError).toBe(`Network failure`)
  })

  it(`should set success message after forgotPassword succeeds`, async () => {
    mockForgotPassword.mockResolvedValue({})
    const { rerender } = render(<LoginPage />)
    await act(async () => {
      await capturedLoginProps.onForgotPassword(`a@b.com`)
    })
    rerender(<LoginPage />)
    expect(capturedLoginProps.emailSuccess).toBe(
      `Password reset email sent. Check your inbox.`
    )
    expect(capturedLoginProps.emailError).toBeUndefined()
  })
})
