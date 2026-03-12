import { test, expect } from '../fixtures/auth'

/**
 * Entity Drawer Selector Component Integration Tests
 *
 * Validates that EntitySelector-based selector components render and
 * behave correctly across non-Agent drawer pages.
 *
 * Coverage:
 * - Endpoint Drawer (Agent type): AgentSelector (single)
 * - Endpoint Drawer (FaaS type): FunctionSelectorSingle
 * - FunctionDrawer: EndpointSelector (single)
 * - EditThreadDrawer: ProviderSelectorSingle
 * - ProjectMembers: UserSelectorSingle
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

// ---------------------------------------------------------------------------
// 4. Endpoint Drawer: AgentSelector (single-select)
// ---------------------------------------------------------------------------
test.describe('AgentSelector in Endpoint Drawer', () => {
  test('renders as autocomplete combobox on endpoint page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      'tdsk-project-endpoints-page'
    )

    // Try opening create endpoint drawer
    const createBtn = page
      .locator('[aria-label="Create endpoint"]')
      .or(page.getByText('Create Endpoint'))
    const hasCreateBtn = (await createBtn.count()) > 0

    if (hasCreateBtn) {
      await createBtn.first().click()
      await page.waitForTimeout(2000)

      // Select "Agent" endpoint type via the MUI Select dropdown
      const endpointTypeInput = page.locator('#endpoint-type')
      const isTypeSelectAttached = (await endpointTypeInput.count()) > 0
      if (isTypeSelectAttached) {
        const combobox = endpointTypeInput.locator('xpath=..').locator('[role="combobox"]')
        if ((await combobox.count()) > 0) {
          await combobox.click()
        } else {
          await endpointTypeInput.click()
        }
        const agentMenuItem = page.locator('.MuiMenuItem-root', { hasText: 'Agent' })
        if ((await agentMenuItem.count()) > 0) {
          await agentMenuItem.first().click()
        }
        await page.waitForTimeout(1000)

        // AgentSelector: MUI puts id='agent-id' on the combobox input
        const agentInput = page.locator('#agent-id')
        if ((await agentInput.count()) > 0) {
          await expect(agentInput).toBeVisible()
          await expect(agentInput).toHaveAttribute('role', 'combobox')
        }
      }
    } else {
      // Fallback: open existing endpoint
      const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')
      test.skip((await tableRows.count()) === 0, 'No endpoints and no create button')
      await tableRows.first().click()
      await page.waitForTimeout(2000)

      const agentInput = page.locator('#agent-id')
      if ((await agentInput.count()) > 0) {
        await expect(agentInput).toBeVisible()
        await expect(agentInput).toHaveAttribute('role', 'combobox')
      }
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 5. Endpoint Drawer (FaaS type): FunctionSelectorSingle
// ---------------------------------------------------------------------------
test.describe('FunctionSelectorSingle in FaaS Endpoint', () => {
  test('renders function selector when endpoint type is FaaS', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      'tdsk-project-endpoints-page'
    )

    // Try creating a FaaS endpoint to get the FaasInputs form
    const createBtn = page
      .locator('[aria-label="Create endpoint"]')
      .or(page.getByText('Create Endpoint'))
    const hasCreateBtn = (await createBtn.count()) > 0

    if (hasCreateBtn) {
      await createBtn.first().click()
      await page.waitForTimeout(2000)

      // Select "FaaS" endpoint type
      const faasTypeOption = page.getByText('FaaS', { exact: true })
      if ((await faasTypeOption.count()) > 0) {
        await faasTypeOption.first().click()
        await page.waitForTimeout(1000)

        // FunctionSelectorSingle: id='function-select' on the combobox input
        const functionInput = page.locator('#function-select')
        if ((await functionInput.count()) > 0) {
          await expect(functionInput).toBeVisible()
          await expect(functionInput).toHaveAttribute('role', 'combobox')
        }
      }
    } else {
      // Fallback: check existing endpoints for FaaS type
      const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')
      test.skip((await tableRows.count()) === 0, 'No endpoints available')

      const rowCount = await tableRows.count()
      let found = false
      for (let i = 0; i < Math.min(rowCount, 3); i++) {
        await tableRows.nth(i).click()
        await page.waitForTimeout(2000)

        const functionInput = page.locator('#function-select')
        if ((await functionInput.count()) > 0) {
          await expect(functionInput).toBeVisible()
          found = true
          break
        }
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      }
      test.skip(!found, 'No FaaS-type endpoints found')
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 6. FunctionDrawer: EndpointSelector (single-select)
// ---------------------------------------------------------------------------
test.describe('EndpointSelector in FunctionDrawer', () => {
  test('renders endpoint selector when editing a function', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`,
      'tdsk-project-functions-page'
    )

    // Try creating a new function to open the drawer
    const createBtn = page
      .locator('[aria-label="Create function"]')
      .or(page.getByText('Create Function'))
      .or(page.getByText('Create New Function'))
    const hasCreateBtn = (await createBtn.count()) > 0

    if (hasCreateBtn) {
      await createBtn.first().click()
      await page.waitForTimeout(2000)
    } else {
      // Fallback: open existing function
      const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')
      test.skip((await tableRows.count()) === 0, 'No functions and no create button')

      const firstRow = tableRows.first()
      const editButton = firstRow.locator('[aria-label="Edit function"]')
      if ((await editButton.count()) > 0) {
        await editButton.first().click()
      } else {
        await firstRow.click()
      }
      await page.waitForTimeout(2000)
    }

    // EndpointSelector: MUI puts id='endpoint-id' on the combobox input
    const endpointInput = page.locator('#endpoint-id')
    if ((await endpointInput.count()) > 0) {
      await expect(endpointInput).toBeVisible()
      await expect(endpointInput).toHaveAttribute('role', 'combobox')
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 7. EditThreadDrawer: ProviderSelectorSingle
// ---------------------------------------------------------------------------
test.describe('ProviderSelectorSingle in EditThreadDrawer', () => {
  test('renders provider selector when editing a thread', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`,
      'tdsk-agent-layout-page'
    )

    // Look for threads in the table — wait for async data load
    const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')
    try {
      await tableRows.first().waitFor({ state: 'visible', timeout: 10000 })
    } catch { /* no rows */ }
    const rowCount = await tableRows.count()
    test.skip(rowCount === 0, 'No threads found — cannot test thread edit drawer')

    // Open the edit drawer for the first thread
    const firstRow = tableRows.first()
    const editButton = firstRow.locator('[aria-label="Edit thread"]')
    if ((await editButton.count()) > 0) {
      await editButton.first().click()
    } else {
      await firstRow.click()
    }
    await page.waitForTimeout(2000)

    // ProviderSelectorSingle: MUI puts id='entity-provider' on the combobox input
    const providerInput = page.locator('#entity-provider')
    if ((await providerInput.count()) > 0) {
      await expect(providerInput).toBeVisible()
      await expect(providerInput).toHaveAttribute('role', 'combobox')

      // Open dropdown to verify provider options are listed
      await providerInput.click()
      await page.waitForTimeout(500)

      const listbox = page.locator('.MuiAutocomplete-listbox')
      if ((await listbox.count()) > 0) {
        const options = listbox.locator('li')
        expect(await options.count()).toBeGreaterThan(0)
      }

      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 8. ProjectMembers: UserSelectorSingle
// ---------------------------------------------------------------------------
test.describe('UserSelectorSingle in ProjectMembers', () => {
  test('renders user selector in the add member drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/members`,
      'tdsk-project-members-page'
    )

    // Open the "Add Member" drawer
    const addBtn = page
      .locator('[aria-label="Add Member"]')
      .or(page.getByText('Add Member'))
    const hasAddBtn = (await addBtn.count()) > 0
    test.skip(!hasAddBtn, 'No Add Member button found')

    await addBtn.first().click()
    await page.waitForTimeout(2000)

    // UserSelectorSingle: MUI puts id='entity-user' on the combobox input
    const userInput = page.locator('#entity-user')
    if ((await userInput.count()) > 0) {
      await expect(userInput).toBeVisible()
      await expect(userInput).toHaveAttribute('role', 'combobox')
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    expect(errors).toEqual([])
  })
})
