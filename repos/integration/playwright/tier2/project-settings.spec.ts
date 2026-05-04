import { test, expect } from '../fixtures/auth'
import { collectErrors, gotoAndWait } from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-settings-page'

test.describe('Project Settings Page', () => {
  test('should render the project settings page with project name heading', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/settings`,
      PAGE_CLASS
    )

    // The heading shows the project name or "Project" fallback
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should render the settings form with project name field', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/settings`,
      PAGE_CLASS
    )

    // SettingsFormCard renders fields: Project Name, Git URL, Branch
    const nameInput = page.locator('#tdsk-settings-name')
    await expect(nameInput).toBeVisible()

    // The name field should have a value (the project name)
    const value = await nameInput.inputValue()
    expect(value.length).toBeGreaterThan(0)

    expect(errors).toEqual([])
  })

  test('should show save button disabled when no changes are made', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/settings`,
      PAGE_CLASS
    )

    // The Save button should be disabled when no changes exist
    const saveButton = page.getByRole('button', { name: /Save/i }).first()
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toBeDisabled()

    expect(errors).toEqual([])
  })

  test('should render the Project Information card with project ID', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/settings`,
      PAGE_CLASS
    )

    // InfoCard with title "Project Information"
    await expect(page.getByText('Project Information')).toBeVisible()

    // Project ID label and value
    await expect(page.getByText('Project ID')).toBeVisible()
    await expect(page.getByText(ctx.projectId)).toBeVisible()

    // Org ID label and value
    await expect(page.getByText('Org ID')).toBeVisible()
    await expect(page.getByText(ctx.orgId)).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should render the Danger Zone card with delete project button', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/settings`,
      PAGE_CLASS
    )

    // DangerZoneCard renders "Danger Zone" heading
    await expect(page.getByText('Danger Zone')).toBeVisible()

    // "Delete this project" text
    await expect(page.getByText('Delete this project')).toBeVisible()

    // Delete Project button
    const deleteButton = page.getByRole('button', { name: /Delete Project/i })
    await expect(deleteButton).toBeVisible()

    expect(errors).toEqual([])
  })
})
