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
