# Email Sign-Up via Neon Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add email/password sign-up and sign-in alongside existing social OAuth login in the admin dashboard.

**Architecture:** Extend the existing Neon Auth integration to use `signIn.email()` and `signUp.email()` methods. Also adds `forgotPassword` support via `forgetPassword.emailOtp()`. The session/JWT flow remains identical — Neon Auth produces the same JWT regardless of auth method, so proxy/backend require zero changes. All work is in the admin app and deploy config.

**Tech Stack:** Neon Auth SDK (`@neondatabase/neon-js/auth`), React, MUI, Jotai

---

## Task 1: Enable Email Provider in Neon Auth Config

**Files:**
- Modify: `deploy/values.yaml` (line ~82, `TDSK_AUTH_PROVIDERS`)
- Modify: `deploy/values.local.yaml` (same key if present)

**Step 1: Add email to the provider list**

In `deploy/values.yaml`, change:
```yaml
TDSK_AUTH_PROVIDERS: github,google,vercel
```
to:
```yaml
TDSK_AUTH_PROVIDERS: github,google,vercel,email
```

**Step 2: Verify local override**

Check `deploy/values.local.yaml` for `TDSK_AUTH_PROVIDERS`. If present, add `email` there too. If not present, the base values.yaml change is sufficient.

**Step 3: Verify admin picks up the new provider**

The admin app reads providers in `repos/admin/src/constants/envs.ts`:
```typescript
export const TDSK_AUTH_PROVIDERS = (process.env.TDSK_AUTH_PROVIDERS || `github`).split(`,`)
```
This will automatically include `email` in the array. No code change needed here.

**Step 4: Commit**

```
feat(deploy): add email to auth providers list
```

---

## Task 2: Add Email Auth Methods to Auth Service

**Files:**
- Modify: `repos/admin/src/services/auth.ts`
- Test: `repos/admin/src/services/auth.test.ts` (co-located with source)

**Step 1: Write failing tests for signUpWithEmail and signInWithEmail**

Create `repos/admin/src/services/auth.test.ts` (co-located):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Neon Auth client
const mockSignUp = { email: vi.fn() }
const mockSignIn = { email: vi.fn(), social: vi.fn() }
const mockGetSession = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@neondatabase/neon-js/auth', () => ({
  createAuthClient: () => ({
    signUp: mockSignUp,
    signIn: mockSignIn,
    getSession: mockGetSession,
    signOut: mockSignOut,
  }),
}))

// Must import AFTER mock setup
const { Auth } = await import('../auth')

describe('Auth', () => {
  let auth: InstanceType<typeof Auth>

  beforeEach(() => {
    vi.clearAllMocks()
    auth = new Auth()
  })

  describe('signUpWithEmail', () => {
    it('calls signUp.email with email and password', async () => {
      mockSignUp.email.mockResolvedValue({ error: null })
      mockGetSession.mockResolvedValue({
        data: { session: { token: 'tok' }, user: { id: '1', email: 'a@b.com' } },
        error: null,
      })

      const result = await auth.signUpWithEmail('a@b.com', 'Password1!')
      expect(mockSignUp.email).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'Password1!',
      })
      expect(result).toHaveProperty('session')
    })

    it('returns error when signup fails', async () => {
      mockSignUp.email.mockResolvedValue({
        error: { message: 'Email taken', status: 409, statusText: 'Conflict' },
      })

      const result = await auth.signUpWithEmail('a@b.com', 'Password1!')
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Email taken')
    })
  })

  describe('signInWithEmail', () => {
    it('calls signIn.email with email and password', async () => {
      mockSignIn.email.mockResolvedValue({ error: null })
      mockGetSession.mockResolvedValue({
        data: { session: { token: 'tok' }, user: { id: '1', email: 'a@b.com' } },
        error: null,
      })

      const result = await auth.signInWithEmail('a@b.com', 'Password1!')
      expect(mockSignIn.email).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'Password1!',
      })
      expect(result).toHaveProperty('session')
    })

    it('returns error on invalid credentials', async () => {
      mockSignIn.email.mockResolvedValue({
        error: { message: 'Invalid credentials', status: 401, statusText: 'Unauthorized' },
      })

      const result = await auth.signInWithEmail('a@b.com', 'wrong')
      expect(result.error).toBeDefined()
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd repos/admin && pnpm test -- src/services/auth.test.ts`
Expected: FAIL — `signUpWithEmail` and `signInWithEmail` methods don't exist

**Step 3: Implement email auth methods**

In `repos/admin/src/services/auth.ts`, add two methods to the `Auth` class:

```typescript
signUpWithEmail = async (email: string, password: string, name?: string): Promise<TAuthResp> => {
  const displayName = name || email.split('@')[0]
  const { error } = await this.client.signUp.email({ email, password, name: displayName })
  if (error) return this.#error(error)
  return await this.session()
}

signInWithEmail = async (email: string, password: string): Promise<TAuthResp> => {
  const { error } = await this.client.signIn.email({ email, password })
  if (error) return this.#error(error)
  return await this.session()
}

forgotPassword = async (email: string): Promise<TAuthResp> => {
  const { error } = await this.client.forgetPassword.emailOtp({ email })
  if (error) return this.#error(error)
  return { success: true }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd repos/admin && pnpm test -- src/services/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(admin): add signUpWithEmail and signInWithEmail to Auth service
```

---

## Task 3: Add Email Login Form Component

**Files:**
- Create: `repos/admin/src/components/Login/EmailLoginForm.tsx`
- Test: `repos/admin/src/components/Login/EmailLoginForm.test.tsx` (co-located)

**Step 1: Write failing test for EmailLoginForm**

Create `repos/admin/src/components/Login/EmailLoginForm.test.tsx` (co-located):
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EmailLoginForm } from '../EmailLoginForm'

describe('EmailLoginForm', () => {
  it('renders email and password fields', () => {
    render(<EmailLoginForm onSignIn={vi.fn()} onSignUp={vi.fn()} />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('calls onSignIn with email and password on submit', async () => {
    const onSignIn = vi.fn().mockResolvedValue({})
    render(<EmailLoginForm onSignIn={onSignIn} onSignUp={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Pass123!' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(onSignIn).toHaveBeenCalledWith('a@b.com', 'Pass123!')
    })
  })

  it('toggles to sign-up mode and calls onSignUp', async () => {
    const onSignUp = vi.fn().mockResolvedValue({})
    render(<EmailLoginForm onSignIn={vi.fn()} onSignUp={onSignUp} />)

    fireEvent.click(screen.getByText(/create account/i))
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Pass123!' } })
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(onSignUp).toHaveBeenCalledWith('a@b.com', 'Pass123!')
    })
  })

  it('shows error message when provided', () => {
    render(<EmailLoginForm onSignIn={vi.fn()} onSignUp={vi.fn()} error="Invalid credentials" />)
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  })

  it('disables submit button while loading', () => {
    render(<EmailLoginForm onSignIn={vi.fn()} onSignUp={vi.fn()} loading />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd repos/admin && pnpm test -- src/components/Login/EmailLoginForm.test.tsx`
Expected: FAIL — component doesn't exist

**Step 3: Implement EmailLoginForm**

Create `repos/admin/src/components/Login/EmailLoginForm.tsx`:
```tsx
import { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

export type TEmailLoginFormProps = {
  onSignIn: (email: string, password: string) => Promise<void>
  onSignUp: (email: string, password: string) => Promise<void>
  error?: string
  loading?: boolean
}

export const EmailLoginForm = (props: TEmailLoginFormProps) => {
  const { onSignIn, onSignUp, error, loading } = props
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSignUp) await onSignUp(email, password)
    else await onSignIn(email, password)
  }, [email, password, isSignUp, onSignIn, onSignUp])

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', mt: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField
        label="Email"
        type="email"
        fullWidth
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        sx={{ mb: 2 }}
      />

      <TextField
        label="Password"
        type="password"
        fullWidth
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={loading || !email || !password}
        sx={{ mb: 1 }}
      >
        {loading
          ? <CircularProgress size={20} />
          : isSignUp ? 'Sign Up' : 'Sign In'
        }
      </Button>

      <Typography variant="body2" align="center">
        <Link
          component="button"
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          underline="hover"
        >
          {isSignUp ? 'Already have an account? Sign in' : 'Create account'}
        </Link>
      </Typography>
    </Box>
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `cd repos/admin && pnpm test -- src/components/Login/EmailLoginForm.test.tsx`
Expected: PASS

**Step 5: Commit**

```
feat(admin): add EmailLoginForm component for email/password auth
```

---

## Task 4: Integrate Email Form into Login Page

**Files:**
- Modify: `repos/admin/src/components/Login/Login.tsx`
- Modify: `repos/admin/src/pages/Login/Login.tsx`
- Modify: `repos/admin/src/types/auth.types.ts` (if needed)

**Step 1: Read current Login component and Login page**

Read `repos/admin/src/components/Login/Login.tsx` and `repos/admin/src/pages/Login/Login.tsx` to understand current structure.

**Step 2: Update Login component to show email form when `email` is in providers list**

In `repos/admin/src/components/Login/Login.tsx`, add the EmailLoginForm alongside existing social buttons:

```tsx
import { EmailLoginForm } from './EmailLoginForm'

// Inside the Login component render:
// After the social buttons section, add:
{providers.includes('email') && (
  <>
    <Divider sx={{ my: 2 }}>or</Divider>
    <EmailLoginForm
      onSignIn={onEmailSignIn}
      onSignUp={onEmailSignUp}
      error={emailError}
      loading={emailLoading}
    />
  </>
)}
```

**Step 3: Update Login page to wire email auth callbacks**

In `repos/admin/src/pages/Login/Login.tsx`, add handlers:

```typescript
const handleEmailSignIn = useCallback(async (email: string, password: string) => {
  setEmailLoading(true)
  setEmailError(undefined)
  const result = await auth.signInWithEmail(email, password)
  if (result.error) {
    setEmailError(result.error.message || 'Sign in failed')
    setEmailLoading(false)
    return
  }
  // Same post-login flow as social auth
  await onAuthSuccess(result)
  setEmailLoading(false)
}, [auth])

const handleEmailSignUp = useCallback(async (email: string, password: string) => {
  setEmailLoading(true)
  setEmailError(undefined)
  const result = await auth.signUpWithEmail(email, password)
  if (result.error) {
    setEmailError(result.error.message || 'Sign up failed')
    setEmailLoading(false)
    return
  }
  await onAuthSuccess(result)
  setEmailLoading(false)
}, [auth])
```

**Step 4: Run admin unit tests**

Run: `cd repos/admin && pnpm test`
Expected: All tests PASS

**Step 5: Run type checks**

Run: `cd repos/admin && pnpm types`
Expected: No type errors

**Step 6: Commit**

```
feat(admin): integrate email sign-up/sign-in on login page
```

---

## Task 5: Validate End-to-End

**Step 1: Build admin**

Run: `cd repos/admin && pnpm build`
Expected: Clean build

**Step 2: Verify with running services**

Start admin dev server (`cd repos/admin && pnpm start`), verify:
1. Login page shows social buttons AND email form
2. Email form has sign-in/sign-up toggle
3. Email sign-in calls Neon Auth correctly (check network tab)
4. Error states display properly (wrong password, email taken, etc.)

**Step 3: Run integration tests**

Run: `cd repos/integration && pnpm test:ui`
Expected: Existing Playwright tests still pass (auth bypass intercepts before Neon Auth)

**Note:** Full end-to-end email verification requires Neon Auth to have email verification configured in their dashboard. The verification email is sent by Neon Auth — the admin app doesn't need to handle the verification flow itself (Neon Auth redirects the user back after clicking the email link).
