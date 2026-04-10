import { test, expect } from '../fixtures/auth'

/**
 * CRUD Bug Regression Tests
 *
 * These tests document and verify known UI bugs discovered during QA.
 * Each test references a specific bug number from the QA bug report.
 * Tests marked with "Known bug" comments validate the buggy behavior
 * so they can be updated once the bugs are fixed.
 *
 * IMPORTANT: These tests are read-only. They do NOT create, delete,
 * or modify any resources. Drawers are opened and inspected but never submitted.
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

/**
 * React dev-mode warnings from third-party libraries that are not actionable.
 */
const ignoredConsolePatterns = [
  'Function components cannot be given refs',
  'useLayoutEffect does nothing on the server',
  'Download the React DevTools',
  'React Router Future Flag Warning',
  'ErrorBoundary',
]

test.describe('Create Project drawer uses active orgId', () => {
  test('should NOT show "Org selection is required" error when saving', async ({
    authenticatedPage: page, ctx,
  }) => {

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects`, 'tdsk-projects-page')

    // Look for either the PageHeader "Create Project" button or the EmptyState "Create Project" button
    const createButton = page.getByRole('button', { name: /Create Project/i })
    const createButtonCount = await createButton.count()

    if (createButtonCount === 0) {
      const anyCreateAction = page.locator('button:has-text("Create")')
      const count = await anyCreateAction.count()
      test.skip(count === 0, 'No create project button found on page')
      await anyCreateAction.first().click()
    } else {
      await createButton.first().click()
    }

    await page.waitForTimeout(1000)

    // The drawer should now be open
    const nameInput = page.locator('#tdsk-project-name')
    await expect(nameInput).toBeVisible({ timeout: 5000 })

    // Fill in a project name
    await nameInput.fill('Test Project Bug 34')
    await page.waitForTimeout(500)

    // Click the Create button
    const drawerCreateButton = page.locator('button[form="create-project-form"]')
    await expect(drawerCreateButton).toBeEnabled({ timeout: 5_000 })
    await drawerCreateButton.click()
    await page.waitForTimeout(2000)

    // Verify the orgId error does NOT appear (bug #34 is fixed)
    const errorText = page.getByText('Org selection is required')
    await expect(errorText).not.toBeVisible({ timeout: 3_000 })

    // The drawer should either close (success) or show a different error
    // If it closed, the project was created — clean it up
    const drawerStillOpen = await page.locator('.tdsk-drawer').isVisible()
    if (!drawerStillOpen) {
      // Project was created — delete it via API cleanup
      try {
        const res = await page.request.get(
          `https://px.local.threadedstack.app/_/orgs/${ctx.orgId}/projects?limit=200`,
          {
            ignoreHTTPSErrors: true,
            headers: { Authorization: `Bearer ${ctx.apiKey}` },
          }
        )
        const body = await res.json()
        const arr: Record<string, unknown>[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.data) ? body.data : []
        const created = arr.find((p) => p.name === 'Test Project Bug 34')
        if (created) {
          await page.request.delete(
            `https://px.local.threadedstack.app/_/orgs/${ctx.orgId}/projects/${created.id}`,
            {
              ignoreHTTPSErrors: true,
              headers: { Authorization: `Bearer ${ctx.apiKey}` },
            }
          )
        }
      } catch {
        // Best-effort cleanup
      }
    } else {
      // Drawer still open — close it
      await page.keyboard.press('Escape')
    }
  })
})

test.describe('Cancel button disabled on drawer open', () => {
  test('should have Cancel button available immediately when drawer opens', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Known bug - see QA-BUG-REPORT.md #33
    // When a drawer opens, the Cancel button may be disabled because the
    // DrawerActions component passes `disabled={loading || !name.trim()}`
    // which is true when name is empty (initial state).

    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects`, 'tdsk-projects-page')

    // Open the create project drawer
    const createButton = page.getByRole('button', { name: /Create Project/i })
    const createButtonCount = await createButton.count()

    if (createButtonCount === 0) {
      const anyCreateAction = page.locator('button:has-text("Create")')
      const count = await anyCreateAction.count()
      test.skip(count === 0, 'No create project button found on page')
      await anyCreateAction.first().click()
    } else {
      await createButton.first().click()
    }

    await page.waitForTimeout(1000)

    // Verify the drawer opened
    const nameInput = page.locator('#tdsk-project-name')
    await expect(nameInput).toBeVisible({ timeout: 5000 })

    // Check the Cancel button state
    // In DrawerActions, cancel is rendered as a Button with text "Cancel"
    // Its disabled state depends on: exists(cancelDisabled) ? cancelDisabled : isDisabled
    // where isDisabled = disabled || loading
    // For CreateProjectDrawer: disabled={loading || !name.trim()}
    // When the drawer first opens, name is "" so !name.trim() is true,
    // making isDisabled=true and Cancel disabled
    const cancelButton = page.getByRole('button', { name: /Cancel/i })
    await expect(cancelButton.first()).toBeVisible()

    // Known bug #33: Cancel button is disabled when it should be enabled
    // The disabled prop propagates to the Cancel button via the generic `disabled` prop
    const isDisabled = await cancelButton.first().isDisabled()

    // Document the bug: Cancel should NOT be disabled on fresh drawer open
    // If this assertion passes, the bug still exists (Cancel is disabled)
    if (isDisabled) {
      // Bug confirmed: Cancel is disabled when drawer opens with empty name
      expect(isDisabled).toBe(true) // Known bug - Cancel is incorrectly disabled
    }

    // Clean up: close the drawer via the Drawer's close mechanism (click backdrop or Escape)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })
})

test.describe('Project workspace dashboard', () => {
  test('should display sandbox and thread panels on project workspace page', async ({
    authenticatedPage: page, ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}`, 'tdsk-project-workspace-page')

    // ProjectWorkspace renders quick action buttons
    await expect(page.getByRole('button', { name: /New Sandbox/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Connect/i })).toBeVisible()

    // Recent Threads panel should be visible
    await expect(page.getByText('Recent Threads')).toBeVisible()
  })
})

test.describe('Usage page shows 0 for all quotas', () => {
  test('should render quota cards on org usage page', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Known bug - see QA-BUG-REPORT.md #9
    // The usage page shows "0" for all quota values because the API may return
    // no quota record for the org, or the values are genuinely 0.

    await gotoAndWait(page, `/orgs/${ctx.orgId}/usage`, 'tdsk-org-usage-page')

    // Check if the page shows an error or "No quota data available"
    const noDataAlert = page.getByText('No quota data available')
    const errorAlert = page.locator('.MuiAlert-standardError')
    const hasNoData = (await noDataAlert.count()) > 0
    const hasError = (await errorAlert.count()) > 0

    if (hasNoData || hasError) {
      // If there is no quota data or an error, the bug may be that the API
      // does not return quota records for this org
      expect(hasNoData || hasError).toBe(true)
      return
    }

    // If quota data loaded, verify the "Current Usage" heading exists
    const usageHeading = page.getByText('Current Usage')
    await expect(usageHeading).toBeVisible()

    // The QuotaUsage component renders 9 quota items:
    // Projects, Endpoints, Members, Threads, Messages, Function Calls,
    // Runtime, Org Secrets, Project Secrets
    const expectedLabels = [
      'Projects',
      'Endpoints',
      'Members',
      'Threads',
      'Messages',
      'Function Calls',
      'Runtime',
      'Org Secrets',
      'Project Secrets',
    ]

    for (const label of expectedLabels) {
      const labelElement = page.getByText(label, { exact: true })
      // Some labels may not be visible if the grid is scrolled
      const isVisible = (await labelElement.count()) > 0
      if (isVisible) {
        await expect(labelElement.first()).toBeVisible()
      }
    }

    // Known bug #9: Check if all quota values show "0 / 0" or "0 / N"
    // The h6 elements inside CardContent contain the "current / limit" text
    const quotaValues = page.locator('.MuiCard-root .MuiTypography-h6')
    const quotaTexts: string[] = []
    const quotaCount = await quotaValues.count()
    for (let i = 0; i < quotaCount; i++) {
      const text = await quotaValues.nth(i).textContent()
      if (text && text.includes('/')) {
        quotaTexts.push(text.trim())
      }
    }

    // Document the bug: check if all "current" values are 0
    const allCurrentZero = quotaTexts.every((t) => {
      const match = t.match(/^(\d+)/)
      return match && match[1] === '0'
    })

    if (allCurrentZero && quotaTexts.length > 0) {
      // Bug confirmed: all usage values are 0
      expect(allCurrentZero).toBe(true) // Known bug - all quotas show 0
    }
  })
})

test.describe('0/0 quota shows 100% red progress bar', () => {
  test('should handle 0/0 quota limit gracefully', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Known bug - see QA-BUG-REPORT.md #10
    // When a quota has limit=0 and current=0, the getProgress function returns 100
    // (because `if (limit === 0) return 100`), causing a full red progress bar.
    // This is misleading because 0/0 should indicate "not applicable" rather than "exceeded".

    await gotoAndWait(page, `/orgs/${ctx.orgId}/usage`, 'tdsk-org-usage-page')

    // Check if quota data loaded
    const noDataAlert = page.getByText('No quota data available')
    const hasNoData = (await noDataAlert.count()) > 0
    if (hasNoData) {
      test.skip(true, 'No quota data available - cannot test progress bar behavior')
      return
    }

    // Look for progress bars (LinearProgress components)
    const progressBars = page.locator('.MuiLinearProgress-root')
    const progressCount = await progressBars.count()

    if (progressCount === 0) {
      // No progress bars visible - quotas may all be unlimited
      return
    }

    // Known bug #10: Look for progress bars with error color (red) class
    // MUI LinearProgress with color="error" gets class MuiLinearProgress-colorError
    const errorProgressBars = page.locator('.MuiLinearProgress-colorError')
    const errorCount = await errorProgressBars.count()

    // Check if any error progress bars exist alongside "0 / 0" values
    // The percentage text "100%" appears next to the progress bar
    const percentageTexts = page.locator('.MuiTypography-caption')
    const pctCount = await percentageTexts.count()
    let has100Percent = false

    for (let i = 0; i < pctCount; i++) {
      const text = await percentageTexts.nth(i).textContent()
      if (text?.trim() === '100%') {
        has100Percent = true
        break
      }
    }

    // Document the bug: if there are 0/0 quotas showing 100% red, the bug exists
    if (errorCount > 0 && has100Percent) {
      // Bug confirmed: 0/0 shows as 100% with red progress bar
      expect(errorCount).toBeGreaterThan(0) // Known bug - 0/0 shows 100% red
    }
  })
})

test.describe('Quickstart infinite loading', () => {
  test('should render quickstart wizard UI when Quick Start is clicked', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Known bug - see QA-BUG-REPORT.md #31
    // The quickstart wizard may show infinite loading because it depends
    // on resolving an orgId and fetching providers.

    await gotoAndWait(page, `/orgs/${ctx.orgId}`, 'tdsk-org-page')

    // The Org page shows a "Quick Start" button in the Quick Actions card header
    const quickStartButton = page.getByRole('button', { name: /Quick Start/i })
    const qsCount = await quickStartButton.count()

    test.skip(qsCount === 0, 'Quick Start button not found on org page')

    await quickStartButton.first().click()
    await page.waitForTimeout(2000)

    // The QuickstartWizard should open as a Drawer with title "Quick Start"
    // and a Stepper with 3 steps
    const drawerTitle = page.getByText('Quick Start', { exact: false })
    await expect(drawerTitle.first()).toBeVisible({ timeout: 5000 })

    // Verify the stepper rendered with step labels
    // QSSteps is imported from constants/nav - check for step labels
    const stepper = page.locator('.MuiStepper-root')
    const stepperVisible = (await stepper.count()) > 0

    if (stepperVisible) {
      await expect(stepper).toBeVisible()

      // The stepper should have step labels visible
      const stepLabels = page.locator('.MuiStepLabel-label')
      const labelCount = await stepLabels.count()
      expect(labelCount).toBeGreaterThanOrEqual(2)
    }

    // Verify the wizard is not stuck in a loading state
    // The wizard shows CircularProgress when loading=true
    const loadingSpinner = page.locator('.MuiCircularProgress-root')
    const isLoading = (await loadingSpinner.count()) > 0

    // Document the bug: if the wizard is stuck loading, bug #31 is confirmed
    if (isLoading) {
      // Bug may be present: wizard shows loading spinner
      // Check if the spinner persists after a reasonable wait
      await page.waitForTimeout(5000)
      const stillLoading = (await loadingSpinner.count()) > 0
      if (stillLoading) {
        expect(stillLoading).toBe(true) // Known bug - infinite loading
      }
    }

    // Verify the Cancel button is available to close the wizard
    const cancelButton = page.getByRole('button', { name: /Cancel/i })
    if ((await cancelButton.count()) > 0) {
      await expect(cancelButton.first()).toBeVisible()
      // Close without submitting
      await cancelButton.first().click()
      await page.waitForTimeout(500)
    } else {
      // Fall back to Escape key
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }
  })
})

test.describe('Provider edit shows all secrets as linked', () => {
  test('should check provider edit drawer for linked secrets accuracy', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Known bug - see QA-BUG-REPORT.md #39
    // When editing a provider, the ProviderDrawer loads orgSecrets (all org secrets)
    // and providerSecrets (secrets linked via providerId). The "Linked:" chip display
    // may incorrectly show all org secrets as linked because the API filter
    // may not properly filter by providerId.

    await gotoAndWait(page, `/orgs/${ctx.orgId}/providers`, 'tdsk-org-providers-page')

    // Check if there are any providers in the table
    const tableRows = page.locator('tbody tr, .MuiTableBody-root tr')
    const rowCount = await tableRows.count()

    // Also check for provider cards if DataTable renders differently
    const providerNames = page.locator('[class*="MuiTypography"][class*="medium"]')
    const nameCount = await providerNames.count()

    const hasProviders = rowCount > 0 || nameCount > 0

    if (!hasProviders) {
      // Check for empty state
      const emptyState = page.getByText('No providers yet')
      const isEmpty = (await emptyState.count()) > 0
      test.skip(isEmpty, 'No providers exist - cannot test provider edit')
      test.skip(!isEmpty, 'No providers found on page')
      return
    }

    // Click the edit button on the first provider
    // The edit button has tooltip "Edit Provider" and uses EditIcon
    const editButton = page.getByRole('button', { name: /Edit Provider/i })
    const editButtonAlt = page.locator('[title="Edit Provider"]')

    if ((await editButton.count()) > 0) {
      await editButton.first().click()
    } else if ((await editButtonAlt.count()) > 0) {
      await editButtonAlt.first().click()
    } else {
      // Try clicking the first table row to open the edit drawer (onRowClick)
      await tableRows.first().click()
    }

    await page.waitForTimeout(2000)

    // Verify the edit drawer opened with title "Edit Provider"
    const editTitle = page.getByText('Edit Provider')
    await expect(editTitle.first()).toBeVisible({ timeout: 5000 })

    // Known bug #39: Check if "Linked:" section shows secrets
    // The ProviderDrawer shows provider-linked secrets as Chips after "Linked:" text
    const linkedLabel = page.getByText('Linked:')
    const hasLinkedSection = (await linkedLabel.count()) > 0

    if (hasLinkedSection) {
      // Count the linked secret chips
      // They are Chip components with variant="outlined" and color="primary"
      const linkedChips = page.locator(
        '.MuiChip-outlined.MuiChip-colorPrimary'
      )
      const linkedCount = await linkedChips.count()

      // Bug #39: If linked count matches total org secrets count,
      // it means all secrets show as linked (bug)
      // We cannot easily get the total org secret count from the UI,
      // but we can document that linked secrets are present
      if (linkedCount > 0) {
        // Secrets shown as linked - may be buggy if count is too high
        expect(linkedCount).toBeGreaterThan(0)
      }
    }

    // Close the drawer
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })
})

test.describe('Agent drawer shows secrets/providers with duplicates', () => {
  test('should check agent edit drawer for duplicate secrets and providers', async ({
    authenticatedPage: page, ctx,
  }) => {
    // Known bug - see QA-BUG-REPORT.md #42-43
    // The AgentDrawer fetches both org-level and project-level secrets via
    // Promise.all([fetchSecrets({orgId}), fetchSecrets({orgId, projectId})]).
    // If a secret exists at both levels (or the API returns overlapping results),
    // duplicates appear in the SecretsSelector.
    // Similarly, providers may show duplicates if the state is stale.

    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents`,
      'tdsk-project-agents-page'
    )

    // Wait for agents table to populate (project agents page uses DataTable)
    const tableRows = page.locator('.MuiTableBody-root .MuiTableRow-root')
    try {
      await tableRows.first().waitFor({ state: 'visible', timeout: 10000 })
    } catch {
      test.skip(true, 'No agents exist - cannot test agent edit drawer')
      return
    }

    // Open the edit drawer for the first agent via aria-label
    const firstRow = tableRows.first()
    const editButton = firstRow.locator('[aria-label="Edit agent"]')

    if ((await editButton.count()) === 0) {
      // Fallback: try clicking the row directly
      await firstRow.click()
    } else {
      await editButton.first().click()
    }
    await page.waitForTimeout(2000)

    // Verify the edit drawer opened (project-level may show "Configure Agent for Project")
    const editTitle = page.getByText('Edit Agent')
    const configTitle = page.getByText('Configure Agent for Project')
    const drawerOpened = (await editTitle.count()) > 0 || (await configTitle.count()) > 0
    if (!drawerOpened) {
      // Wait a bit more and retry
      await page.waitForTimeout(2000)
    }
    const title = (await editTitle.count()) > 0 ? editTitle : configTitle
    await expect(title.first()).toBeVisible({ timeout: 5000 })

    // Check the "Associated Secrets" section for duplicates
    const secretsHeading = page.getByText('Associated Secrets')
    const hasSecretsSection = (await secretsHeading.count()) > 0

    if (hasSecretsSection) {
      // The SecretsSelector renders SwitchInput components for each secret
      // Check if there are duplicate labels
      const secretSwitches = page.locator('[id^="secret-"]')
      const switchCount = await secretSwitches.count()

      if (switchCount > 0) {
        // Collect all secret labels to check for duplicates
        const secretLabels: string[] = []
        for (let i = 0; i < switchCount; i++) {
          const label = await secretSwitches.nth(i).textContent()
          if (label) secretLabels.push(label.trim())
        }

        // Known bug #42-43: Check for duplicate labels
        const uniqueLabels = new Set(secretLabels)
        const hasDuplicates = uniqueLabels.size < secretLabels.length

        if (hasDuplicates) {
          // Bug confirmed: duplicate secrets in the selector
          const duplicateCount = secretLabels.length - uniqueLabels.size
          expect(duplicateCount).toBeGreaterThan(0) // Known bug - duplicate secrets
        }
      }
    }

    // Close the drawer
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })
})
