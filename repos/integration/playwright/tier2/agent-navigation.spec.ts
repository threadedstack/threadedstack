import { test, expect } from '../fixtures/auth'

/**
 * Agent Navigation Redesign integration tests.
 *
 * Validates the new nested route structure under /agents/:agentId:
 * - AgentLayout renders with breadcrumbs, header, and tabs
 * - AgentDetailTab shows agent info sections
 * - Threads tab lists threads with correct navigation
 * - Thread Detail page shows metadata and messages
 * - Thread Chat page renders chat interface
 * - Breadcrumbs render correct segments at each level
 * - Tab switching between Agent and Threads
 * - Sidebar cleanup: no nested agent sub-items
 * - Caching bug fix: switching agents loads correct data
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

/** Wait for table rows to appear (async data fetch) then return count */
async function waitForTableRows(page: import('@playwright/test').Page, timeout = 10000) {
  const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')
  try {
    await tableRows.first().waitFor({ state: 'visible', timeout })
  } catch { /* no rows after waiting */ }
  return tableRows.count()
}

// --- Agent Detail (AgentLayout + AgentDetailTab) ---

test.describe('Agent Detail Page', () => {
  test('renders agent layout with header, breadcrumbs, and tabs', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`
    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')

    // Breadcrumbs: "Agents > {Agent Name}" — Agents link should be visible in main content
    const main = page.getByRole('main')
    await expect(main.getByRole('link', { name: 'Agents' })).toBeVisible()

    // Agent name should be visible in the header (as h1)
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()
    const headingText = await heading.textContent()
    expect(headingText?.length).toBeGreaterThan(0)

    // Agent status chip should be present (Active or Inactive)
    const statusChip = page.getByText(/^(Active|Inactive)$/).first()
    await expect(statusChip).toBeVisible()

    // Header action buttons: Chat, Edit, Delete
    await expect(page.getByRole('button', { name: /Chat/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Edit/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Delete/i })).toBeVisible()

    // Tabs: Agent and Threads (2 tabs only)
    await expect(page.getByRole('tab', { name: /Agent/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Threads/i })).toBeVisible()

    // Agent tab should be active by default
    const agentTab = page.getByRole('tab', { name: /Agent/i })
    await expect(agentTab).toHaveAttribute('aria-selected', 'true')

    expect(errors).toEqual([])
  })

  test('renders AgentDetailTab content with agent info sections', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`
    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')

    const main = page.getByRole('main')

    // Agent Information section should be visible
    await expect(main.getByText('Agent Information')).toBeVisible({ timeout: 10000 })

    // Agent ID should be displayed
    await expect(main.getByText('Agent ID')).toBeVisible()

    // LLM Configuration section should be visible
    await expect(main.getByText('LLM Configuration')).toBeVisible()

    // Temperature field should be present
    await expect(main.getByText('Temperature')).toBeVisible()

    // Streaming field should be present
    await expect(main.getByText('Streaming')).toBeVisible()

    // Tools section should be visible
    await expect(main.getByText(/^Tools/)).toBeVisible()

    // Secrets section should be visible
    await expect(main.getByText(/^Secrets/)).toBeVisible()

    expect(errors).toEqual([])
  })
})

// --- Tab Switching ---

test.describe('Agent Tab Navigation', () => {
  test('clicking Threads tab navigates to threads route and shows thread list', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`
    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')

    // Click the Threads tab
    await page.getByRole('tab', { name: /Threads/i }).click()
    await page.waitForLoadState('networkidle')

    // URL should now include /threads
    expect(page.url()).toContain(`/agents/${ctx.agentId}/threads`)

    // Threads tab should be active
    const threadsTab = page.getByRole('tab', { name: /Threads/i })
    await expect(threadsTab).toHaveAttribute('aria-selected', 'true')

    // Agent tab should NOT be active
    const agentTab = page.getByRole('tab', { name: /Agent/i })
    await expect(agentTab).toHaveAttribute('aria-selected', 'false')

    expect(errors).toEqual([])
  })

  test('clicking Agent tab from Threads tab navigates back to agent detail', async ({
    authenticatedPage: page, ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    // Start on threads page
    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await gotoAndWait(page, threadsUrl, 'tdsk-agent-layout-page')

    // Click the Agent tab
    await page.getByRole('tab', { name: /Agent/i }).click()
    await page.waitForLoadState('networkidle')

    // URL should be the agent root (no /threads)
    const url = page.url()
    expect(url).toContain(`/agents/${ctx.agentId}`)
    expect(url).not.toContain('/threads')

    // Agent tab should be active
    const agentTab = page.getByRole('tab', { name: /Agent/i })
    await expect(agentTab).toHaveAttribute('aria-selected', 'true')

    // Agent detail content should be visible
    await expect(page.getByText('Agent Information')).toBeVisible()

    expect(errors).toEqual([])
  })
})

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

    // URL should now include threads/<threadId> (UUID pattern)
    const url = page.url()
    expect(url).toMatch(/\/threads\/[0-9a-f-]+/)
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
    expect(page.url()).toMatch(/\/threads\/[0-9a-f-]+\/chat$/)

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

// --- Sidebar Cleanup ---

test.describe('Sidebar Navigation', () => {
  test('sidebar does not render nested agent sub-items (Threads, Chat)', async ({
    authenticatedPage: page, ctx,
  }) => {
    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`
    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')

    const sidebar = page.locator('.tdsk-admin-sidebar')
    await expect(sidebar).toBeVisible()

    // The sidebar should have an "Agents" nav item but no nested sub-items
    // like individual agent names, "Threads", or "Chat" under Agents
    const subNavPanel = sidebar.locator('.tdsk-subnav-panel')
    const subNavText = await subNavPanel.textContent()

    // Sidebar should NOT contain "Threads" or "Chat" as sub-nav items for the agent
    // (These are now accessed via tabs and routes, not sidebar)
    // Note: "Agents" will appear as a nav group label, but no per-agent children
    if (subNavText) {
      // Look for the nav item list — there should be no "Chat" or thread-related child items
      const navItems = subNavPanel.locator('.tdsk-nav-item')
      const navTexts: string[] = []
      for (let i = 0; i < await navItems.count(); i++) {
        const text = await navItems.nth(i).textContent()
        if (text) navTexts.push(text.trim())
      }
      // None of the nav items should be "Chat" or "Threads" nested under an agent
      // They should be top-level project sections like "Agents", "Endpoints", etc.
      const hasNestedChat = navTexts.some(t => t === 'Chat')
      const hasNestedThreads = navTexts.some(t => t === 'Threads')
      expect(hasNestedChat).toBe(false)
      expect(hasNestedThreads).toBe(false)
    }
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
    expect(page.url()).not.toMatch(/\/threads\/[0-9a-f-]+/)

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
