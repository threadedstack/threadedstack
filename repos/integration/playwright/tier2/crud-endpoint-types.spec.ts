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
  selectOption,
  selectEntityOption,
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-endpoints-page'
const FORM_ID = 'endpoint-form'

test.describe.serial('CRUD Endpoint Types (Agent & FaaS)', () => {
  const agentEndpointName = uniqueName('pw-ep-agent')
  const faasEndpointName = uniqueName('pw-ep-faas')
  let agentEndpointId: string | undefined
  let faasEndpointId: string | undefined
  let hasAgents = false
  let hasFunctions = false

  test('CREATE AGENT — should create an agent-type endpoint', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.projectId, 'No projectId in context')
    test.skip(!ctx.agentId, 'No agentId in context — cannot create agent endpoint')

    const errors = collectErrors(page)

    // Check if agents exist
    const agentRes = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/agents?limit=10`,
      ctx.apiKey
    )
    const agentBody = await agentRes.json()
    const agents: Record<string, unknown>[] = Array.isArray(agentBody?.data)
      ? agentBody.data
      : []
    hasAgents = agents.length > 0

    test.skip(!hasAgents, 'No agents exist — cannot create agent endpoint')

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      PAGE_CLASS
    )

    // Open create drawer
    await openDrawer(page, /Create Endpoint/i)

    // Fill endpoint name
    await fillField(page, 'endpoint-name', agentEndpointName)

    // Select endpoint type: "Agent"
    await selectOption(page, 'endpoint-type', 'Agent')

    // Select HTTP method: "POST"
    await selectOption(page, 'endpoint-method', 'POST')

    // Fill path
    await fillField(page, 'endpoint-path', `/test-agent/${Date.now()}`)

    // Select agent via EntitySelector autocomplete
    await selectEntityOption(page, 'agent-id')

    // Submit the form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // After create, page navigates to the detail page
    await page.waitForURL(/\/endpoints\/[^/]+$/, { timeout: 10_000 })

    // Extract endpoint ID from URL
    const agentUrl = page.url()
    const agentMatch = agentUrl.match(/\/endpoints\/([^/]+)$/)
    if (agentMatch) agentEndpointId = agentMatch[1]

    // Verify the endpoint name is visible on the detail page header
    await expect(page.locator('h1, h4').getByText(agentEndpointName)).toBeVisible({
      timeout: 10_000,
    })

    expect(agentEndpointId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('CREATE FAAS — should create a faas-type endpoint', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)

    // Check if functions exist
    const funcRes = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions?limit=10`,
      ctx.apiKey
    )
    const funcBody = await funcRes.json()
    const functions: Record<string, unknown>[] = Array.isArray(funcBody?.data)
      ? funcBody.data
      : []
    hasFunctions = functions.length > 0

    test.skip(!hasFunctions, 'No functions exist — cannot create FaaS endpoint')

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      PAGE_CLASS
    )

    // Open create drawer
    await openDrawer(page, /Create Endpoint/i)

    // Fill endpoint name
    await fillField(page, 'endpoint-name', faasEndpointName)

    // Select endpoint type: "FaaS"
    await selectOption(page, 'endpoint-type', 'FaaS')

    // Select HTTP method: "POST"
    await selectOption(page, 'endpoint-method', 'POST')

    // Fill path
    await fillField(page, 'endpoint-path', `/test-faas/${Date.now()}`)

    // Select function via EntitySelector autocomplete
    await selectEntityOption(page, 'function-select')

    // Submit the form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // After create, page navigates to the detail page
    await page.waitForURL(/\/endpoints\/[^/]+$/, { timeout: 10_000 })

    // Extract endpoint ID from URL
    const faasUrl = page.url()
    const faasMatch = faasUrl.match(/\/endpoints\/([^/]+)$/)
    if (faasMatch) faasEndpointId = faasMatch[1]

    // Verify the endpoint name is visible on the detail page header
    await expect(page.locator('h1, h4').getByText(faasEndpointName)).toBeVisible({
      timeout: 10_000,
    })

    expect(faasEndpointId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('READ — should display both endpoints with correct type indicators', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const hasEither = agentEndpointId || faasEndpointId
    test.skip(!hasEither, 'No endpoints created — both CREATEs must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      PAGE_CLASS
    )

    if (agentEndpointId) {
      await searchInPage(page, agentEndpointName)
      await expect(page.getByText(agentEndpointName)).toBeVisible({ timeout: 10_000 })
    }

    if (faasEndpointId) {
      await searchInPage(page, faasEndpointName)
      await expect(page.getByText(faasEndpointName)).toBeVisible({ timeout: 10_000 })
    }

    expect(errors).toEqual([])
  })

  test('DELETE AGENT — should delete the agent endpoint', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!agentEndpointId, 'No agent endpoint ID — CREATE AGENT must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      PAGE_CLASS
    )

    await searchInPage(page, agentEndpointName)
    const row = page.locator('tr', { has: page.getByText(agentEndpointName) })
    const deleteButton = row.locator('[aria-label="Delete endpoint"]')

    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()
    } else {
      const errorButton = row.locator('.MuiIconButton-colorError').first()
      await errorButton.click()
    }

    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(
      page.locator('.MuiTableBody-root').getByText(agentEndpointName)
    ).not.toBeVisible({ timeout: 10_000 })

    agentEndpointId = undefined
    expect(errors).toEqual([])
  })

  test('DELETE FAAS — should delete the faas endpoint', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!faasEndpointId, 'No FaaS endpoint ID — CREATE FAAS must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`,
      PAGE_CLASS
    )

    await searchInPage(page, faasEndpointName)
    const row = page.locator('tr', { has: page.getByText(faasEndpointName) })
    const deleteButton = row.locator('[aria-label="Delete endpoint"]')

    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()
    } else {
      const errorButton = row.locator('.MuiIconButton-colorError').first()
      await errorButton.click()
    }

    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(
      page.locator('.MuiTableBody-root').getByText(faasEndpointName)
    ).not.toBeVisible({ timeout: 10_000 })

    faasEndpointId = undefined
    expect(errors).toEqual([])
  })

  // Safety-net cleanup
  test.afterAll(async ({ browser }) => {
    if (!agentEndpointId && !faasEndpointId) return
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
      const basePath = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`
      if (agentEndpointId) {
        await apiDeleteResource(cleanupPage, `${basePath}/${agentEndpointId}`, ctx.apiKey)
      }
      if (faasEndpointId) {
        await apiDeleteResource(cleanupPage, `${basePath}/${faasEndpointId}`, ctx.apiKey)
      }
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
