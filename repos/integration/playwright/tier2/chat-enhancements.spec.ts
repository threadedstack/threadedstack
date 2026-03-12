import { test, expect } from '../fixtures/auth'

/**
 * Chat view UI enhancement tests.
 *
 * Validates new chat UI elements: file attachment button, pi-web-ui
 * toggle, stop button visibility, New Chat button, empty state message,
 * and UI mode switching. No LLM interaction required.
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
  'ErrorBoundary',
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

/**
 * Wait for chat view to fully render.
 * ChatView returns null if !orgId || !agentId, so we wait for
 * the chat input placeholder to confirm the view is ready.
 */
async function waitForChatReady(
  page: import('@playwright/test').Page,
  timeout = 15000
) {
  await expect(page.getByPlaceholder('Type a message...')).toBeVisible({ timeout })
}

function collectConsoleErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnored(msg.text())) errors.push(msg.text())
  })
  return errors
}

test.describe('Chat View UI Enhancements', () => {
  test('chat view renders file attach button', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`
    await gotoAndWait(page, chatUrl, 'tdsk-agent-layout-page')
    await waitForChatReady(page)

    await expect(page.locator('[title="Attach file"]')).toBeVisible()

    // Hidden file input should exist for upload
    const fileInput = page.locator('input[type="file"]')
    expect(await fileInput.count()).toBeGreaterThan(0)
  })

  test('chat view renders pi-web-ui toggle button', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`
    await gotoAndWait(page, chatUrl, 'tdsk-agent-layout-page')
    await waitForChatReady(page)

    // MUI auto-generates data-testid from icon component name
    await expect(page.locator('[data-testid="SwapHorizIcon"]')).toBeVisible()
  })

  test('chat view does not show stop button when not streaming', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`
    await gotoAndWait(page, chatUrl, 'tdsk-agent-layout-page')
    await waitForChatReady(page)

    // Stop button only renders when isStreaming === true
    await expect(page.getByRole('button', { name: /Stop/i })).toHaveCount(0)

    // Send button (submit) should be visible
    await expect(page.locator('[data-testid="SendIcon"]')).toBeVisible()
  })

  test('chat view renders New Chat button in header', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`
    await gotoAndWait(page, chatUrl, 'tdsk-agent-layout-page')
    await waitForChatReady(page)

    await expect(page.getByRole('button', { name: /New Chat/i })).toBeVisible()
  })

  test('chat view shows empty state message before any messages', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`
    await gotoAndWait(page, chatUrl, 'tdsk-agent-layout-page')
    await waitForChatReady(page)

    // New chat with no messages shows empty state prompt
    await expect(
      page.getByText(/Send a message to start chatting with/)
    ).toBeVisible()
  })

  test('clicking pi-web-ui toggle switches UI mode', async ({
    authenticatedPage: page,
    ctx,
  }) => {
    const chatUrl = `/orgs/${ctx.orgId}/projects/${ctx.projectId}/agents/${ctx.agentId}/chat`
    await gotoAndWait(page, chatUrl, 'tdsk-agent-layout-page')
    await waitForChatReady(page)

    // Native chat input should be visible initially
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible()

    // Click the swap icon to toggle to pi-web-ui
    await page.locator('[data-testid="SwapHorizIcon"]').click()
    await page.waitForTimeout(500)

    // Pi chat panel wrapper should now be visible
    await expect(page.locator('.pi-chat-panel-wrapper')).toBeVisible()
    // Native chat input should be hidden
    await expect(page.getByPlaceholder('Type a message...')).toHaveCount(0)

    // Click again to toggle back
    await page.locator('[data-testid="SwapHorizIcon"]').click()
    await page.waitForTimeout(500)

    // Native chat input should be visible again
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible()
  })
})
