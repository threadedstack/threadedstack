import { test, expect } from '../fixtures/auth'

/**
 * Text Rendering Tests
 *
 * Detects the systematic "literal quotes in UI" issue where values
 * are rendered with surrounding `"` characters (e.g., `"No"` instead of `No`).
 * This affects 10+ locations across the admin UI.
 */

/**
 * Navigate to a URL and wait for the page component to render.
 * Uses the page-specific CSS class instead of arbitrary timeouts.
 */
async function gotoAndWait(
  page: import('@playwright/test').Page,
  url: string,
  pageClass: string,
  timeout = 10000
) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await expect(page.locator(`.${pageClass}`)).toBeVisible({ timeout })
}

test.describe('Text Rendering - Literal Quotes Detection', () => {
  /**
   * BUG #25 - Org card ID should not have literal quotes
   *
   * On the home/orgs page, org cards display the org ID.
   * The ID text should render as `ID: <uuid>` without surrounding `"` characters.
   */
  test('org card ID should not have literal quotes', async ({
    authenticatedPage: page,
  }) => {
    await gotoAndWait(page, '/', 'tdsk-home-page')

    // Find org card ID text - the OrgCard renders `ID: {org.id}`
    const orgCard = page.locator('.tdsk-org-card').first()
    await expect(orgCard).toBeVisible({ timeout: 10000 })

    // The ID line should contain the org ID without surrounding literal quotes
    const idText = orgCard.locator('text=/ID:/')
    await expect(idText).toBeVisible({ timeout: 5000 })

    // Get the actual rendered text
    const renderedText = await idText.textContent()

    // Verify it does NOT contain literal quote characters wrapping the ID value
    // Correct: `ID: 22f40206-...`  Wrong: `ID: "22f40206-..."` or `"ID: 22f40206-..."`
    expect(renderedText).not.toMatch(/"[0-9a-f]{8}-/)
    expect(renderedText).not.toMatch(/^"ID:/)
  })

  /**
   * BUG #36 - Delete dialog should not double-quote entity name
   *
   * When clicking Delete on the org detail page, the ConfirmDelete dialog
   * renders: `Are you sure you want to delete "<name>" ?`
   * The itemName should not itself contain extra quote characters,
   * making it display as `""name""`.
   */
  test('delete dialog should not double-quote entity name', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    // Click the Delete button to open the confirm dialog
    const deleteButton = page.locator('button', { hasText: 'Delete' }).first()
    await expect(deleteButton).toBeVisible({ timeout: 10000 })
    await deleteButton.click()

    // Wait for the dialog to appear
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // The dialog body text includes: Are you sure you want to delete "<name>" ?
    // Check that the name is NOT double-quoted (e.g., `""TDSK""` or `"\"TDSK\""`)
    const dialogText = await dialog.textContent()

    // The ConfirmDelete component already wraps itemName in quotes: `"${itemName}"`
    // So a bug would make it: `""name""` — two sets of quotes
    expect(dialogText).not.toMatch(/""[^"]+""/)

    // Also check the dialog title does NOT have extra quotes
    // Title renders as `Delete ${org.name}` or `Delete Organization?`
    const titleEl = dialog.locator('h2, [class*="DialogTitle"]').first()
    const titleText = await titleEl.textContent()
    expect(titleText).not.toMatch(/Delete "/)
    expect(titleText).not.toMatch(/"$/)

    // Close the dialog without deleting - click Cancel
    const cancelButton = dialog.locator('button', { hasText: 'Cancel' })
    await cancelButton.click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  /**
   * BUG #15 - Thread public column should not have quoted values
   *
   * On the threads page, the Public column renders `Yes` or `No`
   * based on `thread.public`. It should NOT render as `"No"` or `"Yes"`.
   */
  test('thread public column should not have quoted values', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`,
      'tdsk-project-threads-page'
    )

    // Check if there are threads rendered in a table
    const tableRows = page.locator('table tbody tr')
    const rowCount = await tableRows.count()

    if (rowCount > 0) {
      // Iterate through rows and check the Public column (4th column, index 3)
      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const row = tableRows.nth(i)
        const publicCell = row.locator('td').nth(3)
        const cellText = await publicCell.textContent()

        // The cell text should be exactly "Yes" or "No", not `"Yes"` or `"No"`
        expect(cellText?.trim()).not.toMatch(/^"(Yes|No)"$/)

        // If the cell has content, it should be clean text
        if (cellText?.trim()) {
          expect(cellText.trim()).toMatch(/^(Yes|No)$/)
        }
      }
    } else {
      // No threads exist — check for empty state, test is informational
      const emptyState = page.getByText(/No threads|no threads|Select an agent/i)
      await expect(emptyState).toBeVisible({ timeout: 5000 })
    }
  })

  /**
   * BUG #19 - Billing labels should not have quotes
   *
   * On the billing page, subscription detail labels like "Period Start:"
   * and "Period End:" should render without surrounding `"` characters.
   */
  test('billing labels should not have quotes', async ({
    authenticatedPage: page,
  }) => {
    await gotoAndWait(page, '/billing', 'tdsk-billing-page')

    // Check if subscription details are rendered
    const periodStartLabel = page.getByText(/Period Start/i).first()
    const hasSubscription = (await periodStartLabel.count()) > 0

    if (hasSubscription) {
      // Get the actual text content of the label
      const labelText = await periodStartLabel.textContent()

      // It should NOT have literal quotes around it
      // Correct: `Period Start: January 1, 2026`
      // Wrong: `"Period Start:" January 1, 2026` or `"Period Start: January 1, 2026"`
      expect(labelText).not.toMatch(/^"Period Start/)
      expect(labelText).not.toMatch(/":"/)

      // Check Period End label too
      const periodEndLabel = page.getByText(/Period End/i).first()
      if ((await periodEndLabel.count()) > 0) {
        const endLabelText = await periodEndLabel.textContent()
        expect(endLabelText).not.toMatch(/^"Period End/)
        expect(endLabelText).not.toMatch(/":"/)
      }

      // Check Subscription Details header
      const subDetailsHeader = page.getByText(/Subscription Details/i).first()
      if ((await subDetailsHeader.count()) > 0) {
        const headerText = await subDetailsHeader.textContent()
        expect(headerText).not.toMatch(/^"Subscription Details"$/)
      }
    } else {
      // No subscription — the billing page should still render without errors
      const body = page.locator('body').first()
      await expect(body).toBeVisible()
    }
  })

  /**
   * BUG #35 - DataTable pagination label should not have quotes
   *
   * MUI TablePagination renders a "Rows per page:" label.
   * This should not be wrapped in literal quote characters.
   * Tests on the secrets page which uses DataTable.
   */
  test('DataTable pagination label should not have quotes', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    // Navigate to a page that uses DataTable — secrets page is a good candidate
    await gotoAndWait(page, `/orgs/${ctx.orgId}/secrets`, 'tdsk-org-secrets-page')

    // Look for the pagination area
    const paginationArea = page.locator('[class*="TablePagination"], [class*="MuiTablePagination"]').first()
    const hasPagination = (await paginationArea.count()) > 0

    if (hasPagination) {
      const paginationText = await paginationArea.textContent()

      // The label "Rows per page:" should not be wrapped in quotes
      // Correct: `Rows per page: 10`
      // Wrong: `"Rows per page:" 10` or `"Rows per page: 10"`
      expect(paginationText).not.toMatch(/"Rows per page/)
      expect(paginationText).not.toMatch(/Rows per page"/)

      // Verify the clean label IS present
      expect(paginationText).toContain('Rows per page')
    } else {
      // If no pagination is visible, try API keys page
      await gotoAndWait(page, `/orgs/${ctx.orgId}/api-keys`, 'tdsk-org-api-keys-page')

      const altPagination = page.locator('[class*="TablePagination"], [class*="MuiTablePagination"]').first()
      if ((await altPagination.count()) > 0) {
        const altText = await altPagination.textContent()
        expect(altText).not.toMatch(/"Rows per page/)
        expect(altText).not.toMatch(/Rows per page"/)
        expect(altText).toContain('Rows per page')
      }
    }
  })

  /**
   * BUG #28 - Project branch in selector should not have quotes
   *
   * In the project sidebar menu, the secondary text shows `Branch: main`.
   * On the project detail page, the branch is shown as a Chip.
   * Neither should render with surrounding `"` characters.
   */
  test('project branch in selector should not have quotes', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}`, 'tdsk-project-page')

    // Check the Branch chip on the project detail page
    // The Project page renders: <Chip label={project.branch || 'main'} />
    const branchSection = page.locator('text=/Branch/i').first()
    await expect(branchSection).toBeVisible({ timeout: 10000 })

    // Find the Chip that shows the branch name
    const branchChip = page.locator('[class*="MuiChip"]', { hasText: /main/ }).first()
    if ((await branchChip.count()) > 0) {
      const chipText = await branchChip.textContent()

      // Branch chip should show `main`, not `"main"`
      expect(chipText?.trim()).not.toMatch(/^"main"$/)
      expect(chipText?.trim()).toBe('main')
    }

    // Also check the sidebar project menu for `Branch: main` text
    const branchText = page.getByText(/Branch:/).first()
    if ((await branchText.count()) > 0) {
      const sidebarBranchText = await branchText.textContent()

      // Should be `Branch: main`, not `"Branch: main"` or `Branch: "main"`
      expect(sidebarBranchText).not.toMatch(/^"Branch:/)
      expect(sidebarBranchText).not.toMatch(/"main"/)
      expect(sidebarBranchText).not.toMatch(/Branch:"/)
    }
  })
})
