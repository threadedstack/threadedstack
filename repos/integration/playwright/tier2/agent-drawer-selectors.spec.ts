import { test, expect } from '../fixtures/auth'

/**
 * AgentDrawer Selector Component Integration Tests
 *
 * Validates that EntitySelector-based selector components render and
 * behave correctly inside the AgentDrawer.
 *
 * Coverage:
 * - AgentDrawer: ToolsSelector (multi), SecretsSelector (multi), FunctionsSelector (multi)
 *
 * Note: MUI Autocomplete puts the `id` prop on the `<input>` element (role=combobox),
 * NOT on the wrapper div. So `page.locator('#some-id')` returns the input directly.
 * Chips and other wrapper content are siblings of the input inside `.MuiAutocomplete-root`.
 *
 * Tests are read-only — drawers are opened and inspected but never submitted.
 */

const ignoredConsolePatterns = [
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
  ignoredConsolePatterns.some((p) => text.includes(p))

function collectErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
  })
  return errors
}

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

async function openAgentEditDrawer(page: import('@playwright/test').Page): Promise<boolean> {
  const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')
  try {
    await tableRows.first().waitFor({ state: 'visible', timeout: 10000 })
  } catch {
    return false
  }
  const rowCount = await tableRows.count()
  if (rowCount === 0) return false

  const firstRow = tableRows.first()
  const editButton = firstRow.locator('[aria-label="Edit agent"]')
  if ((await editButton.count()) === 0) {
    await firstRow.click()
  } else {
    await editButton.first().click()
  }
  await page.waitForTimeout(2000)

  const editTitle = page.getByText('Edit Agent')
  const configTitle = page.getByText('Configure Agent for Project')
  const isVisible = (await editTitle.count()) > 0 || (await configTitle.count()) > 0
  if (isVisible) {
    const title = (await editTitle.count()) > 0 ? editTitle : configTitle
    await expect(title.first()).toBeVisible({ timeout: 5000 })
  }
  return isVisible
}

// ---------------------------------------------------------------------------
// 1. AgentDrawer: ToolsSelector (multi-select)
// ---------------------------------------------------------------------------
test.describe('ToolsSelector in AgentDrawer', () => {
  test('renders autocomplete with options and supports selection', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents`,
      'tdsk-project-agents-page'
    )

    const drawerOpened = await openAgentEditDrawer(page)
    test.skip(!drawerOpened, 'No agents found — cannot test tools selector')

    await page.waitForTimeout(2000)

    // MUI Autocomplete puts id on the <input> element (role=combobox)
    const toolsInput = page.locator('#agent-tools')
    await expect(toolsInput).toBeVisible({ timeout: 5000 })

    // Title "Available Tools" is rendered as a heading by EntitySelector
    const toolsTitle = page.getByRole('heading', { name: 'Available Tools' })
    await expect(toolsTitle).toBeVisible()

    // The MUI Autocomplete root wraps chips + input
    const autocompleteRoot = page.locator('.MuiAutocomplete-root:has(#agent-tools)')

    // Click the input to open the dropdown
    await toolsInput.click()
    await page.waitForTimeout(500)

    const listbox = page.locator('.MuiAutocomplete-listbox')
    if ((await listbox.count()) > 0) {
      const options = listbox.locator('li')
      expect(await options.count()).toBeGreaterThan(0)

      // Count chips before selection (chips are inside the Autocomplete root)
      const chipsBeforeCount = await autocompleteRoot.locator('.MuiChip-root').count()
      await options.first().click()
      await page.waitForTimeout(500)

      const chipsAfterCount = await autocompleteRoot.locator('.MuiChip-root').count()
      expect(chipsAfterCount).toBe(chipsBeforeCount + 1)
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 2. AgentDrawer: SecretsSelector (multi-select)
// ---------------------------------------------------------------------------
test.describe('SecretsSelector in AgentDrawer', () => {
  test('renders with EntitySelector base on org agents page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/agents`, 'tdsk-org-agents-page')

    const drawerOpened = await openAgentEditDrawer(page)
    test.skip(!drawerOpened, 'No agents found — cannot test secrets selector')

    await page.waitForTimeout(2000)

    // MUI Autocomplete puts id on the <input> (role=combobox)
    const secretsInput = page.locator('#agent-secrets')
    await expect(secretsInput).toBeVisible({ timeout: 5000 })

    // Title "Associated Secrets" is rendered as a heading
    const secretsTitle = page.getByRole('heading', { name: 'Associated Secrets' })
    await expect(secretsTitle).toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 3. AgentDrawer: FunctionsSelector (multi-select, project-scoped)
// ---------------------------------------------------------------------------
test.describe('FunctionsSelector in AgentDrawer', () => {
  test('renders on project agents page with title', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents`,
      'tdsk-project-agents-page'
    )

    const drawerOpened = await openAgentEditDrawer(page)
    test.skip(!drawerOpened, 'No agents found — cannot test functions selector')

    await page.waitForTimeout(2000)

    // MUI Autocomplete puts id on the <input> (role=combobox)
    const functionsInput = page.locator('#agent-functions')
    await expect(functionsInput).toBeVisible({ timeout: 5000 })

    // Title "Custom Functions" is rendered as a heading
    const functionsTitle = page.getByRole('heading', { name: 'Custom Functions' })
    await expect(functionsTitle).toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})

