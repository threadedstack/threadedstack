import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFileSync } from 'node:fs'
import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  apiRequest,
  uniqueName,
  searchInPage,
  collectErrors,
  apiDeleteResource,
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-sandboxes-page'

test.describe.serial('Sandbox Provider Auth', () => {
  let sandboxId: string | undefined
  let providerId: string | undefined
  const sandboxName = uniqueName('pw-sb-prov')
  const providerName = uniqueName('pw-sb-ai-prov')

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const setupPage = await context.newPage()
    try {
      const { join } = await import('node:path')
      const { tmpdir } = await import('node:os')
      const { readFileSync } = await import('node:fs')
      const ctx = JSON.parse(
        readFileSync(
          join(tmpdir(), 'tdsk-integration', 'context.json'),
          'utf-8'
        )
      )

      if (!ctx.projectId) return

      // Create an AI provider via API
      const provRes = await apiRequest(
        setupPage,
        'POST',
        `/orgs/${ctx.orgId}/providers`,
        ctx.apiKey,
        {
          name: providerName,
          type: 'ai',
          brand: 'anthropic',
        }
      )
      const provBody = await provRes.json()
      if (provBody?.data?.id) providerId = provBody.data.id

      // Create sandbox with the provider linked via providerInputs
      const sbRes = await apiRequest(
        setupPage,
        'POST',
        `/orgs/${ctx.orgId}/sandboxes`,
        ctx.apiKey,
        {
          name: sandboxName,
          projectId: ctx.projectId,
          providerInputs: providerId ? [{ id: providerId }] : [],
          config: {
            image: 'node:22-slim',
            sshEnabled: true,
            runtime: 'claude-code',
            runtimeCommand: 'claude',
          },
        }
      )
      const sbBody = await sbRes.json()
      if (sbBody?.data?.id) sandboxId = sbBody.data.id
    } catch {
      // Setup failure will cause tests to skip
    } finally {
      await context.close()
    }
  })

  test('Sandbox drawer shows Providers accordion with linked provider', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId, 'No sandbox — setup must have failed')
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, sandboxName)
    const row = page.locator('tr', { has: page.getByText(sandboxName) })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.click()

    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // Find and expand the Providers accordion
    const provAccordion = page.locator('.MuiAccordionSummary-root', {
      hasText: 'Providers',
    })
    await expect(provAccordion).toBeVisible({ timeout: 5_000 })
    await provAccordion.click()

    // The linked provider should appear in the list
    if (providerId) {
      const linkedItem = page.locator('.MuiListItem-root').filter({ has: page.locator('button') })
      await expect(linkedItem.first()).toBeVisible({ timeout: 5_000 })
    }

    // Should show compatible brands text
    await expect(
      page.getByText('Compatible brands for Claude Code')
    ).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Provider dropdown shows available providers', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId, 'No sandbox — setup failed')
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    // Open Create drawer (not edit) to test adding a new provider
    await openDrawer(page, /Create Sandbox/i)

    // Expand Providers accordion
    const provAccordion = page.locator('.MuiAccordionSummary-root', {
      hasText: 'Providers',
    })
    await provAccordion.click()

    // In reorderable mode, click "Add Provider" button to reveal the Autocomplete
    const addProviderButton = page.getByRole('button', { name: /Add Provider/i })
    await expect(addProviderButton).toBeVisible({ timeout: 5_000 })
    await addProviderButton.click()

    // The Autocomplete dropdown should now be visible
    const autocomplete = page.locator('.MuiAutocomplete-root')
    await expect(autocomplete).toBeVisible({ timeout: 5_000 })

    // The provider we created should appear as an option
    const option = page.locator('.MuiAutocomplete-popper .MuiAutocomplete-option', {
      hasText: providerName,
    })
    await expect(option).toBeVisible({ timeout: 5_000 })

    // Close dropdown
    await page.keyboard.press('Escape')

    expect(errors).toEqual([])
  })

  test('Adding a provider shows it in the list', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId || !providerId, 'No sandbox or provider — setup failed')
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    // Open Create drawer
    await openDrawer(page, /Create Sandbox/i)

    // Expand Providers accordion
    const provAccordion = page.locator('.MuiAccordionSummary-root', {
      hasText: 'Providers',
    })
    await provAccordion.click()

    // In reorderable mode, click "Add Provider" button to reveal the Autocomplete
    const addProviderButton = page.getByRole('button', { name: /Add Provider/i })
    await expect(addProviderButton).toBeVisible({ timeout: 5_000 })
    await addProviderButton.click()

    // Select the provider from the dropdown
    const autocomplete = page.locator('.MuiAutocomplete-root')
    await expect(autocomplete).toBeVisible({ timeout: 5_000 })

    const option = page.locator('.MuiAutocomplete-popper .MuiAutocomplete-option', {
      hasText: providerName,
    })
    await expect(option).toBeVisible({ timeout: 5_000 })
    await option.click()

    // Provider should now appear in the linked list (local state, no API call)
    const linkedItem = page.locator('.MuiListItem-root').filter({ has: page.locator('button') })
    await expect(linkedItem.first()).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  test('Auth column shows provider chip for linked sandbox', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId || !providerId, 'No sandbox or provider — setup failed')
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, sandboxName)
    const row = page.locator('tr', { has: page.getByText(sandboxName) })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Auth column should show a success chip with the brand
    const authChip = row.locator('.MuiChip-colorSuccess')
    await expect(authChip).toBeVisible({ timeout: 5_000 })
    await expect(authChip.locator('.MuiChip-label')).toHaveText('anthropic')

    expect(errors).toEqual([])
  })

  test('ConnectModal shows no provider warning for unlinked sandbox', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.projectId, 'No projectId in context')

    // Create a sandbox with no providers for this test
    const sbName = uniqueName('pw-sb-no-prov')
    let unlinkedSbId: string | undefined

    const sbRes = await apiRequest(
      page,
      'POST',
      `/orgs/${ctx.orgId}/sandboxes`,
      ctx.apiKey,
      {
        name: sbName,
        projectId: ctx.projectId,
        config: {
          image: 'node:22-slim',
          sshEnabled: true,
          runtime: 'claude-code',
          runtimeCommand: 'claude',
        },
      }
    )
    const sbBody = await sbRes.json()
    unlinkedSbId = sbBody?.data?.id
    if (!unlinkedSbId) return expect(unlinkedSbId).toBeTruthy()

    const errors = collectErrors(page)

    // Intercept connect and sessions to avoid real pod creation
    await page.route(`**/sandboxes/${unlinkedSbId}/connect`, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              podName: 'tdsk-sb-test-no-prov',
              password: 'test-pass',
              port: 2222,
              sandboxId: unlinkedSbId,
              command: `tsa ssh ${unlinkedSbId}`,
            },
          }),
        })
      }
      return route.continue()
    })

    await page.route(`**/sandboxes/${unlinkedSbId}/sessions`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        })
      }
      return route.continue()
    })

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, sbName)
    const row = page.locator('tr', { has: page.getByText(sbName) })
    await expect(row).toBeVisible({ timeout: 10_000 })

    const connectButton = row.locator('.MuiIconButton-colorSuccess').first()
    await connectButton.click()

    const dialog = page.locator('.MuiDialog-root')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    await expect(
      dialog.getByText('No provider linked')
    ).toBeVisible({ timeout: 5_000 })

    await dialog.getByRole('button', { name: /Close/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })

    await apiDeleteResource(
      page,
      `/orgs/${ctx.orgId}/sandboxes/${unlinkedSbId}`,
      ctx.apiKey
    )

    expect(errors).toEqual([])
  })

  test('Removing a provider from the drawer list removes it locally', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!sandboxId || !providerId, 'No sandbox or provider — setup failed')
    test.skip(!ctx.projectId, 'No projectId in context')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/sandboxes`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/sandboxes`,
      PAGE_CLASS
    )

    await searchInPage(page, sandboxName)
    const row = page.locator('tr', { has: page.getByText(sandboxName) })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.click()

    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // Expand Providers accordion
    const provAccordion = page.locator('.MuiAccordionSummary-root', {
      hasText: 'Providers',
    })
    await provAccordion.click()

    // Provider should be listed
    const linkedItems = page.locator('.MuiListItem-root').filter({ has: page.locator('button') })
    await expect(linkedItems.first()).toBeVisible({ timeout: 5_000 })

    // Click the remove (X) button
    const removeButton = linkedItems.first().locator('button').filter({
      has: page.locator('[data-testid="CloseIcon"]'),
    })
    await removeButton.click()

    // Provider should be removed from the list (local state change, no API call)
    await expect(linkedItems).not.toBeVisible({ timeout: 5_000 })

    // The "No provider linked" alert should appear
    await expect(
      page.getByText('No provider linked')
    ).toBeVisible({ timeout: 5_000 })

    expect(errors).toEqual([])
  })

  // Cleanup
  test.afterAll(async ({ browser }) => {
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
      if (sandboxId)
        await apiDeleteResource(
          cleanupPage,
          `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`,
          ctx.apiKey
        )
      if (providerId)
        await apiDeleteResource(
          cleanupPage,
          `/orgs/${ctx.orgId}/providers/${providerId}`,
          ctx.apiKey
        )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
