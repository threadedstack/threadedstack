import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  waitForDrawerClose,
  uniqueName,
  collectErrors,
  apiRequest,
  apiDeleteResource,
  searchInPage,
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-sandboxes-page'
const FORM_ID = 'sandbox-form'

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

    // Find the SSH Enabled switch — MUI Switch renders a checkbox input
    const sshLabel = page.locator('label', { hasText: 'SSH Enabled' })
    await expect(sshLabel).toBeVisible({ timeout: 5_000 })

    const sshCheckbox = sshLabel.locator('input[type="checkbox"]')
    await expect(sshCheckbox).toBeChecked()

    expect(errors).toEqual([])
  })

  test('Image preset buttons populate image field', async ({
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

    // Click the "Claude Code" preset button
    const claudePreset = page.getByRole('button', { name: 'Claude Code' })
    await expect(claudePreset).toBeVisible({ timeout: 5_000 })
    await claudePreset.click()

    // Verify the image field is populated with the consolidated sandbox image
    // All presets use the same TDSK_SB_IMAGE_FULL value after Dockerfile consolidation
    const imageInput = page.locator('#sandbox-image')
    const presetImage = await imageInput.inputValue()
    expect(presetImage).toBeTruthy()
    expect(presetImage).toContain('tdsk-sandbox')

    // Verify other preset buttons exist
    await expect(page.getByRole('button', { name: 'Codex' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'OpenCode' })).toBeVisible()

    // Click another preset to verify it also populates the field
    await page.getByRole('button', { name: 'Codex' }).click()
    await expect(imageInput).toHaveValue(presetImage)

    expect(errors).toEqual([])
  })

  test('Git Repository accordion shows repo and branch fields', async ({
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

    // Click the "Git Repository" accordion to expand it
    const gitAccordion = page.locator('.MuiAccordionSummary-root', { hasText: 'Git Repository' })
    await expect(gitAccordion).toBeVisible({ timeout: 5_000 })
    await gitAccordion.click()

    // Verify the git repo input is visible
    const gitRepoInput = page.locator('#sandbox-git-repo')
    await expect(gitRepoInput).toBeVisible({ timeout: 5_000 })

    // Verify the git branch input is visible with default value 'main'
    const gitBranchInput = page.locator('#sandbox-git-branch')
    await expect(gitBranchInput).toBeVisible({ timeout: 5_000 })
    await expect(gitBranchInput).toHaveValue('main')

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

    // Fill name and image
    await fillField(page, 'sandbox-name', sandboxName)
    await fillField(page, 'sandbox-image', 'node:22-slim')

    // Toggle SSH off — click the label containing the switch
    const sshLabel = page.locator('label', { hasText: 'SSH Enabled' })
    await sshLabel.click()

    // Expand Git Repository accordion
    const gitAccordion = page.locator('.MuiAccordionSummary-root', { hasText: 'Git Repository' })
    await gitAccordion.click()

    // Fill git repo and branch
    await fillField(page, 'sandbox-git-repo', 'https://github.com/test/repo.git')
    const gitBranchInput = page.locator('#sandbox-git-branch')
    await gitBranchInput.fill('dev')

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
    await expect(page.getByText(sandboxName)).toBeVisible({ timeout: 10_000 })

    // Click the row to open the edit drawer
    const row = page.locator('tr', { has: page.getByText(sandboxName) })
    const editButton = row.locator('button').filter({ has: page.locator('[data-testid="EditIcon"]') })
    if ((await editButton.count()) > 0) {
      await editButton.first().click()
    } else {
      await row.click()
    }

    // Wait for edit drawer to open
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Edit Sandbox Config')).toBeVisible({ timeout: 5_000 })

    // Verify SSH toggle is unchecked (we toggled it off)
    const editSshLabel = page.locator('label', { hasText: 'SSH Enabled' })
    const editSshCheckbox = editSshLabel.locator('input[type="checkbox"]')
    await expect(editSshCheckbox).not.toBeChecked()

    // Expand Git Repository accordion to verify fields
    const editGitAccordion = page.locator('.MuiAccordionSummary-root', { hasText: 'Git Repository' })
    await editGitAccordion.click()

    // Verify git repo
    const editGitRepo = page.locator('#sandbox-git-repo')
    await expect(editGitRepo).toHaveValue('https://github.com/test/repo.git')

    // Verify git branch
    const editGitBranch = page.locator('#sandbox-git-branch')
    await expect(editGitBranch).toHaveValue('dev')

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
