import { test, expect } from '../fixtures/auth'

/**
 * Org Schedules page integration tests.
 *
 * Validates the new Schedules page renders correctly, ScheduleDrawer
 * form has all expected fields with correct defaults, the agent select
 * populates, and the table renders correct columns when data exists.
 */

const ignoredPatterns = [
  'Function components cannot be given refs',
  'useLayoutEffect does nothing on the server',
  'Download the React DevTools',
  'React does not recognize',
  'Warning:',
  'Failed to load resource',
  'net::ERR_',
  '404',
]

const isIgnored = (text: string): boolean =>
  ignoredPatterns.some((p) => text.includes(p))

async function gotoAndWait(
  page: import('@playwright/test').Page,
  url: string,
  pageClass: string,
  timeout = 15000
) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await expect(page.locator(`.${pageClass}`)).toBeVisible({ timeout })
}

function collectConsoleErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
  })
  return errors
}

test.describe('Org Schedules Page', () => {
  test('renders Schedules page with heading and empty/list state', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/schedules`, 'tdsk-org-schedules-page')

    await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible()

    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    if (rowCount === 0) {
      await expect(
        page.getByText('No schedules yet. Create your first schedule to get started.')
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Create Schedule' })).toBeVisible()
    } else {
      await expect(tableRows.first()).toBeVisible()
    }

    expect(errors).toEqual([])
  })

  test('Create Schedule button opens ScheduleDrawer with correct fields', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/schedules`, 'tdsk-org-schedules-page')

    await page.getByRole('button', { name: 'Create Schedule' }).click()
    await page.waitForTimeout(1000)

    await expect(page.getByText('Create New Schedule')).toBeVisible()
    await expect(page.locator('#agent-id')).toBeVisible()
    await expect(page.locator('#tdsk-schedule-cron-input')).toBeVisible()
    await expect(page.locator('#tdsk-schedule-prompt-input')).toBeVisible()
    const form = page.locator('#schedule-form')
    await expect(form.getByText('Enabled')).toBeVisible()
    await expect(form.getByText('New Thread Per Run')).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('ScheduleDrawer switches default to on', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/schedules`, 'tdsk-org-schedules-page')

    await page.getByRole('button', { name: 'Create Schedule' }).click()
    await page.waitForTimeout(1000)

    // Both Enabled and New Thread Per Run default to true
    const enabledSwitch = page.locator('input[name="schedule-enabled"]')
    const createThreadSwitch = page.locator('input[name="schedule-new-thread"]')

    await expect(enabledSwitch).toBeChecked()
    await expect(createThreadSwitch).toBeChecked()

    await page.keyboard.press('Escape')
  })

  test('ScheduleDrawer agent select populates with agents', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/schedules`, 'tdsk-org-schedules-page')

    await page.getByRole('button', { name: 'Create Schedule' }).click()
    await page.waitForTimeout(1000)

    // Open the MUI Select dropdown
    await page.locator('#agent-id').click()
    await page.waitForTimeout(500)

    // At least one agent should be in the dropdown
    const menuItems = page.locator('.MuiMenuItem-root')
    expect(await menuItems.count()).toBeGreaterThan(0)

    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
  })

  test('ScheduleDrawer cron input has correct placeholder', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/schedules`, 'tdsk-org-schedules-page')

    await page.getByRole('button', { name: 'Create Schedule' }).click()
    await page.waitForTimeout(1000)

    await expect(page.locator('#tdsk-schedule-cron-input')).toHaveAttribute(
      'placeholder',
      'e.g. 0 9 * * 1-5 (weekdays at 9am)'
    )

    await page.keyboard.press('Escape')
  })

  test('Schedules table columns render correctly when data exists', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/schedules`, 'tdsk-org-schedules-page')

    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()
    test.skip(rowCount === 0, 'No schedules data — cannot test table columns')

    // Column headers
    await expect(page.locator('thead').getByText('Prompt')).toBeVisible()
    await expect(page.locator('thead').getByText('Cron')).toBeVisible()
    await expect(page.locator('thead').getByText('Status')).toBeVisible()
    await expect(page.locator('thead').getByText('Next Run')).toBeVisible()
    await expect(page.locator('thead').getByText('Actions')).toBeVisible()

    // Action buttons in first row
    await expect(page.locator('[aria-label="Trigger Now"]').first()).toBeVisible()
    await expect(page.locator('[aria-label="Edit Schedule"]').first()).toBeVisible()
    await expect(page.locator('[aria-label="Delete Schedule"]').first()).toBeVisible()

    // Status chip
    const chip = page
      .locator('.MuiChip-root')
      .filter({ hasText: /^(Enabled|Disabled)$/ })
      .first()
    await expect(chip).toBeVisible()
  })

  test('clicking table row opens ScheduleDrawer in edit mode', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/schedules`, 'tdsk-org-schedules-page')

    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()
    test.skip(rowCount === 0, 'No schedules data — cannot test row click')

    await tableRows.first().click()
    await page.waitForTimeout(1000)

    await expect(page.getByText('Edit Schedule')).toBeVisible()

    await page.keyboard.press('Escape')
  })
})
