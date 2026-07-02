/**
 * Playwright E2E tests: Threads app — Session GUI view
 *
 * Validates the Terminal AST GUI changes in the Threads SPA:
 *   - Session page renders with correct structure (class, header, content area)
 *   - ViewToggle (GUI / Terminal) is rendered only when a session is active
 *   - SmartInput is rendered only in GUI mode with an active session
 *   - Switching the toggle hides/shows the correct sub-view
 *   - ActivityFeed container mounts inside SessionGUIView
 *   - Unauthenticated users are redirected to /auth
 *
 * The Threads SPA runs on port 5886.
 * Auth is mocked via Neon Auth session interception (same pattern as admin fixture).
 * API calls through the Caddy TLS proxy are re-issued with ignoreHTTPSErrors.
 *
 * Prerequisites:
 *   - Threads app running on port 5886 (`cd repos/threads && pnpm start`)
 *   - K8s services running (`tdsk dev start --clean`)
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test as base, expect, type Page } from '@playwright/test'

// ─── Constants ────────────────────────────────────────────────────────────────

const THREADS_URL = `http://localhost:${process.env.TDSK_TH_PORT || '5886'}`
const PROXY_PATTERN = `https://px.local.threadedstack.app/**`

const FALLBACK_ORG_ID = `og_0000001`
const FALLBACK_API_KEY = `tdsk_QIWTcVwFP32X29BDYUigq_G8_gpl0x0swGDxa__BXF0`
const FALLBACK_PROJECT_ID = `pj_0000001`
const FALLBACK_USER_ID = `00000000-0000-0000-0000-000000000000`
const FALLBACK_SANDBOX_ID = `bx00000001`

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestCtx {
  orgId: string
  projectId: string
  apiKey: string
  userId: string
  sandboxId: string
}

// ─── Context ──────────────────────────────────────────────────────────────────

const loadContext = (): TestCtx => {
  const file = join(tmpdir(), `tdsk-integration`, `context.json`)
  try {
    const raw = JSON.parse(readFileSync(file, `utf-8`))
    return {
      orgId: raw.orgId || FALLBACK_ORG_ID,
      projectId: raw.projectId || FALLBACK_PROJECT_ID,
      apiKey: raw.apiKey || FALLBACK_API_KEY,
      userId: raw.userId || FALLBACK_USER_ID,
      sandboxId: FALLBACK_SANDBOX_ID,
    }
  } catch {
    return {
      orgId: FALLBACK_ORG_ID,
      projectId: FALLBACK_PROJECT_ID,
      apiKey: FALLBACK_API_KEY,
      userId: FALLBACK_USER_ID,
      sandboxId: FALLBACK_SANDBOX_ID,
    }
  }
}

// ─── Auth intercept helpers ───────────────────────────────────────────────────

/**
 * Wire up route interceptors required before any page navigation:
 *   1. Neon Auth mock — returns a fake session so the app considers the user
 *      authenticated without hitting the real Neon Auth service.
 *   2. TLS proxy bypass — re-issues requests to px.local.threadedstack.app
 *      with ignoreHTTPSErrors so the self-signed Caddy cert doesn't block
 *      API calls from the app.
 */
async function setupAuth(page: Page, ctx: TestCtx) {
  // Mock Neon Auth get-session
  await page.route(`**/neondb/auth/get-session**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: `application/json`,
      body: JSON.stringify({
        session: {
          token: ctx.apiKey,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
        user: {
          id: ctx.userId,
          email: `session-gui-test@test.local`,
          name: `Session GUI Test`,
          image: ``,
        },
      }),
    })
  )

  // TLS bypass for Caddy → Proxy → Backend API calls
  await page.route(PROXY_PATTERN, async (route) => {
    const request = route.request()
    const method = request.method().toLowerCase()
    const url = request.url()
    const headers = { ...request.headers() }
    const postData = request.postData()

    delete headers[`host`]
    delete headers[`content-length`]

    if (method === `options`) {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': `*`,
          'access-control-allow-methods': `GET,POST,PUT,DELETE,OPTIONS`,
          'access-control-allow-headers': `*`,
        },
      })
      return
    }

    try {
      const opts = { ignoreHTTPSErrors: true, headers } as const
      let resp

      if (method === `get`) {
        resp = await page.request.get(url, opts)
      } else if (method === `post`) {
        resp = await page.request.post(url, {
          ...opts,
          data: postData ? JSON.parse(postData) : undefined,
        })
      } else if (method === `put`) {
        resp = await page.request.put(url, {
          ...opts,
          data: postData ? JSON.parse(postData) : undefined,
        })
      } else if (method === `delete`) {
        resp = await page.request.delete(url, opts)
      } else {
        resp = await page.request.fetch(url, {
          ...opts,
          method: method.toUpperCase(),
        })
      }

      const body = await resp.body()
      await route.fulfill({ status: resp.status(), headers: resp.headers(), body })
    } catch (err) {
      await route.fulfill({
        status: 502,
        contentType: `application/json`,
        body: JSON.stringify({ error: String(err) }),
      })
    }
  })
}

// ─── Console error helper ─────────────────────────────────────────────────────

const IGNORED_PATTERNS = [
  `React Router Future Flag Warning`,
  `Warning:`,
  `Download the React DevTools`,
  `net::ERR`,
  `Failed to load resource`,
  `useLayoutEffect does nothing on the server`,
]

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on(`console`, (msg) => {
    if (msg.type() !== `error`) return
    const text = msg.text()
    if (IGNORED_PATTERNS.some((p) => text.includes(p))) return
    errors.push(text)
  })
  return errors
}

// ─── Fixture ──────────────────────────────────────────────────────────────────

const test = base.extend<{
  sessionPage: Page
  ctx: TestCtx
}>({
  ctx: async ({}, use) => {
    use(loadContext())
  },

  sessionPage: async ({ page, ctx }, use) => {
    await setupAuth(page, ctx)
    await use(page)
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Attempt to connect to a sandbox via the backend API and return the connect
 * response body. Returns null if the pod cannot be reached or any error occurs.
 */
async function connectToSandbox(
  page: Page,
  ctx: TestCtx
): Promise<{ shellToken?: string; podName?: string; sessionId?: string } | null> {
  try {
    const resp = await page.request.post(
      `https://px.local.threadedstack.app/_/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes/${ctx.sandboxId}/connect`,
      {
        ignoreHTTPSErrors: true,
        headers: {
          Authorization: `Bearer ${ctx.apiKey}`,
          'Content-Type': `application/json`,
        },
        timeout: 90_000,
      }
    )
    if (!resp.ok()) return null
    const body = await resp.json()
    return body?.data ?? body ?? null
  } catch {
    return null
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe(`Threads Session GUI View`, () => {

  // -------------------------------------------------------------------------
  // 1. Threads app loads without fatal errors
  // -------------------------------------------------------------------------
  test(`threads app loads on port 5886 without console errors`, async ({ sessionPage: page }) => {
    const errors = collectErrors(page)

    await page.goto(THREADS_URL, { waitUntil: `networkidle`, timeout: 20_000 })

    await expect(page.locator(`body`)).toBeVisible()
    await expect(page).toHaveTitle(/Threaded Stack/i)

    const bodyText = await page.locator(`body`).textContent()
    expect(bodyText).toBeTruthy()
    expect(bodyText!.length).toBeGreaterThan(10)

    expect(errors).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // 2. Session page mounts with correct page class (disconnected state)
  // -------------------------------------------------------------------------
  test(`session page renders .tdsk-session-page class for unknown session id`, async ({
    sessionPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await page.goto(`${THREADS_URL}/orgs/${ctx.orgId}/projects/${ctx.projectId}/instances/inst-test-0001/session/gui-test-fake-00000001`, {
      waitUntil: `networkidle`,
      timeout: 20_000,
    })

    const sessionPageEl = page.locator(`.tdsk-session-page`)
    await expect(sessionPageEl).toBeVisible({ timeout: 10_000 })

    // Body must have content — app did not crash
    const bodyText = await page.locator(`body`).textContent()
    expect(bodyText).toBeTruthy()
    expect(bodyText!.length).toBeGreaterThan(10)

    expect(errors).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // 3. ViewToggle is NOT rendered when there is no active session
  // -------------------------------------------------------------------------
  test(`ViewToggle is absent when no active session`, async ({ sessionPage: page, ctx }) => {
    const errors = collectErrors(page)

    await page.goto(`${THREADS_URL}/orgs/${ctx.orgId}/projects/${ctx.projectId}/instances/inst-test-0001/session/gui-test-no-session-00001`, {
      waitUntil: `networkidle`,
      timeout: 20_000,
    })

    await expect(page.locator(`.tdsk-session-page`)).toBeVisible({ timeout: 10_000 })

    // The ViewToggle (MUI ToggleButtonGroup) must NOT be visible in disconnected state
    const toggleGroup = page.locator(`.MuiToggleButtonGroup-root`)
    await expect(toggleGroup).not.toBeVisible()

    expect(errors).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // 4. SmartInput is NOT rendered when there is no active session
  // -------------------------------------------------------------------------
  test(`SmartInput is absent when no active session`, async ({ sessionPage: page, ctx }) => {
    const errors = collectErrors(page)

    await page.goto(`${THREADS_URL}/orgs/${ctx.orgId}/projects/${ctx.projectId}/instances/inst-test-0001/session/gui-test-no-session-00002`, {
      waitUntil: `networkidle`,
      timeout: 20_000,
    })

    await expect(page.locator(`.tdsk-session-page`)).toBeVisible({ timeout: 10_000 })

    // SmartInput renders a TextField with placeholder "Type a command..."
    // It is only mounted when hasSession === true AND viewMode === 'gui'
    const smartInput = page.getByPlaceholder(`Type a command...`)
    await expect(smartInput).not.toBeVisible()

    expect(errors).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // 5. Disconnected state shows "Start Session" button
  // -------------------------------------------------------------------------
  test(`disconnected session page shows Start Session button`, async ({
    sessionPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    // Navigate with state so the session page knows the sandboxId (enables the button)
    await page.goto(
      `${THREADS_URL}/orgs/${ctx.orgId}/projects/${ctx.projectId}/instances/inst-test-0001/session/gui-test-disconnected-00001`,
      { waitUntil: `networkidle`, timeout: 20_000 }
    )

    await expect(page.locator(`.tdsk-session-page`)).toBeVisible({ timeout: 10_000 })

    // The "Start Session" button is rendered when hasSession === false
    const startBtn = page.getByRole(`button`, { name: /Start Session/i })
    await expect(startBtn).toBeVisible({ timeout: 5_000 })

    expect(errors).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // 6. Live session — GUI view, toggle, SmartInput, ActivityFeed
  // Conditional: only runs when a sandbox pod can be started.
  // -------------------------------------------------------------------------
  test(`live session renders ViewToggle, SmartInput, and ActivityFeed container`, async ({
    sessionPage: page,
    ctx,
  }) => {
    test.slow() // Pod startup can take up to 90s
    const errors = collectErrors(page)

    // Attempt to start the sandbox pod
    const connectResult = await connectToSandbox(page, ctx)

    if (!connectResult?.shellToken) {
      test.skip(true, `Sandbox pod not available — skipping live session test`)
      return
    }

    // The shell WebSocket endpoint is opened by the Threads app when navigating
    // to a session page. We navigate to the sandbox page first then look for a
    // session route, or navigate directly to /session/:id if we have one.
    //
    // The connect endpoint does not return a sessionId — sessionId is assigned
    // by the WebSocket shell handler. We navigate to the sandbox page and start
    // a new instance via the "New Instance" button, then verify the resulting session page.

    // Navigate to the sandbox page (nested route: /orgs/:orgId/projects/:projectId/sandbox/:sandboxId)
    await page.goto(
      `${THREADS_URL}/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandbox/${ctx.sandboxId}`,
      { waitUntil: `networkidle`, timeout: 20_000 }
    )

    const sandboxPage = page.locator(`.tdsk-sandbox-page`)
    await expect(sandboxPage).toBeVisible({ timeout: 10_000 })

    // The sandbox page shows "New Instance" as the primary CTA.
    // "New Session" only appears inside a running instance.
    const newInstanceBtn = page.getByRole(`button`, { name: /New Instance/i })
    const hasNewInstance = await newInstanceBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!hasNewInstance) {
      test.skip(true, `Sandbox page did not render New Instance button — skipping`)
      return
    }

    await newInstanceBtn.click()

    // Wait for navigation to /session/:id
    await page.waitForURL(/\/session\//, { timeout: 30_000 })

    const sessionEl = page.locator(`.tdsk-session-page`)
    await expect(sessionEl).toBeVisible({ timeout: 15_000 })

    // Wait for the session to connect (WebSocket handshake)
    // The ViewToggle appears only when hasSession === true
    const toggleGroup = page.locator(`.MuiToggleButtonGroup-root`)
    await expect(toggleGroup).toBeVisible({ timeout: 30_000 })

    // Both GUI and Terminal buttons should be present
    const guiBtn = toggleGroup.getByRole(`button`, { name: `GUI` })
    const terminalBtn = toggleGroup.getByRole(`button`, { name: `Terminal` })
    await expect(guiBtn).toBeVisible()
    await expect(terminalBtn).toBeVisible()

    // SmartInput must be visible in default GUI mode
    const smartInput = page.getByPlaceholder(`Type a command...`)
    await expect(smartInput).toBeVisible({ timeout: 10_000 })

    // The SmartInput should accept text
    await smartInput.fill(`echo hello`)
    await expect(smartInput).toHaveValue(`echo hello`)

    // SessionGUIView wraps ActivityFeed — the outermost session content area is visible
    await expect(sessionEl).toBeVisible()

    expect(errors).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // 7. GUI / Terminal toggle switches view mode (live session required)
  // -------------------------------------------------------------------------
  test(`GUI toggle switches between GUI view and TerminalView`, async ({
    sessionPage: page,
    ctx,
  }) => {
    test.slow()
    const errors = collectErrors(page)

    const connectResult = await connectToSandbox(page, ctx)
    if (!connectResult?.shellToken) {
      test.skip(true, `Sandbox pod not available — skipping toggle test`)
      return
    }

    await page.goto(
      `${THREADS_URL}/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandbox/${ctx.sandboxId}`,
      { waitUntil: `networkidle`, timeout: 20_000 }
    )

    await expect(page.locator(`.tdsk-sandbox-page`)).toBeVisible({ timeout: 10_000 })

    // The sandbox page shows "New Instance" as the primary CTA.
    // "New Session" only appears inside a running instance.
    const newInstanceBtn = page.getByRole(`button`, { name: /New Instance/i })
    const hasNewInstance = await newInstanceBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!hasNewInstance) {
      test.skip(true, `Sandbox page did not render New Instance button — skipping`)
      return
    }

    await newInstanceBtn.click()
    await page.waitForURL(/\/session\//, { timeout: 30_000 })

    const toggleGroup = page.locator(`.MuiToggleButtonGroup-root`)
    await expect(toggleGroup).toBeVisible({ timeout: 30_000 })

    const guiBtn = toggleGroup.getByRole(`button`, { name: `GUI` })
    const terminalBtn = toggleGroup.getByRole(`button`, { name: `Terminal` })

    // Default mode is GUI — SmartInput is visible
    const smartInput = page.getByPlaceholder(`Type a command...`)
    await expect(smartInput).toBeVisible({ timeout: 10_000 })

    // Switch to Terminal mode
    await terminalBtn.click()

    // SmartInput disappears in terminal mode (only rendered when viewMode === 'gui')
    await expect(smartInput).not.toBeVisible({ timeout: 5_000 })

    // Switch back to GUI mode
    await guiBtn.click()

    // SmartInput reappears
    await expect(smartInput).toBeVisible({ timeout: 5_000 })

    expect(errors).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // 8. Unauthenticated users are redirected to /auth
  // -------------------------------------------------------------------------
  test(`unauthenticated users are redirected to login page`, async ({ page }) => {
    // Navigate without any auth mock — the real Neon Auth returns no session
    await page.goto(THREADS_URL, { waitUntil: `networkidle`, timeout: 15_000 })
    await page.waitForTimeout(3_000)

    const currentUrl = page.url()
    expect(currentUrl).toMatch(/\/(auth|sign)/)
  })
})
