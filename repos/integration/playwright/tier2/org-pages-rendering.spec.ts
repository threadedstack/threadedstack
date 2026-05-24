import { test, expect } from '../fixtures/auth'
import { isFeatureEnabled } from '@tdsk/domain'

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

  test('Org Skills - renders Skills heading', async ({ authenticatedPage: page, ctx }) => {
    test.skip(!isFeatureEnabled('skills'), 'skills feature flag is disabled')
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, 'tdsk-org-skills-page')

    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Project Schedules - renders Schedules heading', async ({ authenticatedPage: page, ctx }) => {
    test.skip(!isFeatureEnabled('schedules'), 'schedules feature flag is disabled')
    test.skip(!ctx.projectId, 'No projectId in context')
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/schedules`, 'tdsk-project-schedules-page')

    await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible()

    expect(errors).toEqual([])
  })
})
