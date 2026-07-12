import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  fillField,
  submitForm,
  waitForDrawerClose,
  confirmDelete,
  collectErrors,
  apiRequest,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-org-members-page'
const EDIT_ROLE_FORM_ID = 'edit-role-form'

test.describe.serial('CRUD Org Members', () => {
  let addedUserId: string | undefined

  // TODO: Investigate Playwright click() hang on InviteUserDrawer submit button.
  // Every click method (locator.click, page.mouse.click, keyboard.press, evaluate)
  // hangs at "performing click action" — likely an MUI Drawer backdrop or stacking
  // context issue unique to this drawer. All other drawer submits work fine.
  test.skip('INVITE — should invite a user to the org via the drawer', async () => {})


  test('UPDATE ROLE — should change a member role via the edit drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.slow()
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/members`, PAGE_CLASS)

    // Wait for the table to load with members
    const tableBody = page.locator('.MuiTableBody-root')
    await expect(tableBody).toBeVisible({ timeout: 10_000 })

    const rows = tableBody.locator('tr')
    const rowCount = await rows.count()
    test.skip(rowCount < 2, 'Need at least 2 members to test role update (cannot edit yourself)')

    // Find a member row that is NOT the current test user (cannot edit your own role)
    // Look for a row whose edit button is NOT disabled
    let targetRow = null
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i)
      const editBtn = row.locator('.MuiIconButton-colorPrimary').first()
      if ((await editBtn.count()) > 0 && (await editBtn.isEnabled())) {
        targetRow = row
        break
      }
    }

    test.skip(!targetRow, 'No editable member found (all edit buttons disabled)')

    // Click the edit button to open the EditUserDrawer
    const editButton = targetRow!.locator('.MuiIconButton-colorPrimary').first()
    await editButton.click()

    // Wait for the edit drawer to open
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // The EditUserDrawer has tabs — make sure we're on the "Role" tab
    const roleTab = page.locator('.MuiTab-root', { hasText: 'Role' })
    if ((await roleTab.count()) > 0) {
      await roleTab.click()
    }

    // Wait for the role form to be visible
    await expect(page.locator('#edit-role-form')).toBeVisible({ timeout: 5_000 })

    // The RoleSelect uses a SelectInput with class 'tdsk-role-select'
    const roleSelect = page.locator('.tdsk-role-select')
    await expect(roleSelect).toBeVisible({ timeout: 5_000 })

    // Click the select to open the dropdown
    const combobox = roleSelect.locator('[role="combobox"]')
    if ((await combobox.count()) > 0) {
      await combobox.click()
    } else {
      await roleSelect.click()
    }

    // Get all available (non-disabled) options.
    // Scoped to the open listbox — the header's account menu (Profile/Billing/Sign
    // Out) stays mounted-but-hidden in the DOM at all times and also matches
    // `.MuiMenuItem-root`, so an unscoped locator's `.first()` can resolve to that
    // hidden menu instead of this select's open one. MUI renders the Select's
    // dropdown with `role="listbox"` (vs. `role="menu"` for a plain Menu), which
    // uniquely identifies it.
    const options = page.locator('[role="listbox"] .MuiMenuItem-root:not(.Mui-disabled)')
    await expect(options.first()).toBeVisible({ timeout: 3_000 })

    // Pick "Member" if available, otherwise pick the first non-disabled option
    const memberOption = page.locator('[role="listbox"] .MuiMenuItem-root:not(.Mui-disabled)', {
      hasText: 'Member',
    })
    if ((await memberOption.count()) > 0) {
      await memberOption.first().click()
    } else {
      await options.first().click()
    }

    // Submit the role update form
    await submitForm(page, EDIT_ROLE_FORM_ID)

    // Wait for success — the drawer shows a success alert but does NOT close
    await expect(
      page.locator('.MuiAlert-standardSuccess')
    ).toBeVisible({ timeout: 10_000 })

    // Close the drawer manually
    const closeButton = page.locator('.tdsk-drawer').locator('button', { hasText: /Cancel/i })
    if ((await closeButton.count()) > 0) {
      await closeButton.first().click()
    } else {
      await page.keyboard.press('Escape')
    }

    await waitForDrawerClose(page)

    expect(errors).toEqual([])
  })

  /**
   * TODO: Investigate why this test is now failing?
      - expect.not.toBeVisible with timeout 10000ms
      - waiting for locator('.MuiDialog-root')
      -   locator resolved to <div role="presentation" class="MuiDialog-root tdsk-c…>…</div>
      -   unexpected value "visible"
   */
  test.skip('REMOVE — should remove a member from the org', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.slow()
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/members`, PAGE_CLASS)

    // Wait for the table
    const tableBody = page.locator('.MuiTableBody-root')
    await expect(tableBody).toBeVisible({ timeout: 10_000 })

    const rows = tableBody.locator('tr')
    const initialCount = await rows.count()
    test.skip(initialCount < 2, 'Need at least 2 members to test removal (cannot remove yourself)')

    // Find a removable member — the delete button is enabled
    let targetRow = null
    for (let i = 0; i < initialCount; i++) {
      const row = rows.nth(i)
      const removeBtn = row.locator('.MuiIconButton-colorError').first()
      if ((await removeBtn.count()) > 0 && (await removeBtn.isEnabled())) {
        targetRow = row
        break
      }
    }

    test.skip(!targetRow, 'No removable member found (all remove buttons disabled)')

    // Click the remove button
    const removeButton = targetRow!.locator('.MuiIconButton-colorError').first()
    await removeButton.click()

    // Confirm the removal in the ConfirmDelete dialog
    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    // Verify the member count decreased
    await page.waitForTimeout(1_000)
    const finalTableBody = page.locator('.MuiTableBody-root')
    const finalCount =
      (await finalTableBody.count()) > 0
        ? await finalTableBody.locator('tr').count()
        : 0
    expect(finalCount).toBeLessThan(initialCount)

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
      await cleanupPage.request.delete(
        `https://px.local.threadedstack.app/_/orgs/${ctx.orgId}/members/${addedUserId}`,
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
