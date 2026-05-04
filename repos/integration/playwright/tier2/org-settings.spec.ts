import { test, expect } from '../fixtures/auth'
import { collectErrors, gotoAndWait } from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-org-settings-page'

test.describe('Org Settings Page', () => {
  test('should render the org settings page with heading', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/settings`, PAGE_CLASS)

    // Page heading is "Settings"
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should render the General settings form with org name field', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/settings`, PAGE_CLASS)

    // The SettingsFormCard has title "General"
    await expect(page.getByText('General')).toBeVisible()

    // Name input field (id="tdsk-settings-name")
    const nameInput = page.locator('#tdsk-settings-name')
    await expect(nameInput).toBeVisible()

    // The name field should have a value (the org name)
    const value = await nameInput.inputValue()
    expect(value.length).toBeGreaterThan(0)

    expect(errors).toEqual([])
  })

  test('should show save button disabled when no changes are made', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/settings`, PAGE_CLASS)

    // The Save button from SettingsFormCard should be disabled when no changes
    const saveButton = page.getByRole('button', { name: /Save/i }).first()
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toBeDisabled()

    expect(errors).toEqual([])
  })

  test('should render the Metadata info card with org ID', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/settings`, PAGE_CLASS)

    // InfoCard with title "Metadata"
    await expect(page.getByText('Metadata')).toBeVisible()

    // ID label and value — the org ID should appear in monospace text
    await expect(page.getByText('ID')).toBeVisible()
    await expect(page.getByText(ctx.orgId)).toBeVisible()

    expect(errors).toEqual([])
  })

  test('should render the Danger Zone card with delete button', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/settings`, PAGE_CLASS)

    // DangerZoneCard renders "Danger Zone" heading
    await expect(page.getByText('Danger Zone')).toBeVisible()

    // "Delete this organization" description
    await expect(page.getByText('Delete this organization')).toBeVisible()

    // Delete button
    const deleteButton = page.getByRole('button', { name: /Delete/i })
    await expect(deleteButton).toBeVisible()

    expect(errors).toEqual([])
  })
})
