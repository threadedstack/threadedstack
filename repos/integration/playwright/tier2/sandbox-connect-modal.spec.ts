import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  collectErrors,
  apiRequest,
  apiDeleteResource,
  searchInPage,
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-sandboxes-page'

test.describe.serial('Sandbox Connect Modal', () => {
  let sandboxId: string | undefined
  let sandboxName: string | undefined

  test.beforeAll(async ({ browser }) => {
    // Create a sandbox via API for testing the connect modal
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const setupPage = await context.newPage()
    try {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const ctx = JSON.parse(
        readFileSync(
          join(tmpdir(), 'tdsk-integration', 'context.json'),
          'utf-8'
        )
      )

      if (!ctx.projectId) return

      const ts = Date.now().toString(36)
      const rand = Math.random().toString(36).substring(2, 6)
      sandboxName = `pw-connect-${ts}-${rand}`

      const res = await apiRequest(setupPage, 'POST', `/orgs/${ctx.orgId}/sandboxes`, ctx.apiKey, {
        name: sandboxName,
        projectId: ctx.projectId,
        config: {
          image: 'node:22-slim',
          sshEnabled: true,
        },
      })

      const body = await res.json()
      const data = body?.data || body
      if (data?.id) sandboxId = data.id as string
    } catch {
      // Setup failure will cause tests to skip
    } finally {
      await context.close()
    }
  })

  test('Connect button opens modal with SSH command', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId || !sandboxName, 'No sandbox — setup must have failed')
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)

    // Intercept the connect API call with a mock response
    await page.route(`**/sandboxes/${sandboxId}/connect`, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              podName: 'tdsk-sb-test-pod',
              password: 'test-pass-123',
              port: 2222,
              sandboxId,
              command: `tsa ssh ${sandboxId}`,
            },
          }),
        })
      }
      return route.continue()
    })

    // Intercept the sessions API call with an empty response
    await page.route(`**/sandboxes/${sandboxId}/sessions`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      }
      return route.continue()
    })

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    // Search for the sandbox
    await searchInPage(page, sandboxName!)

    // Find the row and click the Connect icon button
    const row = page.locator('tr', { has: page.getByText(sandboxName!) })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // The connect button uses ActionIconButton with tooltip 'Connect to Sandbox'
    const connectButton = row.locator('.MuiIconButton-colorSuccess').first()
    await connectButton.click()

    // Verify the connect dialog appears
    const dialog = page.locator('.MuiDialog-root')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Verify the dialog title contains the sandbox name
    await expect(dialog.getByText(`Connect to "${sandboxName}"`)).toBeVisible({ timeout: 5_000 })

    // Verify the SSH command is displayed
    await expect(dialog.getByText(`tsa ssh ${sandboxId}`)).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Modal shows VS Code Remote SSH Config', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId || !sandboxName, 'No sandbox — setup must have failed')
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)

    // Set up route interception before navigation
    await page.route(`**/sandboxes/${sandboxId}/connect`, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              podName: 'tdsk-sb-test-pod',
              password: 'test-pass-123',
              port: 2222,
              sandboxId,
              command: `tsa ssh ${sandboxId}`,
            },
          }),
        })
      }
      return route.continue()
    })

    await page.route(`**/sandboxes/${sandboxId}/sessions`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      }
      return route.continue()
    })

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, sandboxName!)

    const row = page.locator('tr', { has: page.getByText(sandboxName!) })
    await expect(row).toBeVisible({ timeout: 10_000 })
    const connectButton = row.locator('.MuiIconButton-colorSuccess').first()
    await connectButton.click()

    // Wait for dialog
    const dialog = page.locator('.MuiDialog-root')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Verify VS Code Remote SSH Config section is present
    await expect(dialog.getByText('VS Code Remote SSH Config')).toBeVisible({ timeout: 5_000 })

    // Verify the ProxyCommand is shown in the config
    await expect(dialog.getByText('ProxyCommand tsa proxy %h')).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Modal shows session count', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId || !sandboxName, 'No sandbox — setup must have failed')
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)

    // Intercept connect with mock data
    await page.route(`**/sandboxes/${sandboxId}/connect`, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              podName: 'tdsk-sb-test-pod',
              password: 'test-pass-123',
              port: 2222,
              sandboxId,
              command: `tsa ssh ${sandboxId}`,
            },
          }),
        })
      }
      return route.continue()
    })

    // Intercept sessions with one active session
    await page.route(`**/sandboxes/${sandboxId}/sessions`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                sessionId: 'sess-001',
                podName: 'tdsk-sb-test-pod',
                sandboxId,
                orgId: ctx.orgId,
                userId: ctx.userId,
                connectedAt: '2026-01-01T00:00:00Z',
              },
            ],
          }),
        })
      }
      return route.continue()
    })

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, sandboxName!)

    const row = page.locator('tr', { has: page.getByText(sandboxName!) })
    await expect(row).toBeVisible({ timeout: 10_000 })
    const connectButton = row.locator('.MuiIconButton-colorSuccess').first()
    await connectButton.click()

    // Wait for dialog
    const dialog = page.locator('.MuiDialog-root')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Verify session count is displayed in the heading
    await expect(dialog.getByText('Active Sessions (1)')).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Close button closes modal', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId || !sandboxName, 'No sandbox — setup must have failed')
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)

    // Set up route interception
    await page.route(`**/sandboxes/${sandboxId}/connect`, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              podName: 'tdsk-sb-test-pod',
              password: 'test-pass-123',
              port: 2222,
              sandboxId,
              command: `tsa ssh ${sandboxId}`,
            },
          }),
        })
      }
      return route.continue()
    })

    await page.route(`**/sandboxes/${sandboxId}/sessions`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      }
      return route.continue()
    })

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, sandboxName!)

    const row = page.locator('tr', { has: page.getByText(sandboxName!) })
    await expect(row).toBeVisible({ timeout: 10_000 })
    const connectButton = row.locator('.MuiIconButton-colorSuccess').first()
    await connectButton.click()

    // Wait for dialog to be visible
    const dialog = page.locator('.MuiDialog-root')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Click the Close button in the dialog actions
    const closeButton = dialog.getByRole('button', { name: /Close/i })
    await expect(closeButton).toBeVisible({ timeout: 3_000 })
    await closeButton.click()

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  // Safety-net cleanup
  test.afterAll(async ({ browser }) => {
    if (!sandboxId) return
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const cleanupPage = await context.newPage()
    try {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const ctx = JSON.parse(
        readFileSync(
          join(tmpdir(), 'tdsk-integration', 'context.json'),
          'utf-8'
        )
      )
      await apiDeleteResource(
        cleanupPage,
        `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
        ctx.apiKey
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
