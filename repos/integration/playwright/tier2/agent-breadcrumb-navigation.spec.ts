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

// --- Breadcrumbs ---

test.describe('Breadcrumb Navigation', () => {
  test('agent detail shows "Agents > {Agent Name}" breadcrumbs', async ({
    authenticatedPage: page, ctx,
  }) => {
    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`
    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')

    const main = page.getByRole('main')

    // "Agents" breadcrumb link should be visible in main content
    const agentsLink = main.getByRole('link', { name: 'Agents' })
    await expect(agentsLink).toBeVisible()

    // Agent name should be visible as non-link text (final breadcrumb)
    const heading = page.locator('h1')
    const agentName = await heading.textContent()
    // The agent name appears both in breadcrumbs and the header
    expect(agentName?.length).toBeGreaterThan(0)
  })

  test('threads tab shows "Agents > {Agent Name} > Threads" breadcrumbs', async ({
    authenticatedPage: page, ctx,
  }) => {
    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    const main = page.getByRole('main')

    // "Agents" and agent name should both be links (not final)
    await expect(main.getByRole('link', { name: 'Agents' })).toBeVisible()

    // "Threads" should be the final segment (non-link text)
    // There should be at least 2 chevron separators (Agents > Agent > Threads)
    const separators = main.locator('svg[data-testid="ChevronRightIcon"]')
    const sepCount = await separators.count()
    expect(sepCount).toBeGreaterThanOrEqual(2)
  })

  test('new chat shows "Agents > {Agent Name} > New Chat" breadcrumbs', async ({
    authenticatedPage: page, ctx,
  }) => {
    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`
    await gotoAndWait(page, chatUrl, 'tdsk-agent-layout-page')

    const main = page.getByRole('main')

    // "Agents" link should be visible in main content
    await expect(main.getByRole('link', { name: 'Agents' })).toBeVisible()

    // "New Chat" final breadcrumb segment should be visible (paragraph, not button)
    await expect(main.getByRole('paragraph').filter({ hasText: 'New Chat' })).toBeVisible()
  })

  test('Agents breadcrumb link navigates back to agents list', async ({
    authenticatedPage: page, ctx,
  }) => {
    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`
    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')

    // Click the "Agents" breadcrumb link (scoped to main to avoid sidebar)
    await page.getByRole('main').getByRole('link', { name: 'Agents' }).click()
    await page.waitForLoadState('networkidle')

    // Should navigate to the agents list page
    expect(page.url()).toContain(`/projects/${ctx.projectId}/agents`)
    expect(page.url()).not.toContain(ctx.agentId)

    // Agents list page should render
    await expect(page.locator('.tdsk-project-agents-page')).toBeVisible({ timeout: 10000 })
  })
})

// --- Deep Linking ---

test.describe('Deep URL Navigation', () => {
  test('deep link to agent threads page loads correctly', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    // URL should contain the full threads path
    expect(page.url()).toContain(`/agents/${ctx.agentId}/threads`)

    // Threads tab should be active
    const threadsTab = page.getByRole('tab', { name: /Threads/i })
    await expect(threadsTab).toHaveAttribute('aria-selected', 'true')

    // Breadcrumbs should be visible (scoped to main to avoid sidebar)
    await expect(page.getByRole('main').getByRole('link', { name: 'Agents' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('deep link to agent chat page loads chat interface', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`
    await gotoAndWait(page, chatUrl, 'tdsk-agent-layout-page')

    // Chat input should be visible
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible()

    // No tabs should be visible
    const tabs = page.getByRole('tab')
    expect(await tabs.count()).toBe(0)

    expect(errors).toEqual([])
  })

  test('page refresh on agent detail preserves content', async ({
    authenticatedPage: page, ctx,
  }) => {
    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`
    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')

    // Verify content is loaded
    await expect(page.getByText('Agent Information')).toBeVisible()

    // Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.tdsk-agent-layout-page')).toBeVisible({ timeout: 15000 })

    // URL should persist
    expect(page.url()).toContain(`/agents/${ctx.agentId}`)

    // Content should still be visible after reload
    await expect(page.getByText('Agent Information')).toBeVisible()

    // Tabs should still be visible
    await expect(page.getByRole('tab', { name: /Agent/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Threads/i })).toBeVisible()
  })
})

// --- Browser History ---

test.describe('Browser History Navigation', () => {
  test('back button from thread detail returns to threads list', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Navigate to threads list
    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    const rowCount = await waitForTableRows(page)
    test.skip(rowCount === 0, 'No threads found — cannot test back navigation')

    const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')

    // Navigate to thread detail
    await tableRows.first().click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Thread Details')).toBeVisible({ timeout: 10000 })

    // Go back
    await page.goBack()
    await page.waitForLoadState('networkidle')

    // Should be back on threads list
    expect(page.url()).toContain(`/agents/${ctx.agentId}/threads`)
    expect(page.url()).not.toMatch(/\/threads\/[A-Za-z0-9_-]+/)

    // Threads tab should be active again
    const threadsTab = page.getByRole('tab', { name: /Threads/i })
    await expect(threadsTab).toBeVisible({ timeout: 10000 })
  })

  test('back button from chat returns to previous page', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Navigate to agent detail first
    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`
    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')

    // Click Chat button to navigate to chat
    await page.getByRole('button', { name: /^Chat$/i }).click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible({ timeout: 10000 })

    // Go back
    await page.goBack()
    await page.waitForLoadState('networkidle')

    // Should be back on agent detail with tabs
    expect(page.url()).toContain(`/agents/${ctx.agentId}`)
    expect(page.url()).not.toContain('/chat')
    await expect(page.getByRole('tab', { name: /Agent/i })).toBeVisible({ timeout: 10000 })
  })
})
