import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  collectErrors,
  confirmDelete,
  uniqueName,
  selectOption,
  checkBox,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-org-api-keys-page'
const FORM_ID = 'api-key-form'

test.describe.serial('CRUD API Keys', () => {
  const keyName = uniqueName('pw-apikey')
  let keyId: string | undefined

  test('CREATE — should generate a new API key via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/api-keys`, PAGE_CLASS)

    // Open create drawer
    await openDrawer(page, /Generate API Key/i)

    // Fill key name
    await fillField(page, 'tdsk-api-key-name', keyName)

    // Select expiration (30 days)
    await selectOption(page, 'tdsk-api-key-expiration', '30 days')

    // Select all permissions via the PermissionsPicker header checkbox
    // (the legacy read/write/admin scopes were replaced by granular
    // permissions in the RBAC overhaul)
    await checkBox(page, 'tdsk-perm-select-all')

    // Submit the form
    await submitForm(page, FORM_ID)

    // After generation, the drawer shows the key with a "Done" button
    await expect(page.getByText('Make sure to copy your API key')).toBeVisible({
      timeout: 10_000,
    })

    // Click Done to close
    const doneButton = page.getByRole('button', { name: /Done/i })
    await expect(doneButton).toBeVisible({ timeout: 3_000 })
    await doneButton.click()

    // Wait for drawer to close
    await expect(page.locator('.tdsk-drawer')).not.toBeVisible({
      timeout: 5_000,
    })

    // Verify the key appears in the table with Active status
    // (API Keys page does not have a search bar)
    await expect(page.getByText(keyName)).toBeVisible({ timeout: 10_000 })

    const row = page.locator('tr', { has: page.getByText(keyName) })
    await expect(row.getByText('Active')).toBeVisible()

    // Get the key ID from the API for cleanup
    const res = await page.request.get(
      `https://px.local.threadedstack.app/_/orgs/${ctx.orgId}/api-keys?limit=200`,
      {
        ignoreHTTPSErrors: true,
        headers: { Authorization: `Bearer ${ctx.apiKey}` },
      }
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data)
      ? body.data
      : []
    const found = arr.find((k) => k.name === keyName)
    if (found?.id) keyId = found.id as string

    expect(keyId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('READ — should display the generated key in the table', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!keyId, 'No key ID — CREATE must have failed')

    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/api-keys`, PAGE_CLASS)

    // Verify key name is visible (no search bar on this page)
    await expect(page.getByText(keyName)).toBeVisible({ timeout: 10_000 })

    // Verify the permissions summary chip renders (granular permissions
    // replaced the legacy scope chips)
    const row = page.locator('tr', { has: page.getByText(keyName) })
    const permChip = row.locator('.MuiChip-root').first()
    await expect(permChip).toBeVisible()
    await expect(permChip).not.toHaveText('No permissions')

    // Verify status is Active
    await expect(row.getByText('Active')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('REVOKE — should revoke the API key', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!keyId, 'No key ID — CREATE must have failed')

    const errors = collectErrors(page)
    await gotoAndWait(page, `/orgs/${ctx.orgId}/api-keys`, PAGE_CLASS)

    // Find the row and click the revoke action button (no search bar on this page)
    const row = page.locator('tr', { has: page.getByText(keyName) })
    const revokeButton = row.locator('.MuiIconButton-colorError').first()
    await revokeButton.click()

    // Confirm the revocation (API keys use "Revoke" text)
    await confirmDelete(page, /Revoke/i)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    // After revocation, the key is removed from local state / table
    await expect(
      page.locator('.MuiTableBody-root').getByText(keyName)
    ).not.toBeVisible({ timeout: 10_000 })

    // Mark as handled (revoked keys don't need cleanup)
    keyId = undefined

    expect(errors).toEqual([])
  })
})
