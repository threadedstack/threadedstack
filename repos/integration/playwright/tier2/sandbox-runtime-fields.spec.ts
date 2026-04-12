import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  selectOption,
  uniqueName,
  collectErrors,
  waitForDrawerClose,
  apiRequest,
  apiDeleteResource,
  searchInPage,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-sandboxes-page'
const FORM_ID = 'sandbox-form'

/**
 * Tests for sandbox runtime configuration fields in the SandboxDrawer:
 *   - Runtime dropdown (claude-code, codex, opencode, gemini-cli, custom)
 *   - Runtime Command field (disabled for preset, editable for custom)
 *   - Init Script editor (pre-filled for presets, editable for custom)
 *   - Runtime + command persistence in edit mode
 */
test.describe.serial('Sandbox Runtime Fields', () => {
  const createdSandboxIds: string[] = []

  test.beforeEach(async ({ ctx }) => {
    test.skip(!ctx.projectId, 'No projectId in context — cannot test sandbox drawer')
  })

  test('Runtime dropdown defaults to claude-code', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // MUI SelectInput renders a hidden input with the value
    const runtimeInput = page.locator('#sandbox-runtime-type')
    await expect(runtimeInput).toBeAttached({ timeout: 5_000 })

    // The visible text should show "Claude Code" as the default
    const runtimeParent = runtimeInput.locator('xpath=..')
    await expect(runtimeParent).toContainText('Claude Code', { timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Runtime command field is disabled for preset runtimes', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Runtime command should be disabled when a preset runtime is selected
    const cmdInput = page.locator('#sandbox-runtime-command')
    await expect(cmdInput).toBeAttached({ timeout: 5_000 })
    await expect(cmdInput).toBeDisabled()

    // Should show the pre-configured command as value
    const cmdValue = await cmdInput.inputValue()
    expect(cmdValue.length).toBeGreaterThan(0)

    expect(errors).toEqual([])
  })

  test('Selecting custom runtime enables command field', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Switch to custom runtime
    await selectOption(page, 'sandbox-runtime-type', 'Custom')

    // Runtime command should now be enabled
    const cmdInput = page.locator('#sandbox-runtime-command')
    await expect(cmdInput).toBeEnabled({ timeout: 5_000 })

    // It should be empty (no preset value)
    await expect(cmdInput).toHaveValue('')

    // Should be fillable
    await cmdInput.fill('my-custom-tool')
    await expect(cmdInput).toHaveValue('my-custom-tool')

    expect(errors).toEqual([])
  })

  test('Init Script section is visible with preset label', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Init Script label should be visible
    const initScriptLabel = page.getByText('Init Script')
    await expect(initScriptLabel.first()).toBeVisible({ timeout: 5_000 })

    // With a preset runtime, should show "pre-filled from X preset"
    await expect(page.getByText(/pre-filled from/i).first()).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Switching runtime changes the helper text', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Default is claude-code — the helper text below the command field mentions it
    // MUI renders helperText as a <p> sibling of the input wrapper
    const cmdField = page.locator('#sandbox-runtime-command')
    await expect(cmdField).toBeAttached({ timeout: 5_000 })
    const helperText = cmdField.locator('xpath=ancestor::div[contains(@class,"MuiFormControl")]').locator('p')
    await expect(helperText).toContainText('Claude Code', { timeout: 5_000 })

    // Switch to Codex
    await selectOption(page, 'sandbox-runtime-type', 'Codex')

    // Helper text should now mention Codex
    await expect(helperText).toContainText('Codex', { timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('CREATE with custom runtime persists fields', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.slow()
    const errors = collectErrors(page)
    const sandboxName = uniqueName('pw-sb-runtime')

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await openDrawer(page, /Create Sandbox/i)

    // Fill basic fields
    await fillField(page, 'sandbox-name', sandboxName)
    await fillField(page, 'sandbox-image', 'node:22-slim')

    // Select custom runtime
    await selectOption(page, 'sandbox-runtime-type', 'Custom')

    // Fill custom runtime command
    await fillField(page, 'sandbox-runtime-command', 'my-ai-agent')

    // Submit
    await submitForm(page, FORM_ID)
    await waitForDrawerClose(page)

    // Find the created sandbox for cleanup
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/sandboxes?limit=200`,
      ctx.apiKey
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data) ? body.data : []
    const found = arr.find((s) => s.name === sandboxName)
    if (found?.id) createdSandboxIds.push(found.id as string)

    // Open edit drawer and verify persistence
    await searchInPage(page, sandboxName)
    await expect(page.getByText(sandboxName)).toBeVisible({ timeout: 10_000 })

    const row = page.locator('tr', { has: page.getByText(sandboxName) })
    const editButton = row.locator('button').filter({ has: page.locator('[data-testid="EditIcon"]') })
    if ((await editButton.count()) > 0) {
      await editButton.first().click()
    } else {
      await row.click()
    }

    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Edit Sandbox Config')).toBeVisible({ timeout: 5_000 })

    // Verify runtime is "Custom"
    const editRuntimeParent = page.locator('#sandbox-runtime-type').locator('xpath=..')
    await expect(editRuntimeParent).toContainText('Custom', { timeout: 5_000 })

    // Verify runtime command is editable and has the value
    const editCmdInput = page.locator('#sandbox-runtime-command')
    await expect(editCmdInput).toBeEnabled()
    await expect(editCmdInput).toHaveValue('my-ai-agent')

    expect(errors).toEqual([])
  })

  // Cleanup
  test.afterAll(async ({ browser }) => {
    if (createdSandboxIds.length === 0) return
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const cleanupPage = await context.newPage()
    try {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const ctx = JSON.parse(
        readFileSync(join(tmpdir(), 'tdsk-integration', 'context.json'), 'utf-8')
      )
      for (const id of createdSandboxIds) {
        await apiDeleteResource(cleanupPage, `/orgs/${ctx.orgId}/sandboxes/${id}`, ctx.apiKey)
      }
    } catch { /* best-effort */ }
    finally { await context.close() }
  })
})
