import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  waitForDrawerClose,
  confirmDelete,
  uniqueName,
  collectErrors,
  apiRequest,
  apiDeleteResource,
  searchInPage,
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-org-agents-page'
const FORM_ID = 'agent-form'

test.describe.serial('CRUD Agents', () => {
  const agentName = uniqueName('pw-agent')
  const updatedName = uniqueName('pw-agent-upd')
  let agentId: string | undefined
  let hasProviders = false

  test('CREATE — should create a new agent via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.slow()
    const errors = collectErrors(page)

    // First check if AI providers exist (agents require at least one AI-type provider)
    const provRes = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/providers?limit=200`,
      ctx.apiKey
    )
    const provBody = await provRes.json()
    const allProviders: Record<string, unknown>[] = Array.isArray(provBody?.data)
      ? provBody.data
      : []
    const aiProviders = allProviders.filter((p) => p.type === 'ai')
    hasProviders = aiProviders.length > 0

    test.skip(!hasProviders, 'No AI providers exist — cannot create agent without an AI provider')

    await gotoAndWait(page, `/orgs/${ctx.orgId}/agents`, PAGE_CLASS)

    // Open create drawer
    await openDrawer(page, /Create Agent/i)

    // Fill agent name
    await fillField(page, 'agent-name', agentName)

    // Fill description
    await fillField(page, 'agent-description', 'Playwright CRUD test agent')

    // The AI Providers section shows a MUI SelectInput for choosing providers
    // Try "Add Provider" button first; if not visible, the Select is already rendered
    const addBtn = page.locator('button', { hasText: /Add Provider/i }).first()
    const hasAddBtn = await addBtn.isVisible({ timeout: 2_000 }).catch(() => false)
    if (hasAddBtn) await addBtn.click()

    // Open the AI Providers MUI Select and pick the first provider via keyboard
    const combobox = page.getByRole('combobox', { name: /provider/i }).first()
    await expect(combobox).toBeVisible({ timeout: 5_000 })
    await combobox.click()
    await page.waitForTimeout(500)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')

    // Wait for the provider to be added to the list
    await page.waitForTimeout(500)

    // Submit the form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // Search for the agent in the table
    await searchInPage(page, agentName)

    // Verify the agent appears in the DataTable
    await expect(page.getByText(agentName)).toBeVisible({ timeout: 10_000 })

    // Get agent ID via API
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/agents?limit=200`,
      ctx.apiKey
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data)
      ? body.data
      : []
    const found = arr.find((a) => a.name === agentName)
    if (found?.id) agentId = found.id as string

    expect(agentId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('READ — should display the created agent in the table', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!agentId, 'No agent ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/agents`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/agents`, PAGE_CLASS)

    // Search for the agent
    await searchInPage(page, agentName)

    // Verify agent name is visible
    await expect(page.getByText(agentName)).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('UPDATE — should edit the agent name', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!agentId, 'No agent ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/agents`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/agents`, PAGE_CLASS)

    // Search for and click edit button on the agent row
    await searchInPage(page, agentName)
    const row = page.locator('tr', { has: page.getByText(agentName) })
    const editButton = row.locator('[aria-label="Edit agent"]')

    if ((await editButton.count()) > 0) {
      await editButton.first().click()
    } else {
      // Fallback: click the row directly
      await row.click()
    }

    // Wait for edit drawer to open
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // Update the name
    await fillField(page, 'agent-name', updatedName)

    // Submit
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // Search for updated name
    await searchInPage(page, updatedName)

    // Verify updated name appears
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('DELETE — should delete the agent', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!agentId, 'No agent ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/agents`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/agents`, PAGE_CLASS)

    // Search for the agent (using updated name from UPDATE test)
    await searchInPage(page, updatedName)

    // Find the row and click the delete action button
    const row = page.locator('tr', { has: page.getByText(updatedName) })
    const deleteButton = row.locator('[aria-label="Delete agent"]')

    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()
    } else {
      // Fallback: try error-colored icon button
      const errorButton = row.locator('.MuiIconButton-colorError').first()
      await errorButton.click()
    }

    // Confirm the deletion
    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    // Verify the agent is removed from the table
    await expect(
      page.locator('.MuiTableBody-root').getByText(updatedName)
    ).not.toBeVisible({ timeout: 10_000 })

    // Mark as cleaned up
    agentId = undefined

    expect(errors).toEqual([])
  })

  // Safety-net cleanup
  test.afterAll(async ({ browser }) => {
    if (!agentId) return
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const cleanupPage = await context.newPage()
    try {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const ctx = JSON.parse(
        readFileSync(
          join(tmpdir(), 'tdsk-integration', 'context.json'),
          'utf-8'
        )
      )
      await apiDeleteResource(
        cleanupPage,
        `/orgs/${ctx.orgId}/agents/${agentId}`,
        ctx.apiKey
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
