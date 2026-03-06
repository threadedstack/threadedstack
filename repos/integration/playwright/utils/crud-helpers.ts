import type { Page } from '@playwright/test'
import { expect } from '../fixtures/auth'

/**
 * React dev-mode warnings and other noise that should not fail tests.
 */
const ignoredConsolePatterns = [
  'Function components cannot be given refs',
  'useLayoutEffect does nothing on the server',
  'Download the React DevTools',
  'React Router Future Flag Warning',
  'Warning:',
  'net::ERR',
  'Failed to load resource',
]

/**
 * Attach a console error collector to the page.
 * Returns the mutable array — check it at the end of the test.
 */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (ignoredConsolePatterns.some((p) => text.includes(p))) return
    errors.push(text)
  })
  return errors
}

/**
 * Navigate to a URL and wait for the page component to render.
 */
export async function gotoAndWait(
  page: Page,
  url: string,
  pageClass: string,
  timeout = 15_000
) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await expect(page.locator(`.${pageClass}`)).toBeVisible({ timeout })
}

/**
 * Click a button to open the drawer, handling both PageLayout header
 * and EmptyState action buttons.
 */
export async function openDrawer(page: Page, buttonText: string | RegExp) {
  const button = page.getByRole('button', { name: buttonText })
  const count = await button.count()

  if (count > 0) {
    await button.first().click()
  } else {
    // Fallback: find any button containing the text
    const fallback = page.locator('button', { hasText: buttonText })
    await fallback.first().click()
  }

  await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })
}

/**
 * Fill a text input or textarea by its DOM id.
 */
export async function fillField(page: Page, id: string, value: string) {
  const input = page.locator(`#${id}`)
  await expect(input).toBeVisible({ timeout: 5_000 })
  await input.fill(value)
}

/**
 * Click the submit/create button associated with a form id.
 * DrawerActions renders `<LoadingButton form={formId} ... />`.
 */
export async function submitForm(page: Page, formId: string) {
  const submitButton = page.locator(`button[form="${formId}"]`)
  await expect(submitButton).toBeEnabled({ timeout: 5_000 })
  await submitButton.click()
}

/**
 * Wait for the drawer to close after a successful operation.
 */
export async function waitForDrawerClose(page: Page, timeout = 10_000) {
  await expect(page.locator('.tdsk-drawer')).not.toBeVisible({ timeout })
}

/**
 * Click "Confirm" in the ConfirmDelete MUI dialog.
 * Accepts optional custom button text (e.g. "Revoke" for API keys).
 */
export async function confirmDelete(page: Page, buttonText: string | RegExp = /Confirm/i) {
  const dialog = page.locator('.MuiDialog-root')
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  const confirmButton = dialog.getByRole('button', { name: buttonText })
  await expect(confirmButton).toBeVisible({ timeout: 3_000 })
  await confirmButton.click()
}

/**
 * Select a value from a MUI Select dropdown by its DOM id.
 * MUI Select renders a hidden <input id="..."> with a visible
 * <div role="combobox"> sibling — we click the combobox trigger.
 */
export async function selectOption(page: Page, id: string, value: string) {
  const input = page.locator(`#${id}`)
  await expect(input).toBeAttached({ timeout: 5_000 })

  // Find the combobox trigger that's a sibling of the hidden input
  const combobox = input.locator('xpath=..').locator('[role="combobox"]')
  if ((await combobox.count()) > 0) {
    await combobox.click()
  } else {
    // Fallback for native selects or non-MUI components
    await input.click()
  }

  // MUI Select renders options in a Popover/Menu
  const option = page.locator('.MuiMenuItem-root', { hasText: value })
  await expect(option.first()).toBeVisible({ timeout: 3_000 })
  await option.first().click()
}

/**
 * Toggle a MUI Checkbox by its DOM id.
 * MUI renders a hidden <input type="checkbox"> inside a FormControlLabel.
 * We click the ancestor <label> which owns the onChange handler.
 */
export async function checkBox(page: Page, id: string) {
  const input = page.locator(`#${id}`)
  await expect(input).toBeAttached({ timeout: 5_000 })
  const label = input.locator('xpath=ancestor::label')
  if ((await label.count()) > 0) {
    await label.click()
  } else {
    await input.click({ force: true })
  }
}

/**
 * Generate a unique name for test resources to avoid collisions.
 */
export function uniqueName(prefix: string): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 6)
  return `${prefix}-${ts}-${rand}`
}

const PROXY_URL = 'https://px.local.threadedstack.app'

/**
 * Make an authenticated API request through the proxy.
 * Uses page.request which respects ignoreHTTPSErrors from the Playwright config.
 */
export async function apiRequest(
  page: Page,
  method: string,
  path: string,
  apiKey: string,
  body?: unknown
) {
  const url = `${PROXY_URL}/_${path.startsWith('/') ? '' : '/'}${path}`
  const opts: Parameters<typeof page.request.get>[1] = {
    ignoreHTTPSErrors: true,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  }

  if (method === 'GET') return page.request.get(url, opts)
  if (method === 'DELETE') return page.request.delete(url, opts)
  if (method === 'POST') return page.request.post(url, { ...opts, data: body })
  if (method === 'PUT') return page.request.put(url, { ...opts, data: body })

  return page.request.fetch(url, { ...opts, method })
}

/**
 * Find a resource by name from an API list endpoint.
 * Handles both `[...]` and `{ data: [...] }` response formats.
 */
export async function findResourceByName(
  page: Page,
  listPath: string,
  apiKey: string,
  name: string,
  nameField = 'name'
): Promise<Record<string, unknown> | null> {
  const res = await apiRequest(page, 'GET', listPath, apiKey)
  const body = await res.json()
  const arr: Record<string, unknown>[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.data)
      ? body.data
      : []

  return arr.find((r) => r[nameField] === name) ?? null
}

/**
 * Type into the PageLayout search box to filter the list/table.
 * Clears any existing text first, then types the query.
 */
export async function searchInPage(page: Page, query: string) {
  const searchInput = page.locator('input[placeholder*="Search"]')
  await expect(searchInput).toBeVisible({ timeout: 5_000 })
  await searchInput.fill(query)
  // Wait for the debounced filter to apply
  await page.waitForTimeout(500)
}

/**
 * Clear the PageLayout search box.
 */
export async function clearSearch(page: Page) {
  const searchInput = page.locator('input[placeholder*="Search"]')
  await searchInput.fill('')
  await page.waitForTimeout(500)
}

/**
 * Intercept API list requests for a resource path and add a high limit
 * to ensure all items are loaded (works around backend default pagination).
 * Must be called BEFORE navigating to the page.
 */
export async function ensureFullListLoad(page: Page, pathPattern: string) {
  await page.route(`**/_${pathPattern}`, async (route) => {
    const req = route.request()
    if (req.method() !== 'GET') {
      await route.continue()
      return
    }
    const url = req.url()
    const separator = url.includes('?') ? '&' : '?'
    await route.continue({ url: `${url}${separator}limit=500` })
  })
}

/**
 * Delete a resource via API. Best-effort, swallows errors.
 */
export async function apiDeleteResource(
  page: Page,
  path: string,
  apiKey: string
) {
  try {
    await apiRequest(page, 'DELETE', path, apiKey)
  } catch {
    // Best-effort cleanup
  }
}
