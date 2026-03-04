import { test, expect } from '@playwright/test'

test.describe('Email Login Flow', () => {
  // NOTE: This mock response shape is coupled to the Neon Auth SDK version (@neondatabase/neon-js).
  // If the SDK changes its response wrapping behavior, these mocks may need updating.
  test.beforeEach(async ({ page }) => {
    // Intercept Neon Auth to return NO session (unauthenticated).
    // Must return `null` — returning `{}` causes the SDK to wrap it as
    // `{ data: {} }` where `data` is truthy, leading auth.session() to call
    // `new User(undefined)` which throws in the User constructor.
    await page.route('**/neondb/auth/get-session**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    )

    // Intercept API calls to Caddy proxy (TLS bypass for self-signed cert)
    await page.route('https://px.local.threadedstack.app/**', async (route) => {
      const request = route.request()
      if (request.method().toLowerCase() === 'options') {
        await route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'access-control-allow-headers': '*',
          },
        })
        return
      }
      try {
        const resp = await page.request.fetch(request.url(), {
          ignoreHTTPSErrors: true,
          method: request.method(),
          headers: { ...request.headers(), host: undefined as any },
          data: request.postData() || undefined,
        })
        await route.fulfill({ status: resp.status(), headers: resp.headers(), body: await resp.body() })
      } catch {
        await route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"proxy error"}' })
      }
    })

    // Navigate directly to the login route — going to `/` triggers
    // Layout's <RedirectToSignIn /> which redirects externally.
    await page.goto('http://localhost:5887/auth/sign-in')
    await page.waitForLoadState('networkidle')

    // Wait for AuthProvider async init to finish and login form to render
    await page.waitForSelector('.tdsk-login-container', { timeout: 10000 })
  })

  test('should display login page with email form', async ({ page }) => {
    // Verify header — scope to visible <p> elements to avoid strict-mode
    // conflicts with <title> tag and the Sign In submit button
    await expect(page.locator('.tdsk-login-header p', { hasText: 'Threaded Stack' })).toBeVisible()
    await expect(page.locator('.tdsk-login-main-header p', { hasText: 'Sign In' })).toBeVisible()

    // Verify email form fields are present
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
  })

  test('should show social provider buttons', async ({ page }) => {
    // At least one social button should be visible (GitHub, Google, or Vercel)
    const socialButtons = page.locator('.tdsk-login-stack button')
    await expect(socialButtons.first()).toBeVisible()
  })

  test('should toggle between sign-in and sign-up modes', async ({ page }) => {
    // Default: sign-in mode
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

    // Click "Create account" to switch to sign-up
    await page.getByRole('button', { name: /create account/i }).click()

    // Should now show "Sign Up" button
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible()
    await expect(page.getByText(/already have an account/i)).toBeVisible()

    // Click "Sign in" to switch back
    await page.getByRole('button', { name: /sign in$/i }).click()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('should show forgot password link in sign-in mode', async ({ page }) => {
    await expect(page.getByRole('button', { name: /forgot password/i })).toBeVisible()
  })

  test('should not show forgot password link in sign-up mode', async ({ page }) => {
    // Switch to sign-up mode
    await page.getByRole('button', { name: /create account/i }).click()

    // Forgot password should not be visible in sign-up mode
    await expect(page.getByRole('button', { name: /forgot password/i })).not.toBeVisible()
  })
})
