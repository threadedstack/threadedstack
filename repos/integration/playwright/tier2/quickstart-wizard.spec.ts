import { test, expect } from '../fixtures/auth'

/**
 * Quickstart Wizard UI validation tests.
 *
 * Verifies the wizard drawer opens from the Org page,
 * renders provider cards with icons, supports multi-step
 * navigation with Cancel/Back/Next buttons, and closes correctly.
 *
 * NOTE: These tests do NOT submit the wizard (Create Everything)
 * to avoid creating resources in the live database.
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
  timeout = 10000
) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  await expect(page.locator(`.${pageClass}`)).toBeVisible({ timeout })
}

/**
 * Navigate to the org detail page where the Quick Start button lives.
 * The Quickstart component renders in the Quick Actions card header.
 */
async function navigateToOrgPage(
  page: import('@playwright/test').Page,
  orgId: string
) {
  await gotoAndWait(page, `/orgs/${orgId}`, 'tdsk-org-page')
}

/**
 * Wait for the model input to appear and select/fill a model.
 * Models are fetched dynamically from the backend. The UI renders either
 * a SelectInput (#model-select-{brand}) when models load successfully,
 * or a TextInput (#model-input-{brand}) as fallback.
 */
async function selectModel(page: import('@playwright/test').Page, brand = 'anthropic') {
  const modelSelect = page.locator(`#model-select-${brand}`)
  const modelTextInput = page.locator(`#model-input-${brand}`)
  await expect(modelSelect.or(modelTextInput)).toBeVisible({ timeout: 10000 })

  if (await modelSelect.isVisible()) {
    // MUI Select: click the combobox trigger to open the dropdown
    const wrapper = page.locator('.MuiInputBase-root').filter({ has: modelSelect })
    await wrapper.locator('[role="combobox"]').click()
    // Wait for dropdown listbox to appear, then select the first option
    await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 5000 })
    await page.locator('[role="listbox"] [role="option"]').first().click()
  } else {
    await modelTextInput.fill('claude-sonnet-4-20250514')
  }
}

test.describe('Quickstart Wizard', () => {
  test('Opens wizard from Org page and renders provider cards with icons', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await navigateToOrgPage(page, ctx.orgId)

    // Click the Quick Start action card (rendered as a Card, not a button)
    const quickstartBtn = page.locator('.tdsk-ac-card').filter({ hasText: 'Quick Start' })
    await expect(quickstartBtn).toBeVisible({ timeout: 5000 })
    await quickstartBtn.click()

    // The drawer should open with "Quick Start" title
    await expect(page.getByText('Quick Start').first()).toBeVisible()

    // Stepper should show 3 step labels
    await expect(page.getByText('AI Provider', { exact: true })).toBeVisible()
    await expect(page.getByText('Project & Agent', { exact: true })).toBeVisible()
    await expect(page.getByText('Review & Create', { exact: true })).toBeVisible()

    // Provider cards should be visible — check for at least 4 known providers
    for (const name of ['Anthropic', 'OpenAI', 'Google AI', 'Z.AI']) {
      await expect(page.getByText(name, { exact: true })).toBeVisible()
    }

    // Each provider card should contain an SVG icon
    const providerCards = page.locator('.MuiCardActionArea-root')
    const cardCount = await providerCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(4)

    for (let i = 0; i < cardCount; i++) {
      const svgs = providerCards.nth(i).locator('svg')
      await expect(svgs.first()).toBeVisible()
    }

    // Step 0 should show Cancel and Next buttons (no Back)
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Next/i })).toBeVisible()

    // Next should be disabled (no provider selected, no API key)
    await expect(page.getByRole('button', { name: /Next/i })).toBeDisabled()

    expect(errors).toEqual([])
  })

  test('Step navigation — Cancel + Back + Next on step > 0', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await navigateToOrgPage(page, ctx.orgId)

    // Open wizard
    await page.locator('.tdsk-ac-card').filter({ hasText: 'Quick Start' }).click()
    await expect(page.getByText('Quick Start').first()).toBeVisible()

    // Select Anthropic provider
    await page.getByText('Anthropic', { exact: true }).click()

    // API Key input should appear
    const apiKeyInput = page.locator('#quickstart-api-key')
    await expect(apiKeyInput).toBeVisible()

    // Fill a dummy API key (we won't submit)
    await apiKeyInput.fill('sk-ant-test-dummy-key')

    // Wait for models to load and select one (required for Next to be enabled)
    await selectModel(page)

    // Next should now be enabled
    await expect(page.getByRole('button', { name: /Next/i })).toBeEnabled()

    // Click Next → Step 1 (Project & Agent)
    await page.getByRole('button', { name: /Next/i }).click()

    // Wait for step 1 content to render
    await expect(page.locator('#quickstart-project-name')).toBeVisible({ timeout: 5000 })

    // Step > 0 should show Cancel (left) + Back + Next buttons
    const cancelBtn = page.getByRole('button', { name: /Cancel/i })
    const backBtn = page.getByRole('button', { name: /Back/i })
    const nextBtn = page.getByRole('button', { name: /Next/i })

    await expect(cancelBtn).toBeVisible()
    await expect(backBtn).toBeVisible()
    await expect(nextBtn).toBeVisible()

    // Back button should navigate back to step 0
    await backBtn.click()
    await expect(page.getByText('Anthropic', { exact: true })).toBeVisible()

    // After going back, step 0 should NOT have Back button
    await expect(page.getByRole('button', { name: /Back/i })).not.toBeVisible()

    expect(errors).toEqual([])
  })

  test('Full wizard flow through Review step', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await navigateToOrgPage(page, ctx.orgId)

    // Open wizard
    await page.locator('.tdsk-ac-card').filter({ hasText: 'Quick Start' }).click()
    await expect(page.getByText('Quick Start').first()).toBeVisible()

    // Step 0: Select Anthropic, fill API key, select model
    await page.getByText('Anthropic', { exact: true }).click()
    await page.locator('#quickstart-api-key').fill('sk-ant-test-dummy-key')
    await selectModel(page)

    // Advance to Step 1
    await page.getByRole('button', { name: /Next/i }).click()
    await expect(page.locator('#quickstart-project-name')).toBeVisible({ timeout: 5000 })

    // Step 1: auto-populated project & agent names should be filled
    const projectInput = page.locator('#quickstart-project-name')
    const agentInput = page.locator('#quickstart-agent-name')
    await expect(projectInput).toHaveValue(/./i)
    await expect(agentInput).toHaveValue(/./i)

    // Advance to Step 2 (Review)
    await page.getByRole('button', { name: /Next/i }).click()

    // Review step should show resource summary
    await expect(page.getByText('Ready to create 5 resources')).toBeVisible({ timeout: 5000 })

    // Verify resource labels are present
    for (const label of ['Provider', 'Secret', 'Project', 'Agent', 'Endpoint']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }

    // Step 2 should show "Create Everything" button instead of "Next"
    await expect(page.getByRole('button', { name: /Create Everything/i })).toBeVisible()

    // Cancel and Back should still be available
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Back/i })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('Cancel button closes wizard on any step', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
    })

    await navigateToOrgPage(page, ctx.orgId)

    // Open wizard
    await page.locator('.tdsk-ac-card').filter({ hasText: 'Quick Start' }).click()
    await expect(page.getByText('Quick Start').first()).toBeVisible()

    // Cancel on step 0 should close the drawer
    await page.getByRole('button', { name: /Cancel/i }).click()

    // Drawer should be gone
    await expect(page.getByText('AI Provider', { exact: true })).not.toBeVisible({ timeout: 3000 })

    // Re-open and navigate to step 1, then cancel
    await page.locator('.tdsk-ac-card').filter({ hasText: 'Quick Start' }).click()
    await expect(page.getByText('Quick Start').first()).toBeVisible()

    await page.getByText('Anthropic', { exact: true }).click()
    await page.locator('#quickstart-api-key').fill('sk-ant-test-dummy-key')
    await selectModel(page)
    await page.getByRole('button', { name: /Next/i }).click()
    await expect(page.locator('#quickstart-project-name')).toBeVisible({ timeout: 5000 })

    // Cancel on step 1
    await page.getByRole('button', { name: /Cancel/i }).click()
    await expect(page.getByText('AI Provider', { exact: true })).not.toBeVisible({ timeout: 3000 })

    expect(errors).toEqual([])
  })
})
