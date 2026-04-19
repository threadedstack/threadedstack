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
  toggleSwitch,
  ensureFullListLoad,
} from '../utils/crud-helpers'
import { isFeatureEnabled } from '@tdsk/domain'

const PAGE_CLASS = 'tdsk-org-skills-page'
const FORM_ID = 'skill-form'

test.describe.serial('CRUD Skills', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isFeatureEnabled('skills'), 'skills feature flag is disabled')
  })
  const skillName = uniqueName('pw-skill')
  const updatedName = uniqueName('pw-skill-upd')
  let skillId: string | undefined

  test('CREATE — should create a new skill via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, PAGE_CLASS)

    // Open create drawer
    await openDrawer(page, /Create Skill/i)

    // Fill skill name
    await fillField(page, 'tdsk-skill-name-input', skillName)

    // Fill description
    await fillField(page, 'tdsk-skill-description-input', 'Playwright CRUD test skill')

    // Fill instructions
    await fillField(page, 'tdsk-skill-instructions-input', 'Test instructions for automated testing')

    // Fill tools (comma-separated)
    await fillField(page, 'tdsk-skill-tools-input', 'tool-a, tool-b')

    // Fill trigger keywords (comma-separated)
    await fillField(page, 'tdsk-skill-trigger-keywords-input', 'test, automation')

    // Submit the form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close (data is fetched before drawer closes)
    await waitForDrawerClose(page)

    // Search for the skill in the table
    await searchInPage(page, skillName)

    // Verify the skill appears
    await expect(page.getByText(skillName)).toBeVisible({ timeout: 10_000 })

    // Get skill ID via API
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/skills?limit=200`,
      ctx.apiKey
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body)
        ? body
        : []
    const found = arr.find((s) => s.name === skillName)
    if (found?.id) skillId = found.id as string

    expect(skillId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('READ — should display the created skill in the table', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!skillId, 'No skill ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/skills`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, PAGE_CLASS)

    // Search for the skill
    await searchInPage(page, skillName)

    // Verify skill name is visible
    await expect(page.getByText(skillName)).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('UPDATE — should edit the skill name', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!skillId, 'No skill ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/skills`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, PAGE_CLASS)

    // Search for and click the skill row to open edit drawer
    await searchInPage(page, skillName)
    const nameCell = page
      .locator('.MuiTableBody-root')
      .getByText(skillName)
    await nameCell.click()

    // Wait for edit drawer to open
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // Update the name
    await fillField(page, 'tdsk-skill-name-input', updatedName)

    // Submit
    await submitForm(page, FORM_ID)

    // Wait for drawer to close (data is fetched before drawer closes)
    await waitForDrawerClose(page)

    // Search for updated name
    await searchInPage(page, updatedName)

    // Verify updated name appears
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('DELETE — should delete the skill', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!skillId, 'No skill ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/skills`)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, PAGE_CLASS)

    // Search for the skill (using updated name from UPDATE test)
    await searchInPage(page, updatedName)

    // Find the row and click the delete action button
    const row = page.locator('tr', { has: page.getByText(updatedName) })
    const deleteButton = row.locator('[aria-label="Delete skill"]')

    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()
    } else {
      // Fallback: try error-colored icon button
      const errorButton = row.locator('.MuiIconButton-colorError').first()
      await errorButton.click()
    }

    // Confirm the deletion (data is fetched before dialog closes)
    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    // Verify the skill is removed from the table
    await expect(
      page.locator('.MuiTableBody-root').getByText(updatedName)
    ).not.toBeVisible({ timeout: 10_000 })

    // Mark as cleaned up
    skillId = undefined

    expect(errors).toEqual([])
  })

  // Safety-net cleanup
  test.afterAll(async ({ browser }) => {
    if (!skillId) return
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
        `/orgs/${ctx.orgId}/skills/${skillId}`,
        ctx.apiKey
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
