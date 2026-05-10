import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  selectOption,
  waitForDrawerClose,
  uniqueName,
  collectErrors,
  apiRequest,
  apiDeleteResource,
  searchInPage,
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-sandboxes-page'
const FORM_ID = 'project-sandbox-form'

test.describe.serial('Sandbox Drawer Fields', () => {
  const createdSandboxIds: string[] = []

  test.beforeEach(async ({ ctx }) => {
    test.skip(!ctx.projectId, 'No projectId in context — cannot test sandbox drawer')
  })

  test('SSH Enabled toggle defaults to checked', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    // Open create drawer
    await openDrawer(page, /Create Sandbox/i)

    // SwitchInput renders label and checkbox as siblings via InputStateHandler
    const sshCheckbox = page.locator('input[type="checkbox"][name="sandbox-ssh-enabled"]')
    await expect(sshCheckbox).toBeChecked()

    expect(errors).toEqual([])
  })

  test('Preset dropdown controls runtime and image field visibility', async ({
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

    // Default preset is "Claude Code" — image field should be hidden
    const imageInput = page.locator('#sandbox-image')
    await expect(imageInput).not.toBeVisible()

    // Expand Container accordion — image still shouldn't be there for non-Custom preset
    const containerAccordion = page.locator('.MuiAccordionSummary-root', { hasText: 'Container' })
    await containerAccordion.click()
    await expect(imageInput).not.toBeVisible()

    // Select "Custom" preset — image field should appear in the expanded Container accordion
    await selectOption(page, 'sandbox-preset', 'Custom')
    await expect(imageInput).toBeVisible({ timeout: 5_000 })

    // Select "Codex" preset — image field should hide again
    await selectOption(page, 'sandbox-preset', 'Codex')
    await expect(imageInput).not.toBeVisible()

    expect(errors).toEqual([])
  })

  test('Idle timeout field has default 30', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    // Open create drawer
    await openDrawer(page, /Create Sandbox/i)

    // Verify the idle timeout input has default value '30'
    const timeoutInput = page.locator('#sandbox-idle-timeout')
    await expect(timeoutInput).toBeVisible({ timeout: 5_000 })
    await expect(timeoutInput).toHaveValue('30')

    expect(errors).toEqual([])
  })

  test('CREATE with all new fields persists correctly', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.slow()
    const errors = collectErrors(page)
    const sandboxName = uniqueName('pw-sb-fields')

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    // Open create drawer
    await openDrawer(page, /Create Sandbox/i)

    await fillField(page, 'sandbox-name', sandboxName)

    // Select Custom preset to make image field visible
    await selectOption(page, 'sandbox-preset', 'Custom')

    // Expand the Container accordion to access image field
    const containerAccordion = page.locator('.MuiAccordionSummary-root', { hasText: 'Container' })
    await containerAccordion.click()

    await fillField(page, 'sandbox-image', 'node:22-slim')

    // Toggle SSH off — click the switch input directly (SwitchInput separates label from checkbox)
    const sshCheckbox = page.locator('input[type="checkbox"][name="sandbox-ssh-enabled"]')
    await sshCheckbox.click({ force: true })

    // Set idle timeout to 60
    const timeoutInput = page.locator('#sandbox-idle-timeout')
    await timeoutInput.fill('60')

    // Submit form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // Get sandbox ID for cleanup
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/sandboxes?limit=200`,
      ctx.apiKey
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data)
      ? body.data
      : []
    const found = arr.find((s) => s.name === sandboxName)
    if (found?.id) createdSandboxIds.push(found.id as string)

    // Search for the created sandbox and open it for editing
    await searchInPage(page, sandboxName)
    await expect(page.getByText(sandboxName).first()).toBeVisible({ timeout: 10_000 })

    // Click the row to open the edit drawer
    const row = page.locator('tr', { has: page.getByText(sandboxName).first() })
    const editButton = row.locator('button').filter({ has: page.locator('[data-testid="EditIcon"]') })
    if ((await editButton.count()) > 0) {
      await editButton.first().click()
    } else {
      await row.click()
    }

    // Wait for edit drawer to open
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Edit Project Sandbox')).toBeVisible({ timeout: 5_000 })

    // Verify SSH toggle is unchecked (we toggled it off)
    const editSshCheckbox = page.locator('input[type="checkbox"][name="sandbox-ssh-enabled"]')
    await expect(editSshCheckbox).not.toBeChecked()

    // Verify idle timeout
    const editTimeout = page.locator('#sandbox-idle-timeout')
    await expect(editTimeout).toHaveValue('60')

    expect(errors).toEqual([])
  })

  // Safety-net cleanup
  test.afterAll(async ({ browser }) => {
    if (createdSandboxIds.length === 0) return
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
      for (const id of createdSandboxIds) {
        await apiDeleteResource(
          cleanupPage,
          `/orgs/${ctx.orgId}/sandboxes/${id}`,
          ctx.apiKey
        )
      }
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
