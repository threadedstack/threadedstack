import { test, expect } from '../fixtures/auth'
import { isFeatureEnabled } from '@tdsk/domain'

/**
 * Agent Layout extended tabs integration tests.
 *
 * Validates the 3-tab AgentLayout (Agent, Threads, Skills).
 * Schedules were migrated from agent-scoped to project/sandbox-scoped,
 * so the AgentLayout no longer renders a Schedules tab — that behavior
 * is asserted here and schedule UI coverage lives in schedules-page.spec.ts.
 * Tests tab rendering, navigation, deep links, tab persistence on
 * refresh, and that tabs are hidden on chat/thread detail pages.
 *
 * Does NOT duplicate agent-navigation.spec.ts tests for Agent/Threads
 * tabs, breadcrumbs, or sidebar behavior.
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
  timeout = 15000
) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await expect(page.locator(`.${pageClass}`)).toBeVisible({ timeout })
}

/**
 * Wait for agent data to load.
 * The AgentLayout renders `.tdsk-agent-layout-page` immediately for both
 * "Agent not found" and loaded states. Tabs only render after agent data
 * loads. We wait for the h1 heading (agent name) which confirms data loaded.
 */
async function waitForAgentLoaded(
  page: import('@playwright/test').Page,
  timeout = 15000
) {
  await expect(page.locator('h1').first()).toBeVisible({ timeout })
}

function collectConsoleErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
  })
  return errors
}

test.describe('Agent Layout Extended Tabs', () => {
  const hasSkills = isFeatureEnabled('skills')

  test.beforeEach(({}, testInfo) => {
    test.skip(!hasSkills, 'skills feature flag is disabled')
  })

  test('agent layout renders all 3 tabs', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectConsoleErrors(page)
    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`

    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')
    await waitForAgentLoaded(page)

    await expect(page.getByRole('tab', { name: /^Agent$/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /^Threads$/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /^Skills$/i })).toBeVisible()

    const tabs = page.getByRole('tab')
    expect(await tabs.count()).toBe(3)

    expect(errors).toEqual([])
  })

  test('clicking Skills tab navigates to /skills route', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`
    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')
    await waitForAgentLoaded(page)

    await page.getByRole('tab', { name: /^Skills$/i }).click()
    await page.waitForLoadState('networkidle')

    expect(page.url()).toContain('/skills')
    await expect(page.getByRole('tab', { name: /^Skills$/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByRole('tab', { name: /^Agent$/i })).toHaveAttribute(
      'aria-selected',
      'false'
    )
  })

  test('Schedules tab is not rendered (schedules are project-scoped)', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const agentUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}`
    await gotoAndWait(page, agentUrl, 'tdsk-agent-layout-page')
    await waitForAgentLoaded(page)

    // Schedules moved from agent-scoped to project/sandbox-scoped execution,
    // so the AgentLayout must NOT render a Schedules tab anymore
    await expect(page.getByRole('tab', { name: /^Schedules$/i })).toHaveCount(0)
  })

  test('deep link to /agents/:id/skills loads with Skills tab active', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const skillsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/skills`
    await gotoAndWait(page, skillsUrl, 'tdsk-agent-layout-page')
    await waitForAgentLoaded(page)

    await expect(page.getByRole('tab', { name: /^Skills$/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByRole('tab', { name: /^Agent$/i })).toHaveAttribute(
      'aria-selected',
      'false'
    )
    expect(page.url()).toContain('/skills')
  })

  test('switching from Skills tab back to Agent tab works', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const skillsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/skills`
    await gotoAndWait(page, skillsUrl, 'tdsk-agent-layout-page')
    await waitForAgentLoaded(page)

    await page.getByRole('tab', { name: /^Agent$/i }).click()
    await page.waitForLoadState('networkidle')

    expect(page.url()).not.toContain('/skills')
    expect(page.url()).not.toContain('/threads')
    expect(page.url()).not.toContain('/schedules')
    await expect(page.getByRole('tab', { name: /^Agent$/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  test('tabs hidden on chat page (4-tab behavior preserved)', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`
    await gotoAndWait(page, chatUrl, 'tdsk-agent-layout-page')

    // Wait for chat view to load (agent data + chat UI)
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible({ timeout: 15000 })

    const tabs = page.getByRole('tab')
    expect(await tabs.count()).toBe(0)
  })

  test('page refresh on Skills tab preserves tab state', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const skillsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/skills`
    await gotoAndWait(page, skillsUrl, 'tdsk-agent-layout-page')
    await waitForAgentLoaded(page)

    await expect(page.getByRole('tab', { name: /^Skills$/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.tdsk-agent-layout-page')).toBeVisible({ timeout: 15000 })
    await waitForAgentLoaded(page)

    expect(page.url()).toContain('/skills')
    await expect(page.getByRole('tab', { name: /^Skills$/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })
})
