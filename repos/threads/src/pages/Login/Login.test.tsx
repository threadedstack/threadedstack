import '@testing-library/jest-dom/vitest'

import { LoginPage } from './Login'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock(`@TTH/services/auth`, () => ({
  auth: {
    signInWithEmail: (...args: any[]) => mockSignInWithEmail(...args),
    signUpWithEmail: (...args: any[]) => mockSignUpWithEmail(...args),
    forgotPassword: (...args: any[]) => mockForgotPassword(...args),
  },
}))

vi.mock(`@TTH/state/accessors`, () => ({
  setUser: (...args: any[]) => mockSetUser(...args),
}))

vi.mock(`@TTH/constants/envs`, () => ({
  TDSK_AUTH_PROVIDERS: [`github`, `google`, `email`],
}))

vi.mock(`@TTH/actions/auth/local/signin`, () => ({
  signin: (...args: any[]) => mockSignin(...args),
}))

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

  it(`cancels the pending spinner-reset timer on unmount`, async () => {
    // The reset timer used to be armed and never cleared, so it fired 1500ms
    // after the component was gone and set state on a dead tree. Under vitest
    // that landed AFTER teardown as `ReferenceError: window is not defined`
    // from react-dom — 10 unhandled errors that failed a production deploy
    // while every test in the file still reported passing.
    vi.useFakeTimers()
    try {
      mockSignin.mockResolvedValue({})
      const { unmount } = render(<LoginPage />)
      await act(async () => {
        await capturedLoginProps.onLogin({ provider: `github` })
      })

      // The timer is armed by onLogin and must still be pending here —
      // otherwise the assertion below would pass for the wrong reason.
      expect(vi.getTimerCount()).toBe(1)

      unmount()
      // Assert BEFORE draining: a timer that FIRED also leaves the count at
      // zero, so checking after advancing cannot tell "cleared on unmount"
      // apart from "leaked, then executed against a dead tree".
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
