import { test as base, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export interface TestContext {
  orgId: string
  orgName: string
  apiKey: string
  userId: string
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
 * Extended Playwright test fixture that provides an `authenticatedPage`.
 *
 * The fixture intercepts the Neon Auth session endpoint BEFORE any navigation
 * so the admin SPA receives a valid session with the test API key as the token.
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
    // Intercept Neon Auth BEFORE any navigation
    await page.route('**/neondb/auth/get-session**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(buildNeonAuthMock(ctx)),
      })
    )

    await use(page)
  },
})

export { expect }
