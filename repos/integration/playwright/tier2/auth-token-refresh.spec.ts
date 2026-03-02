import { test, expect } from '../fixtures/auth'

/**
 * Integration tests for the auth token 401 retry mechanism.
 *
 * These tests validate that the admin app's ApiService.fetch() correctly
 * detects 401 responses, refreshes the auth token via TokenRefreshManager,
 * and retries the failed request — all transparently to the user.
 *
 * Route interception strategy: Playwright routes match in LIFO order.
 * The `authenticatedPage` fixture registers Neon Auth mock + TLS proxy bypass.
 * Our test-level interceptors register AFTER, so they match FIRST.
 * On retry, we call `route.fallback()` to pass through to the TLS proxy bypass.
 */

const ignoredPatterns = [
  'Function components cannot be given refs',
  'useLayoutEffect does nothing on the server',
  'Download the React DevTools',
  'React does not recognize',
  'Warning:',
  'Failed to load resource',
  'net::ERR_',
  '404',
  '401',
  'Unauthorized',
]

const isIgnored = (text: string): boolean =>
  ignoredPatterns.some((p) => text.includes(p))

async function gotoAndWait(
  page: import('@playwright/test').Page,
  url: string,
  pageClass: string,
  timeout = 10000
) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await expect(page.locator(`.${pageClass}`)).toBeVisible({ timeout })
}

test.describe('Auth Token 401 Retry', () => {
  test('baseline - page loads without 401 interception', async ({
    authenticatedPage: page,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text()))
        errors.push(msg.text())
    })

    await gotoAndWait(page, '/', 'tdsk-home-page')

    await expect(
      page.getByRole('heading', { name: 'Organizations' })
    ).toBeVisible()
    await expect(page.locator('.MuiCard-root').first()).toBeVisible()

    expect(errors).toEqual([])
  })

  test('401 on orgs list triggers token refresh and retry', async ({
    authenticatedPage: page,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text()))
        errors.push(msg.text())
    })

    let callCount = 0
    await page.route('**/_/orgs**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fallback()
        return
      }

      callCount++
      if (callCount === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' }),
        })
      } else {
        await route.fallback()
      }
    })

    await gotoAndWait(page, '/', 'tdsk-home-page')

    await expect(
      page.getByRole('heading', { name: 'Organizations' })
    ).toBeVisible()
    await expect(page.locator('.MuiCard-root').first()).toBeVisible()

    // The orgs endpoint was called at least twice: initial 401 + retry
    expect(callCount).toBeGreaterThanOrEqual(2)
    expect(errors).toEqual([])
  })

  test('401 on org detail triggers token refresh and retry', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text()))
        errors.push(msg.text())
    })

    let callCount = 0
    await page.route(`**/_/users**`, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fallback()
        return
      }

      callCount++
      if (callCount === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired' }),
        })
      } else {
        await route.fallback()
      }
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()
    await expect(page.getByText('Org Information')).toBeVisible()

    expect(callCount).toBeGreaterThanOrEqual(2)
    expect(errors).toEqual([])
  })

  test('persistent 401 does not crash the app', async ({
    authenticatedPage: page,
  }) => {
    // All orgs API calls return 401 — the app should handle gracefully
    // Token refresh succeeds (Neon Auth mock still returns valid session),
    // but the retry also gets 401. ApiService.fetch() only retries once,
    // so the component receives the error without infinite loops.
    await page.route('**/_/orgs**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fallback()
        return
      }

      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Token expired' }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should not crash — body remains visible
    await expect(page.locator('body').first()).toBeVisible()

    // Give React time to settle any error boundaries or redirects
    await page.waitForTimeout(2000)
    await expect(page.locator('body').first()).toBeVisible()
  })
})
