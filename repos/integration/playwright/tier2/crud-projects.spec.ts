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
  findResourceByName,
  apiDeleteResource,
} from '../utils/crud-helpers'

const PROJECTS_PAGE_CLASS = 'tdsk-projects-page'
const SETTINGS_PAGE_CLASS = 'tdsk-project-settings-page'
const CREATE_FORM_ID = 'create-project-form'

test.describe.serial('CRUD Projects', () => {
  const projectName = uniqueName('pw-project')
  const projectDescription = 'Playwright CRUD test project'
  const updatedName = uniqueName('pw-project-upd')
  let projectId: string | undefined

  test('CREATE — should create a new project via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects`, PROJECTS_PAGE_CLASS)

    // Open create drawer (button text is "Create Project" in PageLayout or NoProjects)
    await openDrawer(page, /Create Project/i)

    // Fill form fields
    await fillField(page, 'tdsk-project-name', projectName)
    await fillField(page, 'tdsk-project-description', projectDescription)

    // Submit the form
    await submitForm(page, CREATE_FORM_ID)

    // Wait for drawer to close (indicates success)
    await waitForDrawerClose(page)

    // Verify the project card appears with the test name
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10_000 })

    // Capture project ID via API for navigation and cleanup
    const found = await findResourceByName(
      page,
      `/orgs/${ctx.orgId}/projects`,
      ctx.apiKey,
      projectName
    )
    if (found?.id) projectId = found.id as string

    expect(projectId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('READ — should display the created project in the grid', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects`, PROJECTS_PAGE_CLASS)

    // Verify project name is visible in the card grid
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('UPDATE — should update the project name via settings page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!projectId, 'No project ID — CREATE test must have failed')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${projectId}/settings`,
      SETTINGS_PAGE_CLASS
    )

    // The SettingsFormCard renders a text input for name
    // Find the "Project Name" input and update it
    const nameInput = page.locator('input[name="name"]')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })
    await nameInput.fill(updatedName)

    // Click the Save button (SettingsFormCard renders a Save button)
    const saveButton = page.getByRole('button', { name: /Save/i })
    await expect(saveButton).toBeEnabled({ timeout: 3_000 })
    await saveButton.click()

    // Verify the success alert appears
    await expect(page.getByText('Project updated successfully')).toBeVisible({
      timeout: 10_000,
    })

    expect(errors).toEqual([])
  })

  test('DELETE — should delete the project via settings page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!projectId, 'No project ID — CREATE test must have failed')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${projectId}/settings`,
      SETTINGS_PAGE_CLASS
    )

    // Click "Delete Project" in the DangerZoneCard
    const deleteButton = page.getByRole('button', { name: /Delete Project/i })
    await expect(deleteButton).toBeVisible({ timeout: 5_000 })
    await deleteButton.click()

    // Confirm the deletion
    await confirmDelete(page)

    // Should redirect back to projects list
    await page.waitForURL(`**/orgs/${ctx.orgId}/projects`, { timeout: 10_000 })

    // Verify the project is no longer visible
    // Use the updated name since we renamed it in the UPDATE test
    await expect(page.getByText(updatedName)).not.toBeVisible({
      timeout: 10_000,
    })

    // Mark as cleaned up
    projectId = undefined

    expect(errors).toEqual([])
  })

  // Safety-net cleanup if DELETE test didn't run or failed
  test.afterAll(async ({ browser }) => {
    if (!projectId) return
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()
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
        page,
        `/orgs/${ctx.orgId}/projects/${projectId}`,
        ctx.apiKey
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
