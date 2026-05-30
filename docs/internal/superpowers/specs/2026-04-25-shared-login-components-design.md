# Shared Login Components — Design Spec

## Context

The admin (`repos/admin/`) and threads (`repos/threads/`) apps have near-identical login UI code — components, styled components, auth types, and provider buttons. The only differences are import aliases (`@TAF/` vs `@TTH/`), minor whitespace/ordering, and app-specific state reset logic. This duplication means every login UI change must be made twice.

This spec extracts the shared presentational login code into `@tdsk/components` so both apps import from a single source. The shared layer is purely UI — no auth services, no Neon client, no token management, no app-specific actions.

## Scope

### Moves to `@tdsk/components`

**Components** — new directory `repos/components/src/components/Login/`:

| File | Source (identical in both apps) | Changes on move |
|------|------|------|
| `Login.tsx` | Main login layout with provider buttons and email form | Add `headline` and `subtitle` props (defaults: `"Threaded Stack"`, `"Secure AI agent orchestration with enterprise-grade security"`) |
| `Login.styles.tsx` | All styled components (LoginContainer, BrandGlow, BrandBlob1/2, BrandLogo, BrandHeadline, BrandSubtitle, LoginContent, LoginMainContainer, LoginStack, BtnSection, ProviderLoginButton, ErrorSection, ErrorTitle, ErrorText, EmailFormContainer, EmailFormButton) | `@tdsk/components` imports become relative (Text, TSIcon, gutter, LoadingButton) |
| `EmailLoginForm.tsx` | Email/password form with sign-in, sign-up, forgot password | `TextInput` import becomes relative |
| `LoginError.tsx` | Standalone auth error display | Uses Login.styles internally |
| `GithubBtn.tsx` | GitHub OAuth button | No changes beyond import paths |
| `GoogleBtn.tsx` | Google OAuth button | No changes beyond import paths |
| `VercelBtn.tsx` | Vercel OAuth button | `VercelIcon` import becomes relative |
| `GitlabBtn.tsx` | GitLab OAuth button (exists in admin, not threads — shared for both) | `GitlabIcon` import becomes relative |
| `index.ts` | Barrel export | New file exporting all components |

**Types** — new file `repos/components/src/types/auth.types.ts`:

```typescript
// From repos/admin/src/types/auth.types.ts (identical in threads)
TLoginData    // { provider?: string; options?: Record<string, any> }
TOnLogin      // (data: TLoginData) => void
TAuthSession  // { id, token, userId, expiresAt, ... }
TAuthError    // { code?, message?, status, statusText }
TAuthData     // { user?: User; session?: TAuthSession }
TAuthResp     // TAuthData & { error?: TAuthError; success?: boolean }

// From Login.tsx component props (currently inline)
TLoginBtnProps  // { error?, onLogin, loading?, disabled?, authenticating? }
TLogin          // TLoginBtnProps & { providers, showEmailForm?, email callbacks... }
TEmailLoginFormProps  // { onSignIn, onSignUp, onForgotPassword?, error?, success?, loading? }
TLoginError     // { message?: string }
```

Added to `repos/components/src/types/index.ts` barrel export.

### Stays per-app

Each app retains its own (unchanged):

| Layer | Files | Why |
|-------|-------|-----|
| AuthProvider + AuthContext | `contexts/AuthProvider.tsx`, `contexts/AuthContext.ts` | Orchestrates app-specific init, token refresh, signout |
| Auth service | `services/auth.ts` | Creates Neon Auth client with app-specific env var |
| TokenRefreshManager | `services/tokenRefresh.ts` | Depends on app-specific apiService and authClient |
| Auth actions | `actions/auth/local/{init,signin,signout,loginWithEmail,signupWithEmail,reset}.ts` | Depend on app-specific state accessors, nav, apiService |
| LoginPage container | `pages/Login/Login.tsx` | Wires app-specific actions as callback props to shared `<Login>` |
| Navigation | `services/nav.ts` | App-specific route paths |
| API service | `services/api.ts` | App-specific bearer/retry logic |

### Deleted from each app

| App | Deleted |
|-----|---------|
| admin | `src/components/Login/` (entire directory), `src/types/auth.types.ts` |
| threads | `src/components/Login/` (entire directory), `src/types/auth.types.ts` |

## Component API Changes

### `Login` component — new props

```typescript
type TLogin = TLoginBtnProps & {
  providers: Array<string>
  showEmailForm?: boolean
  headline?: string    // default: "Threaded Stack"
  subtitle?: string    // default: "Secure AI agent orchestration with enterprise-grade security"
  emailError?: string
  emailSuccess?: string
  emailLoading?: boolean
  onEmailSignIn?: (email: string, password: string) => Promise<void>
  onEmailSignUp?: (email: string, password: string) => Promise<void>
  onForgotPassword?: (email: string) => Promise<void>
}
```

The `BrandHeadline` and `BrandSubtitle` rendered elements use the prop values instead of hardcoded strings.

## Import Changes

### Admin `LoginPage` (before → after)

```typescript
// Before
import { Login } from '@TAF/components/Login'
import type { TOnLogin } from '@TAF/types'

// After
import { Login } from '@tdsk/components'
import type { TOnLogin } from '@tdsk/components'
```

### Admin `AuthProvider` (before → after)

```typescript
// Before
import type { TAuthSession } from '@TAF/types'
import { LoginError } from '@TAF/components/Login/LoginError'

// After
import type { TAuthSession } from '@tdsk/components'
import { LoginError } from '@tdsk/components'
```

### Threads — same pattern with `@TTH/` → `@tdsk/components`

## Files Modified (Summary)

**Components repo (new files):**
- `repos/components/src/components/Login/Login.tsx`
- `repos/components/src/components/Login/Login.styles.tsx`
- `repos/components/src/components/Login/EmailLoginForm.tsx`
- `repos/components/src/components/Login/LoginError.tsx`
- `repos/components/src/components/Login/GithubBtn.tsx`
- `repos/components/src/components/Login/GoogleBtn.tsx`
- `repos/components/src/components/Login/VercelBtn.tsx`
- `repos/components/src/components/Login/GitlabBtn.tsx`
- `repos/components/src/components/Login/index.ts`
- `repos/components/src/types/auth.types.ts`

**Components repo (modified):**
- `repos/components/src/types/index.ts` — add auth.types barrel
- `repos/components/src/index.ts` — add Login barrel (if not auto-covered)

**Admin (modified):**
- `repos/admin/src/pages/Login/Login.tsx` — update Login + TOnLogin imports to `@tdsk/components`
- `repos/admin/src/contexts/AuthProvider.tsx` — update LoginError + TAuthSession imports
- `repos/admin/src/contexts/AuthContext.ts` — update TAuthSession import
- `repos/admin/src/services/tokenRefresh.ts` — update TAuthSession import
- `repos/admin/src/services/tokenRefresh.test.ts` — update auth type imports
- `repos/admin/src/services/auth.ts` — update TAuthError + TAuthResp imports
- `repos/admin/src/services/api.ts` — update TAuthData import
- `repos/admin/src/types/index.ts` — remove `export * from './auth.types'` line

**Admin (deleted):**
- `repos/admin/src/components/Login/` (entire directory)
- `repos/admin/src/types/auth.types.ts`

**Threads (modified):**
- `repos/threads/src/pages/Login/Login.tsx` — update Login + TOnLogin imports to `@tdsk/components`
- `repos/threads/src/contexts/AuthProvider.tsx` — update LoginError + TAuthSession imports
- `repos/threads/src/contexts/AuthContext.ts` — update TAuthSession import
- `repos/threads/src/services/tokenRefresh.ts` — update TAuthSession import
- `repos/threads/src/services/auth.ts` — update TAuthError + TAuthResp imports
- `repos/threads/src/services/api.ts` — update TAuthData import
- `repos/threads/src/types/index.ts` — remove `export * from './auth.types'` line

**Threads (deleted):**
- `repos/threads/src/components/Login/` (entire directory)
- `repos/threads/src/types/auth.types.ts`

## Verification

1. **Type check all three repos:**
   ```bash
   cd repos/components && pnpm types
   cd repos/admin && pnpm types
   cd repos/threads && pnpm types
   ```

2. **Build components repo** (consumed by admin and threads):
   ```bash
   cd repos/components && pnpm build
   ```

3. **Build both apps:**
   ```bash
   cd repos/admin && pnpm build
   cd repos/threads && pnpm build
   ```

4. **Run unit tests** in all three repos:
   ```bash
   cd repos/components && pnpm test
   cd repos/admin && pnpm test
   cd repos/threads && pnpm test
   ```

5. **Visual verification** — start admin and threads dev servers, confirm login page renders correctly with provider buttons, email form, error states, and branding.
