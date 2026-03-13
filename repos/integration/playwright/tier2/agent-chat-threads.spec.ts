import { test, expect } from '../fixtures/auth'

const ignoredPatterns = [
  'Function components cannot be given refs',
  'useLayoutEffect does nothing on the server',
  'Download the React DevTools',
  'React does not recognize',
  'Warning:',
  'Failed to load resource',
  'net::ERR_',
  '404',
  'ErrorBoundary',
]

const isIgnored = (text: string): boolean =>
  ignoredPatterns.some((p) => text.includes(p))

async function gotoAndWait(
  page: import('@playwright/test').Page,
  url: string,
  pageClass: string,
  timeout = 15000
) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await expect(page.locator(`.${pageClass}`)).toBeVisible({ timeout })
}

function collectConsoleErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
  })
  return errors
}

async function waitForTableRows(page: import('@playwright/test').Page, timeout = 10000) {
  const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')
  try {
    await tableRows.first().waitFor({ state: 'visible', timeout })
  } catch { /* no rows after waiting */ }
  return tableRows.count()
}

// --- Chat Page (New Chat) ---

test.describe('Agent Chat Page', () => {
  test('navigating to /chat renders chat interface without tabs', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`
    await gotoAndWait(page, chatUrl, 'tdsk-agent-layout-page')

    // Chat input should be visible
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible()

    // Tabs should NOT be visible (chat page hides them)
    const tabs = page.getByRole('tab')
    const tabCount = await tabs.count()
    expect(tabCount).toBe(0)

    // "New Chat" button should be visible in the chat header
    await expect(page.getByRole('button', { name: /New Chat/i })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Chat button in header navigates to chat page', async ({
    authenticatedPage: page, ctx,
  }) => {
    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`
    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')

    // Click the "Chat" button in the agent header
    await page.getByRole('button', { name: /^Chat$/i }).click()
    await page.waitForLoadState('networkidle')

    // Should navigate to the chat route
    expect(page.url()).toContain(`/agents/${ctx.agentId}/chat`)

    // Chat input should be visible
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible({ timeout: 10000 })
  })
})

// --- Threads Tab Content ---

test.describe('Threads Tab', () => {
  test('threads tab renders thread list or empty state', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    // Either a table with threads or an empty state should be visible
    const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')
    const rowCount = await tableRows.count()

    if (rowCount === 0) {
      // Empty state or "No threads" message should be present
      const body = await page.locator('body').textContent()
      expect(body?.toLowerCase()).toMatch(/(no threads|create|empty|get started)/)
    } else {
      // Table should have at least one row
      expect(rowCount).toBeGreaterThan(0)
    }

    expect(errors).toEqual([])
  })

  test('clicking a thread row navigates to thread detail page', async ({
    authenticatedPage: page, ctx,
  }) => {
    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    const rowCount = await waitForTableRows(page)
    test.skip(rowCount === 0, 'No threads found — cannot test row click')

    const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')

    // Click the first thread row
    await tableRows.first().click()
    await page.waitForLoadState('networkidle')

    // URL should now include threads/<threadId> (nanoid pattern)
    const url = page.url()
    expect(url).toMatch(/\/threads\/[A-Za-z0-9_-]+/)
    // Should NOT include /chat (detail page, not chat)
    expect(url).not.toMatch(/\/chat$/)

    // Thread detail page should be visible — look for "Thread Details" section
    await expect(page.getByText('Thread Details')).toBeVisible({ timeout: 10000 })
  })
})

// --- Thread Detail Page ---

test.describe('Thread Detail Page', () => {
  test('deep link to thread detail renders metadata and messages', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    // First navigate to threads to find a thread ID
    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    const rowCount = await waitForTableRows(page)
    test.skip(rowCount === 0, 'No threads found — cannot test thread detail')

    const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')

    // Click first thread to navigate to detail
    await tableRows.first().click()
    await page.waitForLoadState('networkidle')

    // Thread Details section should be visible
    await expect(page.getByText('Thread Details')).toBeVisible({ timeout: 10000 })

    // Thread ID label should be visible
    await expect(page.getByText('Thread ID')).toBeVisible()

    // Provider label should be visible
    await expect(page.getByRole('heading', { name: 'Provider' })).toBeVisible()

    // Created date should be visible
    await expect(page.getByText('Created')).toBeVisible()

    // "Continue Chat" button should be visible
    await expect(page.getByRole('button', { name: /Continue Chat/i })).toBeVisible()

    // "Edit Thread" button should be visible
    await expect(page.getByRole('button', { name: /Edit Thread/i })).toBeVisible()

    // Messages section should be visible
    await expect(page.getByText(/^Messages/)).toBeVisible()

    // Tabs should NOT be visible (thread detail hides them)
    const tabs = page.getByRole('tab')
    const tabCount = await tabs.count()
    expect(tabCount).toBe(0)

    expect(errors).toEqual([])
  })

  test('Continue Chat button navigates to thread chat page', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Navigate to threads list first
    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    const rowCount = await waitForTableRows(page)
    test.skip(rowCount === 0, 'No threads found — cannot test Continue Chat')

    const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')

    // Navigate to thread detail
    await tableRows.first().click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Thread Details')).toBeVisible({ timeout: 10000 })

    // Click "Continue Chat"
    await page.getByRole('button', { name: /Continue Chat/i }).click()
    await page.waitForLoadState('networkidle')

    // URL should now end with /chat
    expect(page.url()).toMatch(/\/threads\/[A-Za-z0-9_-]+\/chat$/)

    // Chat input should be visible
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible({ timeout: 10000 })
  })

  test('thread detail breadcrumbs show full path: Agents > Agent > Threads > Thread', async ({
    authenticatedPage: page, ctx,
  }) => {
    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    const rowCount = await waitForTableRows(page)
    test.skip(rowCount === 0, 'No threads found — cannot test breadcrumbs')

    const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')
    await tableRows.first().click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Thread Details')).toBeVisible({ timeout: 10000 })

    const main = page.getByRole('main')

    // Breadcrumbs should include "Agents" link, "Threads" link
    await expect(main.getByRole('link', { name: 'Agents' })).toBeVisible()
    await expect(main.getByRole('link', { name: 'Threads' })).toBeVisible()

    // Should have at least 3 chevron separators (Agents > Agent > Threads > Thread)
    const separators = main.locator('svg[data-testid="ChevronRightIcon"]')
    const sepCount = await separators.count()
    expect(sepCount).toBeGreaterThanOrEqual(3)
  })
})
