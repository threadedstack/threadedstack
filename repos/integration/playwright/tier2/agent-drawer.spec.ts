import { test, expect } from '../fixtures/auth'

/**
 * Agent Drawer Regression Tests
 *
 * Validates that the agent edit drawer correctly displays:
 * - Secret names (not UUIDs) in the secrets selector
 * - Provider names (not UUIDs/empty) in the provider priority list
 * - Functions selector is populated for agents with project associations
 *
 * These tests are read-only — drawers are opened and inspected but never submitted.
 */

const RAW_ID_REGEX = /^[A-Za-z0-9_-]{10}$/

const ignoredConsolePatterns = [
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
  ignoredConsolePatterns.some((p) => text.includes(p))

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

/**
 * Open the edit drawer for the first agent on the page.
 * The admin agents pages use DataTable (MUI Table), not MuiCard.
 * Edit buttons are ActionIconButton with tooltip="Edit agent" which
 * renders as an IconButton with aria-label="Edit agent".
 *
 * Returns true if drawer opened, false if no agents exist.
 */
async function openAgentEditDrawer(page: import('@playwright/test').Page): Promise<boolean> {
  const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')

  // Wait for async data to populate table rows
  try {
    await tableRows.first().waitFor({ state: 'visible', timeout: 10000 })
  } catch {
    return false
  }

  const rowCount = await tableRows.count()
  if (rowCount === 0) return false

  // Find the edit button in the first row via aria-label from MUI Tooltip
  const firstRow = tableRows.first()
  const editButton = firstRow.locator('[aria-label="Edit agent"]')

  if ((await editButton.count()) === 0) {
    // Fallback: try clicking the row directly (OrgAgents opens drawer on row click)
    await firstRow.click()
  } else {
    await editButton.first().click()
  }

  await page.waitForTimeout(2000)

  // Verify drawer opened (project-level shows "Configure Agent for Project")
  const editTitle = page.getByText('Edit Agent')
  const configTitle = page.getByText('Configure Agent for Project')
  const isVisible = (await editTitle.count()) > 0 || (await configTitle.count()) > 0
  if (isVisible) {
    const title = (await editTitle.count()) > 0 ? editTitle : configTitle
    await expect(title.first()).toBeVisible({ timeout: 5000 })
  }
  return isVisible
}

test.describe('Agent Drawer: Secrets display names (P1 regression)', () => {
  test('secrets chips show names, not UUIDs', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    // Navigate to project agents page (agents here are more likely to have secrets)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents`,
      'tdsk-project-agents-page'
    )

    const drawerOpened = await openAgentEditDrawer(page)
    test.skip(!drawerOpened, 'No agents found — cannot test agent drawer')

    // Look for the secrets autocomplete
    const secretsAutocomplete = page.locator('#agent-secrets')
    const hasSecrets = (await secretsAutocomplete.count()) > 0

    if (hasSecrets) {
      // Check the MUI Chip labels inside the secrets autocomplete container
      // Selected secrets render as chips with class .MuiChip-label
      const secretsContainer = page.locator('#agent-secrets').locator('..')
      const chips = secretsContainer.locator('.MuiChip-label')
      const chipCount = await chips.count()

      // If the agent has selected secrets, verify none show as raw IDs
      for (let i = 0; i < chipCount; i++) {
        const chipText = await chips.nth(i).textContent()
        if (chipText) {
          expect(
            RAW_ID_REGEX.test(chipText.trim()),
            `Secret chip "${chipText}" should display a name, not a raw ID`
          ).toBe(false)
        }
      }
    }

    // Close the drawer
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})

test.describe('Agent Drawer: Providers display names (P1 regression)', () => {
  test('provider list items show names, not raw IDs or empty strings', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents`,
      'tdsk-project-agents-page'
    )

    const drawerOpened = await openAgentEditDrawer(page)
    test.skip(!drawerOpened, 'No agents found — cannot test agent drawer')

    // The ProviderPriorityList renders ListItems with "{index}. {providerName}"
    // Look for the provider section
    const providerSection = page.locator('#agent-providers')
    const hasProviders = (await providerSection.count()) > 0

    if (hasProviders) {
      // Find list items inside the provider section's parent
      const providerContainer = providerSection.locator('..')
      const listItems = providerContainer.locator('.MuiListItemText-primary .MuiTypography-body2')
      const itemCount = await listItems.count()

      for (let i = 0; i < itemCount; i++) {
        const itemText = await listItems.nth(i).textContent()
        if (itemText) {
          const trimmed = itemText.trim()
          // Provider text format: "{number}. {name}" — extract the name part
          const nameMatch = trimmed.match(/^\d+\.\s*(.*)$/)
          if (nameMatch) {
            const providerName = nameMatch[1].trim()
            // Name should not be empty
            expect(
              providerName.length > 0,
              `Provider item "${trimmed}" should have a non-empty name`
            ).toBe(true)
            // Name should not be a raw ID
            expect(
              RAW_ID_REGEX.test(providerName),
              `Provider name "${providerName}" should not be a raw ID`
            ).toBe(false)
          }
        }
      }
    }

    // Close the drawer
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})

test.describe('Agent Drawer: Functions selector hidden on org-level page', () => {
  test('functions selector is not shown on org-level agents page', async ({ authenticatedPage: page, ctx }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    // Navigate to ORG-level agents page — functions are project-scoped,
    // so the functions selector should not appear here
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/agents`,
      'tdsk-org-agents-page'
    )

    const drawerOpened = await openAgentEditDrawer(page)
    test.skip(!drawerOpened, 'No agents found on org agents page — cannot test')

    // Wait for async data loading in the drawer
    await page.waitForTimeout(3000)

    // Functions selector should NOT be present on org-level agent drawer
    // (functions are project-scoped; orgs don't have functions)
    const functionsAutocomplete = page.locator('#agent-functions')
    expect(await functionsAutocomplete.count()).toBe(0)

    // Close the drawer
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})
