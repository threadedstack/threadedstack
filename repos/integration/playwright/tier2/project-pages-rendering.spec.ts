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
  timeout = 10000
) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await expect(page.locator(`.${pageClass}`)).toBeVisible({ timeout })
}

test.describe('Project Pages', () => {
  test('Projects list - renders Projects heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects`, 'tdsk-projects-page')

    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Project detail - renders project page', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}`, 'tdsk-project-workspace-page')

    // ProjectWorkspace renders quick actions and sandbox/thread panels
    await expect(page.getByRole('button', { name: /New Sandbox/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Connect/i })).toBeVisible()
    await expect(page.getByText('Recent Threads')).toBeVisible()

    // Verify the page contains project-related content
    expect(page.url()).toContain(`/orgs/${ctx.orgId}/projects/${ctx.projectId}`)

    expect(errors).toEqual([])
  })

  test('Project Endpoints - renders Endpoints heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`, 'tdsk-project-endpoints-page')

    await expect(page.getByRole('heading', { name: 'Endpoints' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Project Functions - renders Functions heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`, 'tdsk-project-functions-page')

    // The Functions component renders title "Project Functions"
    await expect(page.getByRole('heading', { name: /Functions/i })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Project Agents - renders AI Agents heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents`, 'tdsk-project-agents-page')

    await expect(page.getByRole('heading', { name: 'AI Agents' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Agent Threads - renders Threads heading inside agent layout', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`, 'tdsk-agent-layout-page')

    await expect(page.getByRole('heading', { name: 'Threads' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Project Members - renders Project Members heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/members`, 'tdsk-project-members-page')

    await expect(page.getByRole('heading', { name: 'Project Members' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Agent Chat - renders chat input', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`, 'tdsk-agent-layout-page')

    // Chat page renders a text input with placeholder "Type a message..."
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible()

    // The agent name heading (h1) should be visible in the agent layout
    await expect(page.locator('h1').first()).toBeVisible()

    expect(errors).toEqual([])
  })
})
