import { Auth } from './auth'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSignInSocial = vi.fn()
const mockSignInEmail = vi.fn()
const mockSignUpEmail = vi.fn()
const mockSignOut = vi.fn()
const mockGetSession = vi.fn()
const mockForgetPasswordEmailOtp = vi.fn()

vi.mock(`@neondatabase/neon-js/auth`, () => ({
  createAuthClient: () => ({
    signIn: {
      social: (...args: any[]) => mockSignInSocial(...args),
      email: (...args: any[]) => mockSignInEmail(...args),
    },
    signUp: {
      email: (...args: any[]) => mockSignUpEmail(...args),
    },
    forgetPassword: {
      emailOtp: (...args: any[]) => mockForgetPasswordEmailOtp(...args),
    },
    signOut: () => mockSignOut(),
    getSession: () => mockGetSession(),
  }),
}))

vi.mock(`@tdsk/domain`, () => ({
  User: class User {
    constructor(data: any) {
      Object.assign(this, data)
    }
  },
}))

vi.mock(`@TAF/constants/envs`, () => ({
  TDSK_AUTH_URL: `http://test-auth.local`,
}))

const mockError = {
  status: 400,
  statusText: `Bad Request`,
  code: `AUTH_ERROR`,
  message: `Something went wrong`,
}

const mockSessionData = {
  session: { id: `s1`, token: `tok`, userId: `u1`, expiresAt: `2099-01-01` },
  user: { id: `u1`, email: `test@test.com` },
}

describe(`Auth`, () => {
  let auth: Auth

  beforeEach(() => {
    vi.clearAllMocks()
    auth = new Auth()
    mockGetSession.mockResolvedValue({ data: mockSessionData })
  })

  describe(`signUpWithEmail`, () => {
    it(`should call signUp.email with email, password, and name`, async () => {
      mockSignUpEmail.mockResolvedValue({})

      await auth.signUpWithEmail(`user@example.com`, `securePass123`, `Test User`)

      expect(mockSignUpEmail).toHaveBeenCalledWith({
        email: `user@example.com`,
        password: `securePass123`,
        name: `Test User`,
      })
    })

    it(`should return session data on successful signup`, async () => {
      mockSignUpEmail.mockResolvedValue({})

      const result = await auth.signUpWithEmail(
        `user@example.com`,
        `pass123`,
        `Test User`
      )

      expect(result.session).toEqual(mockSessionData.session)
      expect(result.user).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it(`should return error when signup fails`, async () => {
      mockSignUpEmail.mockResolvedValue({ error: mockError })

      const result = await auth.signUpWithEmail(
        `user@example.com`,
        `pass123`,
        `Test User`
      )

      expect(result.error).toEqual(mockError)
      expect(mockGetSession).not.toHaveBeenCalled()
    })

    it(`should derive name from email when name is omitted`, async () => {
      mockSignUpEmail.mockResolvedValue({})

      await auth.signUpWithEmail(`jane.doe@example.com`, `securePass123`)

      expect(mockSignUpEmail).toHaveBeenCalledWith({
        email: `jane.doe@example.com`,
        password: `securePass123`,
        name: `jane.doe`,
      })
    })
  })

  describe(`signInWithEmail`, () => {
    it(`should call signIn.email with email and password`, async () => {
      mockSignInEmail.mockResolvedValue({})

      await auth.signInWithEmail(`user@example.com`, `securePass123`)

      expect(mockSignInEmail).toHaveBeenCalledWith({
        email: `user@example.com`,
        password: `securePass123`,
      })
    })

    it(`should return session data on successful signin`, async () => {
      mockSignInEmail.mockResolvedValue({})

      const result = await auth.signInWithEmail(`user@example.com`, `pass123`)

      expect(result.session).toEqual(mockSessionData.session)
      expect(result.user).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it(`should return error on invalid credentials`, async () => {
      mockSignInEmail.mockResolvedValue({ error: mockError })

      const result = await auth.signInWithEmail(`user@example.com`, `wrongpass`)

      expect(result.error).toEqual(mockError)
      expect(mockGetSession).not.toHaveBeenCalled()
    })
  })

  describe(`signin (social)`, () => {
    it(`should call signIn.social with provider`, async () => {
      mockSignInSocial.mockResolvedValue({})

      await auth.signin(`github`)

      expect(mockSignInSocial).toHaveBeenCalledWith({ provider: `github` })
    })

    it(`should return error when social signin fails`, async () => {
      mockSignInSocial.mockResolvedValue({ error: mockError })

      const result = await auth.signin(`github`)

      expect(result.error).toEqual(mockError)
    })
  })

  describe(`session`, () => {
    it(`should return session and user data`, async () => {
      const result = await auth.session()

      expect(result.session).toEqual(mockSessionData.session)
      expect(result.user).toBeDefined()
    })

    it(`should return error when getSession fails`, async () => {
      mockGetSession.mockResolvedValue({ error: mockError })

      const result = await auth.session()

      expect(result.error).toEqual(mockError)
    })

    it(`should return empty object when no data`, async () => {
      mockGetSession.mockResolvedValue({})

      const result = await auth.session()

      expect(result).toEqual({})
    })
  })

  describe(`forgotPassword`, () => {
    it(`should call forgetPassword.emailOtp with email`, async () => {
      mockForgetPasswordEmailOtp.mockResolvedValue({})

      await auth.forgotPassword(`user@example.com`)

      expect(mockForgetPasswordEmailOtp).toHaveBeenCalledWith({
        email: `user@example.com`,
      })
    })

    it(`should return success on success`, async () => {
      mockForgetPasswordEmailOtp.mockResolvedValue({})

      const result = await auth.forgotPassword(`user@example.com`)

      expect(result).toEqual({ success: true })
      expect(result.error).toBeUndefined()
    })

    it(`should return error when forgotPassword fails`, async () => {
      mockForgetPasswordEmailOtp.mockResolvedValue({ error: mockError })

      const result = await auth.forgotPassword(`user@example.com`)

      expect(result.error).toEqual(mockError)
    })
  })

  describe(`signout`, () => {
    it(`should return true on successful signout`, async () => {
      mockSignOut.mockResolvedValue({})

      const result = await auth.signout()

      expect(result).toBe(true)
    })

    it(`should return error when signout fails`, async () => {
      mockSignOut.mockResolvedValue({ error: mockError })

      const result = await auth.signout()

      expect(result).toEqual({ error: mockError })
    })
  })
})
