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
