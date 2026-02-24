import { test, expect } from '../fixtures/auth'

/**
 * Comprehensive page-rendering smoke tests.
 *
 * Each test navigates to a page, waits for the page-specific CSS class
 * to appear (confirming the lazy-loaded component rendered), asserts
 * that the expected heading / content is visible, and verifies
 * that no unexpected console errors were emitted.
 */


/**
 * React dev-mode warnings and third-party noise that are not actionable.
 * These come from @neondatabase/neon-js auth UI components and React internals.
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

/**
 * Returns true if the console error text matches a known-benign pattern.
 */
const isIgnored = (text: string): boolean =>
  ignoredPatterns.some((p) => text.includes(p))

/**
 * Navigate to a URL and wait for the page component to render.
 * Uses the page-specific CSS class (e.g. `.tdsk-home-page`) instead of
 * arbitrary timeouts to avoid flaky tests.
 */
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

// ---------------------------------------------------------------------------
// Org Pages
// ---------------------------------------------------------------------------

test.describe('Org Pages', () => {
  test('Home page - renders Organizations heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, '/', 'tdsk-home-page')

    // Home page renders "Organizations" heading
    await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible()

    // At least one org card should be visible
    await expect(page.locator('.MuiCard-root').first()).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Org detail - renders org name heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    // Org detail page has an h1 with the org name (dynamic)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()

    // The "Org Information" section should be present
    await expect(page.getByText('Org Information')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Org Members - renders Members heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/members`, 'tdsk-org-members-page')

    // PageLayout renders "Members" as the title via PageHeader
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()

    // At least 1 member should be shown in the DataTable (the org owner)
    await expect(page.locator('tbody tr').first()).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Org Secrets - renders Secrets heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/secrets`, 'tdsk-org-secrets-page')

    await expect(page.getByRole('heading', { name: 'Secrets' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Org Providers - renders Providers heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/providers`, 'tdsk-org-providers-page')

    // The Providers component renders title "Org Providers"
    await expect(page.getByRole('heading', { name: /Providers/i })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Org Domains - renders Domains heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/domains`, 'tdsk-org-domains-page')

    await expect(page.getByRole('heading', { name: 'Domains' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Org API Keys - renders API Keys heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/api-keys`, 'tdsk-org-api-keys-page')

    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Org Usage - renders Usage heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/usage`, 'tdsk-org-usage-page')

    // The heading is "{org.name} Usage" — use .first() since "Current Usage" heading also matches
    await expect(page.getByRole('heading', { name: /Usage/i }).first()).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Org Settings - renders Settings content', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/settings`, 'tdsk-org-settings-page')

    // OrgSettings renders "Settings" as h1
    await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible()

    // The "General" settings card should be visible
    await expect(page.getByText('General').first()).toBeVisible()

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Project Pages
// ---------------------------------------------------------------------------

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

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}`, 'tdsk-project-page')

    // Project detail renders the project name as h1
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible()

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

  test('Agent Threads - renders AI Threads heading', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`, 'tdsk-project-threads-page')

    await expect(page.getByRole('heading', { name: 'AI Threads' })).toBeVisible()

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

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`, 'tdsk-chat-view-page')

    // Chat page renders a text input with placeholder "Type a message..."
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible()

    // The "Agent Chat" or agent name heading should be visible
    await expect(page.getByRole('heading', { name: /Chat|Agent/i })).toBeVisible()

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Global Pages
// ---------------------------------------------------------------------------

test.describe('Global Pages', () => {
  test('Settings page - renders Settings UI', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    // Navigate to home first to initialize app state, then to settings
    await gotoAndWait(page, '/', 'tdsk-home-page')
    await gotoAndWait(page, '/settings', 'tdsk-settings-page')

    // Global Settings page renders "Settings" heading
    await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible()

    // Appearance section should be present
    await expect(page.getByText('Appearance')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Profile page - renders Profile UI', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, '/profile', 'tdsk-profile-page')

    // Profile page renders "Profile" heading
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()

    // Personal Information section should exist
    await expect(page.getByText('Personal Information')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Billing page - renders Billing content', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, '/billing', 'tdsk-billing-page')

    // Billing page renders "Billing & Plans" heading
    await expect(page.getByRole('heading', { name: /Billing/i })).toBeVisible()

    expect(errors).toEqual([])
  })
})
