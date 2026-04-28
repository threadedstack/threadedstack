import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { mkdirSync, existsSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Standalone Playwright script that captures screenshots of the Admin and
 * Threads web apps for documentation images.
 *
 * Auth pattern mirrors repos/integration/playwright/fixtures/auth.ts:
 *   1. Mock Neon Auth session endpoint to inject a Bearer token
 *   2. Intercept Caddy proxy requests and re-issue with ignoreHTTPSErrors
 *
 * Usage:
 *   TDSK_IT_API_KEY=<key> TDSK_IT_ORG_ID=<org> npx tsx scripts/capture-screenshots.ts
 */

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/**
 * TODO: update this to load ENVs from values.yaml files
 */
const API_KEY = process.env.TDSK_IT_API_KEY
const ORG_ID = process.env.TDSK_IT_ORG_ID
const PROJECT_ID = process.env.TDSK_IT_PROJECT_ID
const USER_ID = process.env.TDSK_IT_USER_ID ?? 'screenshot-user'

const ADMIN_URL = (process.env.TDSK_IT_ADMIN_URL ?? 'http://localhost:5887').replace(
  /\/+$/,
  ''
)

const THREADS_URL = (process.env.TDSK_IT_THREADS_URL ?? 'http://localhost:5889').replace(
  /\/+$/,
  ''
)

if (!API_KEY || !ORG_ID) {
  console.error('ERROR: TDSK_IT_API_KEY and TDSK_IT_ORG_ID env vars are required.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Output directory  (monorepo root)/docs/user-guide/images/
// ---------------------------------------------------------------------------

const MONOREPO_ROOT = resolve(__dirname, '..', '..', '..')
const OUTPUT_DIR = resolve(MONOREPO_ROOT, 'docs', 'user-guide', 'images')

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  console.log(`Created output directory: ${OUTPUT_DIR}`)
}

// ---------------------------------------------------------------------------
// Auth helpers (mirrors integration test fixtures)
// ---------------------------------------------------------------------------

const PROXY_PATTERN = 'https://px.local.threadedstack.app/**'

const buildNeonAuthMock = () => ({
  session: {
    token: API_KEY,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
  user: {
    id: USER_ID,
    email: 'screenshot@threadedstack.local',
    name: 'Screenshot Bot',
    image: '',
  },
})

/**
 * Install auth interceptors on a Playwright Page:
 *   - Mock Neon Auth get-session endpoint
 *   - Bypass self-signed Caddy TLS for proxy requests
 */
async function setupAuth(page: import('playwright').Page) {
  // 1. Neon Auth mock
  await page.route('**/neondb/auth/get-session**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(buildNeonAuthMock()),
    })
  )

  // 2. TLS proxy bypass
  await page.route(PROXY_PATTERN, async (route) => {
    const request = route.request()
    const method = request.method().toLowerCase()
    const url = request.url()
    const headers = { ...request.headers() }
    const postData = request.postData()

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
}

// ---------------------------------------------------------------------------
// Screenshot helper
// ---------------------------------------------------------------------------

async function capture(
  page: import('playwright').Page,
  url: string,
  filename: string,
  opts?: { skipAuth?: boolean }
) {
  const outPath = resolve(OUTPUT_DIR, filename)
  console.log(`Navigating to ${url} ...`)

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  } catch {
    // networkidle can time out on pages with long-polling; fall back to load
    console.log(`  networkidle timed out for ${filename}, using current state`)
  }

  // Extra settle time for client-side rendering
  await page.waitForTimeout(1200)

  await page.screenshot({ path: outPath, fullPage: false })
  console.log(`  Saved ${filename}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  })

  try {
    // ------------------------------------------------------------------
    // Admin screenshots
    // ------------------------------------------------------------------

    // Login page (no auth interceptors)
    {
      const page = await context.newPage()
      await capture(page, ADMIN_URL, 'admin-login.png', { skipAuth: true })
      await page.close()
    }

    // Authenticated admin pages
    {
      const page = await context.newPage()
      await setupAuth(page)

      await capture(page, `${ADMIN_URL}/orgs/${ORG_ID}`, 'admin-org-dashboard.png')

      await capture(page, `${ADMIN_URL}/orgs/${ORG_ID}/agents`, 'admin-agent-config.png')

      await capture(
        page,
        `${ADMIN_URL}/orgs/${ORG_ID}/providers`,
        'admin-provider-config.png'
      )

      if (PROJECT_ID) {
        await capture(
          page,
          `${ADMIN_URL}/orgs/${ORG_ID}/projects/${PROJECT_ID}/settings`,
          'admin-project-settings.png'
        )
      } else {
        console.log('  Skipping admin-project-settings.png (no TDSK_IT_PROJECT_ID)')
      }

      await capture(
        page,
        `${ADMIN_URL}/orgs/${ORG_ID}/sandboxes`,
        'admin-sandbox-list.png'
      )

      // Try to click into the first sandbox for a config screenshot
      try {
        const firstLink = page.locator('a[href*="/sandboxes/"]').first()
        if (await firstLink.isVisible({ timeout: 3000 })) {
          await firstLink.click()
          await page.waitForLoadState('networkidle').catch(() => {})
          await page.waitForTimeout(1200)
          await page.screenshot({
            path: resolve(OUTPUT_DIR, 'admin-sandbox-config.png'),
            fullPage: false,
          })
          console.log('  Saved admin-sandbox-config.png')
        } else {
          console.log('  Skipping admin-sandbox-config.png (no sandbox links visible)')
        }
      } catch {
        console.log('  Skipping admin-sandbox-config.png (could not find sandbox link)')
      }

      await page.close()
    }

    // ------------------------------------------------------------------
    // Threads screenshots
    // ------------------------------------------------------------------

    // Login page (no auth interceptors)
    {
      const page = await context.newPage()
      await capture(page, THREADS_URL, 'threads-login.png', {
        skipAuth: true,
      })
      await page.close()
    }

    // Authenticated threads home
    {
      const page = await context.newPage()
      await setupAuth(page)
      await capture(page, THREADS_URL, 'threads-home.png')
      await page.close()
    }

    console.log('\nAll screenshots captured successfully.')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err)
  process.exit(1)
})
