import { test as base, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export interface TestContext {
  orgId: string
  orgName: string
  apiKey: string
  userId: string
  projectId: string
  agentId: string
}

/**
 * Read shared test context written by global setup.
 * The context file lives at $TMPDIR/tdsk-integration/context.json.
 */
const readContext = (): TestContext => {
  const file = join(tmpdir(), 'tdsk-integration', 'context.json')
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as TestContext
  } catch {
    throw new Error(
      'Test context not found. Global setup may have failed.\n' +
        `  Expected: ${file}`
    )
  }
}

/**
 * Build the mock payload for Neon Auth session interception.
 * The admin app fetches /neondb/auth/get-session on load.
 * We return a mock session with the test API key as the Bearer token.
 */
const buildNeonAuthMock = (ctx: TestContext) => ({
  session: {
    token: ctx.apiKey,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
  user: {
    id: ctx.userId,
    email: 'integration@test.local',
    name: 'Integration Test',
    image: '',
  },
})

/**
 * TODO: This url should come from an ENV, not hard-coded
 * Proxy URL pattern for Caddy → Auth Proxy → Backend.
 * Caddy uses a local CA cert that the browser does not trust,
 * so we intercept all requests to this host and re-issue them
 * via Playwright's request API with `ignoreHTTPSErrors: true`.
 */
const PROXY_PATTERN = 'https://px.local.threadedstack.app/**'

/**
 * Extended Playwright test fixture that provides an `authenticatedPage`.
 *
 * The fixture sets up two route interceptors BEFORE any navigation:
 * 1. Neon Auth mock — returns a fake session with the test API key as Bearer token
 * 2. TLS proxy bypass — re-issues requests to px.local.threadedstack.app with
 *    ignoreHTTPSErrors so the self-signed Caddy cert doesn't block API calls
 *
 * It also exposes the test context (`ctx`) for building dynamic URLs.
 */
export const test = base.extend<{
  authenticatedPage: Page
  ctx: TestContext
}>({
  ctx: async ({}, use) => {
    use(readContext())
  },

  authenticatedPage: async ({ page, ctx }, use) => {
    // 1. Intercept Neon Auth BEFORE any navigation
    await page.route('**/neondb/auth/get-session**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(buildNeonAuthMock(ctx)),
      })
    )

    // 2. Intercept API calls to Caddy proxy and re-issue with TLS bypass
    await page.route(PROXY_PATTERN, async (route) => {
      const request = route.request()
      const method = request.method().toLowerCase()
      const url = request.url()
      const headers = { ...request.headers() }
      const postData = request.postData()

      // Remove headers that cause issues when re-issuing
      delete headers['host']
      delete headers['content-length']

      // Handle CORS preflight locally
      if (method === 'options') {
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
        const opts: Parameters<typeof page.request.get>[1] = {
          ignoreHTTPSErrors: true,
          headers,
        }

        let resp
        if (method === 'get') {
          resp = await page.request.get(url, opts)
        } else if (method === 'post') {
          resp = await page.request.post(url, {
            ...opts,
            data: postData ? JSON.parse(postData) : undefined,
          })
        } else if (method === 'put') {
          resp = await page.request.put(url, {
            ...opts,
            data: postData ? JSON.parse(postData) : undefined,
          })
        } else if (method === 'delete') {
          resp = await page.request.delete(url, opts)
        } else {
          resp = await page.request.fetch(url, {
            ...opts,
            method: method.toUpperCase(),
          })
        }

        const body = await resp.body()
        await route.fulfill({
          status: resp.status(),
          headers: resp.headers(),
          body,
        })
      } catch (err) {
        await route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: String(err) }),
        })
      }
    })

    await use(page)
  },
})

export { expect }
