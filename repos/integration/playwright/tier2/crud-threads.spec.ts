import { test, expect } from '../fixtures/auth'
import {
  collectErrors,
  confirmDelete,
  uniqueName,
  apiRequest,
  apiDeleteResource,
} from '../utils/crud-helpers'

test.describe.serial('CRUD Threads & Chat', () => {
  const threadName = uniqueName('pw-thread')
  let threadId: string | undefined

  test('CREATE — should create a thread via API and verify in UI', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!ctx.agentId, 'No agentId in context — cannot test threads')

    const errors = collectErrors(page)

    // Create thread via API (UI "Create Thread" button not always present)
    const res = await apiRequest(
      page,
      'POST',
      `/orgs/${ctx.orgId}/agents/${ctx.agentId}/threads`,
      ctx.apiKey,
      { name: threadName, public: false }
    )
    expect(res.status()).toBe(201)

    const body = await res.json()
    const data = body?.data || body
    threadId = data?.id as string
    expect(threadId).toBeTruthy()

    // Navigate to threads page and verify the thread appears
    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await page.goto(threadsUrl)
    await page.waitForLoadState('networkidle')

    // Wait for the threads table to load
    await expect(page.getByRole('heading', { name: 'Threads' })).toBeVisible({ timeout: 15_000 })

    // Verify the thread name is visible in the table
    await expect(page.getByText(threadName)).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('READ — should display the thread with correct details', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!threadId, 'No thread ID — CREATE must have failed')

    const errors = collectErrors(page)

    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await page.goto(threadsUrl)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Threads' })).toBeVisible({ timeout: 15_000 })

    // Verify thread name is visible
    await expect(page.getByText(threadName)).toBeVisible({ timeout: 10_000 })

    // Verify the thread row exists in the table
    const row = page.locator('tr', { has: page.getByText(threadName) })
    await expect(row).toBeVisible()

    // Verify Public column shows "No" (we created with public: false)
    await expect(row.getByText('No')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('CHAT — should send a message in the chat UI', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!threadId, 'No thread ID — CREATE must have failed')

    const errors = collectErrors(page)

    // Navigate to chat page for this thread
    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads/${threadId}/chat`
    await page.goto(chatUrl)
    await page.waitForLoadState('networkidle')

    // Wait for the chat UI to load — look for the message input
    const messageInput = page.getByPlaceholder('Type a message...')
    await expect(messageInput).toBeVisible({ timeout: 15_000 })

    // Type a test message
    const testMessage = `Playwright test message ${Date.now()}`
    await messageInput.fill(testMessage)

    // Click the send button (IconButton with type='submit')
    const sendButton = page.locator('button[type="submit"]')
    await expect(sendButton).toBeEnabled({ timeout: 3_000 })
    await sendButton.click()

    // Verify the user message appears in the chat (don't wait for LLM response)
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10_000 })

    expect(errors).toEqual([])
  })

  test('DELETE — should delete the thread from the threads list', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    test.skip(!threadId, 'No thread ID — CREATE must have failed')

    const errors = collectErrors(page)

    const threadsUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/threads`
    await page.goto(threadsUrl)
    await expect(page.getByRole('heading', { name: 'Threads' })).toBeVisible({ timeout: 15_000 })

    // Find the thread row and click the delete button (red/error icon)
    const row = page.locator('tr', { has: page.getByText(threadName) })
    await expect(row).toBeVisible({ timeout: 10_000 })

    const deleteButton = row.locator('button[title="Delete thread"]')
    if ((await deleteButton.count()) > 0) {
      await deleteButton.first().click()
    } else {
      // Fallback: try error-colored icon button
      const errorButton = row.locator('.MuiIconButton-colorError').first()
      await errorButton.click()
    }

    // Confirm the deletion (data is fetched before dialog closes)
    await confirmDelete(page)
    await expect(page.locator('.MuiDialog-root')).not.toBeVisible({
      timeout: 10_000,
    })

    // Verify the thread is removed from the table
    await expect(
      page.locator('.MuiTableBody-root').getByText(threadName)
    ).not.toBeVisible({ timeout: 10_000 })

    // Mark as cleaned up
    threadId = undefined

    expect(errors).toEqual([])
  })

  // Safety-net cleanup
  test.afterAll(async ({ browser }) => {
    if (!threadId) return
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
        `/orgs/${ctx.orgId}/agents/${ctx.agentId}/threads/${threadId}`,
        ctx.apiKey
      )
    } catch {
      // Best-effort
    } finally {
      await context.close()
    }
  })
})
