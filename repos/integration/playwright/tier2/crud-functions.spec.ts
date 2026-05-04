import { test, expect } from '../fixtures/auth'
import {
  gotoAndWait,
  openDrawer,
  fillField,
  submitForm,
  waitForDrawerClose,
  confirmDelete,
  uniqueName,
  collectErrors,
  apiRequest,
  apiDeleteResource,
  searchInPage,
  selectOption,
  ensureFullListLoad,
} from '../utils/crud-helpers'

const PAGE_CLASS = 'tdsk-project-functions-page'
const FORM_ID = 'function-form'

test.describe.serial('CRUD Functions', () => {
  const funcName = uniqueName('pw-func')
  let currentFuncName = funcName
  let funcId: string | undefined

  test('CREATE — should create a new function via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(
      !ctx.projectId,
      'No projectId in context — cannot test functions'
    )

    const errors = collectErrors(page)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`,
      PAGE_CLASS
    )

    // Open create drawer
    await openDrawer(page, /Create Function/i)

    // Fill function name
    await fillField(page, 'function-name', funcName)

    // Select language: "typescript"
    await selectOption(page, 'function-language', 'TypeScript')

    // Fill description
    await fillField(page, 'function-description', 'Playwright CRUD test function')

    // The function content uses a Monaco code editor
    // Click on the editor area and type a simple function body
    const editor = page.locator('.monaco-editor').first()
    if ((await editor.count()) > 0) {
      await editor.click()
      await page.keyboard.type('export default async () => ({ result: "ok" })')
    }

    // Submit the form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // Search for the function in the table
    await searchInPage(page, funcName)

    // Verify the function appears in the DataTable
    await expect(page.getByText(funcName)).toBeVisible({ timeout: 10_000 })

    // Get function ID via API
    const res = await apiRequest(
      page,
      'GET',
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions?limit=200`,
      ctx.apiKey
    )
    const body = await res.json()
    const arr: Record<string, unknown>[] = Array.isArray(body?.data)
      ? body.data
      : []
    const found = arr.find((f) => f.name === funcName)
    if (found?.id) funcId = found.id as string

    expect(funcId).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('READ — should display the created function in the table', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!funcId, 'No function ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`,
      PAGE_CLASS
    )

    // Search for the function
    await searchInPage(page, funcName)

    // Verify function name is visible
    await expect(page.getByText(funcName)).toBeVisible({ timeout: 10_000 })

    // Verify language chip
    const row = page.locator('tr', { has: page.getByText(funcName) })
    await expect(row.getByText(/typescript/i)).toBeVisible()

    expect(errors).toEqual([])
  })

  test('UPDATE — should edit a function name via the drawer', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!funcId, 'No function ID — CREATE must have failed')

    const errors = collectErrors(page)
    const updatedName = `${funcName}-edited`

    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`,
      PAGE_CLASS
    )

    // Search for the function
    await searchInPage(page, funcName)

    // Find the row and click the edit button
    const row = page.locator('tr', { has: page.getByText(funcName) })
    await expect(row).toBeVisible({ timeout: 10_000 })

    const editButton = row.locator('[aria-label="Edit function"]')
    if ((await editButton.count()) > 0) {
      await editButton.first().click()
    } else {
      // Fallback: try primary-colored icon button (edit icon)
      const primaryButton = row.locator('.MuiIconButton-colorPrimary').first()
      await primaryButton.click()
    }

    // Wait for the drawer to open
    await expect(page.locator('.tdsk-drawer')).toBeVisible({ timeout: 5_000 })

    // Clear and update the function name
    const nameInput = page.locator('#function-name')
    await expect(nameInput).toBeVisible({ timeout: 5_000 })
    await nameInput.fill(updatedName)

    // Submit the form
    await submitForm(page, FORM_ID)

    // Wait for drawer to close
    await waitForDrawerClose(page)

    // Search for the updated name
    await searchInPage(page, updatedName)

    // Verify the updated name appears in the DataTable
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10_000 })

    // Track the current name so DELETE can find it
    currentFuncName = updatedName

    expect(errors).toEqual([])
  })

  test('DELETE — should delete the function', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!funcId, 'No function ID — CREATE must have failed')

    const errors = collectErrors(page)
    await ensureFullListLoad(page, `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`)
    await gotoAndWait(
      page,
      `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`,
      PAGE_CLASS
    )

    // Search for the function (may have been renamed by UPDATE test)
    await searchInPage(page, currentFuncName)

    // Find the row and click the delete action button
    const row = page.locator('tr', { has: page.getByText(currentFuncName) })
    const deleteButton = row.locator('[aria-label="Delete function"]')

    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()
    } else {
      // Fallback: try error-colored icon button
      const errorButton = row.locator('.MuiIconButton-colorError').first()
      await errorButton.click()
    }

    // Confirm the deletion
    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    // Verify the function is removed from the table
    await expect(
      page.locator('.MuiTableBody-root').getByText(currentFuncName)
    ).not.toBeVisible({ timeout: 10_000 })

    // Mark as cleaned up
    funcId = undefined

    expect(errors).toEqual([])
  })

  // Safety-net cleanup
  test.afterAll(async ({ browser }) => {
    if (!funcId) return
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
      await apiDeleteResource(
        cleanupPage,
        `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions/${funcId}`,
        ctx.apiKey
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
