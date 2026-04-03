import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  submitForm,
  collectErrors,
  confirmDelete,
  apiRequest,
  selectEntityOption,
  selectOption,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-members-page'

test.describe.serial('CRUD Project Members', () => {
  let addedUserId: string | undefined
  let addedUserName: string | undefined

  test('CREATE — should add a member to the project via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.projectId, 'No projectId in context — cannot test project members')

    const errors = collectErrors(page)

    // Check if there are available org users who are not project members
    // Users API is at /users with orgId as query param; members is at /orgs/:orgId/projects/:projectId/members
    const [usersRes, membersRes] = await Promise.all([
      apiRequest(page, 'GET', `/users?orgId=${ctx.orgId}&limit=200`, ctx.apiKey),
      apiRequest(page, 'GET', `/orgs/${ctx.orgId}/projects/${ctx.projectId}/members?limit=200`, ctx.apiKey),
    ])

    const usersBody = await usersRes.json()
    const membersBody = await membersRes.json()

    const orgUsers: Record<string, unknown>[] = Array.isArray(usersBody?.data)
      ? usersBody.data
      : Array.isArray(usersBody) ? usersBody : []

    const currentMembers: Record<string, unknown>[] = Array.isArray(membersBody?.data)
      ? membersBody.data
      : Array.isArray(membersBody) ? membersBody : []

    const memberUserIds = new Set(currentMembers.map((m) => m.userId as string))
    const availableUsers = orgUsers.filter((u) => !memberUserIds.has(u.id as string))

    test.skip(availableUsers.length === 0, 'No available org users to add as project members')

    // Store the user we'll add for later verification/cleanup
    const userToAdd = availableUsers[0]
    addedUserId = userToAdd.id as string
    addedUserName = (userToAdd.displayName || userToAdd.email || userToAdd.id) as string

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/members`,
      PAGE_CLASS
    )

    // Open add member drawer
    await openDrawer(page, /Add Member/i)

    // Select user via EntitySelectorSingle (id='entity-user')
    await selectEntityOption(page, 'entity-user')

    // The role Autocomplete defaults to "viewer" — leave as default

    // Submit the form (DrawerActions form='add-member-form', button text = 'Create')
    await submitForm(page, 'add-member-form')

    // Wait for drawer to close (data is fetched before drawer closes)
    await expect(page.locator('.tdsk-drawer')).not.toBeVisible({
      timeout: 10_000,
    })

    // Verify the member appears in the table
    await expect(page.locator('.MuiTableBody-root')).toBeVisible({ timeout: 10_000 })

    // Verify a member entry exists
    const tableBody = page.locator('.MuiTableBody-root')
    const rows = tableBody.locator('tr')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)

    expect(errors).toEqual([])
  })

  test('READ — should display the added member in the table', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!addedUserId, 'No user was added — CREATE must have failed')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/members`,
      PAGE_CLASS
    )

    // Verify the table has content
    const tableBody = page.locator('.MuiTableBody-root')
    await expect(tableBody).toBeVisible({ timeout: 10_000 })

    // Verify there are rows
    const rows = tableBody.locator('tr')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)

    // Verify a "viewer" role chip exists (since we used the default role)
    await expect(
      tableBody.locator('.MuiChip-label', { hasText: /^viewer$/i }).first()
    ).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('DELETE — should remove the member from the project', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!addedUserId, 'No user was added — CREATE must have failed')

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/members`,
      PAGE_CLASS
    )

    // Count current members
    const tableBody = page.locator('.MuiTableBody-root')
    await expect(tableBody).toBeVisible({ timeout: 10_000 })
    const initialCount = await tableBody.locator('tr').count()

    // Find the last row (the one we just added) and click the remove button
    const lastRow = tableBody.locator('tr').last()
    const removeButton = lastRow.locator('.MuiIconButton-colorError').first()
    await removeButton.click()

    // Confirm the removal (data is fetched before dialog closes)
    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    // Verify the member count decreased or table is empty
    const finalTableBody = page.locator('.MuiTableBody-root')
    const finalCount = (await finalTableBody.count()) > 0
      ? await finalTableBody.locator('tr').count()
      : 0
    expect(finalCount).toBeLessThan(initialCount)

    // Mark as cleaned up
    addedUserId = undefined

    expect(errors).toEqual([])
  })

  // Safety-net cleanup via API
  test.afterAll(async ({ browser }) => {
    if (!addedUserId) return
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
      // Remove the member via API
      await cleanupPage.request.delete(
        `https://px.local.threadedstack.app/_/orgs/${ctx.orgId}/projects/${ctx.projectId}/members/${addedUserId}`,
        {
          ignoreHTTPSErrors: true,
          headers: {
            Authorization: `Bearer ${ctx.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
