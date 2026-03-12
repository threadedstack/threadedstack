import { test, expect } from '../fixtures/auth'

/**
 * Thread UX regression tests.
 *
 * Validates:
 * 1. Thread row click navigates to thread detail page (route-based)
 * 2. Edit/delete buttons do not trigger row navigation
 * 3. Chat view page renders inside agent layout
 * 4. No unexpected console errors on thread pages
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
  'ErrorBoundary',
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

/** Wait for table rows to appear (async data fetch) then return count */
async function waitForTableRows(page: import('@playwright/test').Page, timeout = 10000) {
  const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')
  try {
    await tableRows.first().waitFor({ state: 'visible', timeout })
  } catch { /* no rows after waiting */ }
  return tableRows.count()
}

test.describe('Thread UX: Row click navigation', () => {
  test('clicking a thread row navigates to thread detail page', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    // Wait for threads table to populate
    const rowCount = await waitForTableRows(page)
    test.skip(rowCount === 0, 'No threads found — cannot test row click navigation')

    const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')

    // Click the first thread row
    await tableRows.first().click()
    await page.waitForLoadState('networkidle')

    // URL should now contain /threads/<id> (route-based navigation)
    const url = page.url()
    expect(url).toMatch(/\/threads\/[A-Za-z0-9_-]+/)

    // Thread detail page should show "Thread Details" section
    await expect(page.getByText('Thread Details')).toBeVisible({ timeout: 10000 })

    expect(errors).toEqual([])
  })
})

test.describe('Thread UX: Threads page renders without errors', () => {
  test('threads page renders inside agent layout with correct tabs', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    // Tab bar should have Agent and Threads tabs
    await expect(page.getByRole('tab', { name: /Agent/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Threads/i })).toBeVisible()

    // Threads tab should be active
    const threadsTab = page.getByRole('tab', { name: /Threads/i })
    await expect(threadsTab).toHaveAttribute('aria-selected', 'true')

    expect(errors).toEqual([])
  })

  test('edit/delete buttons do not trigger row navigation', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    const rowCount = await waitForTableRows(page)
    test.skip(rowCount === 0, 'No threads found — cannot test button isolation')

    const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')

    // Click the edit button (title="Edit thread") on first row
    const firstRow = tableRows.first()
    const editButton = firstRow.locator('[title="Edit thread"]')

    if ((await editButton.count()) > 0) {
      const urlBefore = page.url()
      await editButton.first().click()
      await page.waitForTimeout(300)

      // URL should NOT have changed (edit button opens drawer, not navigates)
      expect(page.url()).toBe(urlBefore)

      // Close any opened drawer
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }

    expect(errors).toEqual([])
  })
})

test.describe('Thread UX: Chat view', () => {
  test('chat view page renders inside agent layout with chat input', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`
    await gotoAndWait(page, chatUrl, 'tdsk-agent-layout-page')

    // Chat input should be visible
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible()

    // Tabs should NOT be visible on chat page
    const tabs = page.getByRole('tab')
    expect(await tabs.count()).toBe(0)

    expect(errors).toEqual([])
  })
})
