import { test, expect } from '../fixtures/auth'

/**
 * Org Skills page integration tests.
 *
 * Validates the new Skills page renders correctly, SkillDrawer form
 * has all expected fields, sidebar navigation includes Skills item,
 * and the table renders correct columns when data exists.
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

test.describe('Org Skills Page', () => {
  test('renders Skills page with heading and empty/list state', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, 'tdsk-org-skills-page')

    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible()

    // Either empty state or table should render
    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()

    if (rowCount === 0) {
      await expect(
        page.getByText('No skills yet. Create your first skill to get started.')
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Create Skill' })).toBeVisible()
    } else {
      await expect(tableRows.first()).toBeVisible()
    }

    expect(errors).toEqual([])
  })

  test('Create Skill button opens SkillDrawer with correct fields', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, 'tdsk-org-skills-page')

    await page.getByRole('button', { name: 'Create Skill' }).click()
    await page.waitForTimeout(1000)

    await expect(page.getByText('Create New Skill')).toBeVisible()
    await expect(page.locator('#tdsk-skill-name-input')).toBeVisible()
    await expect(page.locator('#tdsk-skill-description-input')).toBeVisible()
    await expect(page.locator('#tdsk-skill-instructions-input')).toBeVisible()
    await expect(page.locator('#tdsk-skill-tools-input')).toBeVisible()
    await expect(page.locator('#tdsk-skill-trigger-keywords-input')).toBeVisible()
    // Scope to the drawer form to avoid matching table header or skill names
    await expect(page.locator('#skill-form').getByText('Always Active')).toBeVisible()

    await page.keyboard.press('Escape')
  })

  test('SkillDrawer Always Active switch defaults to off', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, 'tdsk-org-skills-page')

    await page.getByRole('button', { name: 'Create Skill' }).click()
    await page.waitForTimeout(1000)

    // The MUI Switch renders an internal checkbox
    const switchControl = page
      .locator('label')
      .filter({ hasText: 'Always Active' })
      .locator('input[type="checkbox"]')
    await expect(switchControl).not.toBeChecked()

    await page.keyboard.press('Escape')
  })

  test('Skills table columns render correctly when data exists', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, 'tdsk-org-skills-page')

    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()
    test.skip(rowCount === 0, 'No skills data — cannot test table columns')

    // Column headers
    await expect(page.locator('thead').getByText('Name')).toBeVisible()
    await expect(page.locator('thead').getByText('Description')).toBeVisible()
    await expect(page.locator('thead').getByText('Always Active')).toBeVisible()
    await expect(page.locator('thead').getByText('Actions')).toBeVisible()

    // Action buttons in first row
    await expect(page.locator('[aria-label="Edit Skill"]').first()).toBeVisible()
    await expect(page.locator('[aria-label="Delete Skill"]').first()).toBeVisible()

    // Always Active chip
    const chip = page.locator('.MuiChip-root').filter({ hasText: /^(Yes|No)$/ }).first()
    await expect(chip).toBeVisible()
  })

  test('clicking table row opens SkillDrawer in edit mode', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, 'tdsk-org-skills-page')

    const tableRows = page.locator('tbody tr')
    const rowCount = await tableRows.count()
    test.skip(rowCount === 0, 'No skills data — cannot test row click')

    await tableRows.first().click()
    await page.waitForTimeout(1000)

    await expect(page.getByText('Edit Skill')).toBeVisible()
    await expect(page.locator('#tdsk-skill-name-input')).not.toHaveValue('')

    await page.keyboard.press('Escape')
  })

  test('Skills nav item appears in org sidebar', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, 'tdsk-org-skills-page')

    const sidebar = page.locator('.tdsk-admin-sidebar')
    await expect(sidebar.getByText('Skills')).toBeVisible()
    await expect(sidebar.getByText('Schedules')).toBeVisible()
  })

  test('no unexpected console errors on Skills page', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors = collectConsoleErrors(page)

    await gotoAndWait(page, `/orgs/${ctx.orgId}/skills`, 'tdsk-org-skills-page')
    await page.waitForTimeout(2000)

    expect(errors).toEqual([])
  })
})
