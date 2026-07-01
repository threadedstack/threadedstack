import WebSocket from 'ws'
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { env } from '../utils/env'
import { post, get } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import type { TFixtureResult } from '../utils/fixtures'
import { createWSConnection } from '../utils/ws-client'
import { EWSEventType, isFeatureEnabled } from '@tdsk/domain'
import { uniqueName } from '../utils/unique-name'

/**
 * Tier 1: WebSocket Close Resilience
 *
 * Validates that the server handles rapid client disconnections gracefully.
 *
 * Covers fix C1: Race condition in WebSocket `#ensureRunner` vs `close()`.
 * The old code assigned `this.#runner` before `init()` completed, so a
 * `close()` during init would null the runner but `handlePrompt` would
 * proceed to call `runTurn()` on null — crash. The fix holds the runner
 * in a local variable, checks `#closed` after init, and aborts the
 * controller on close.
 *
 * These tests require a real LLM agent to trigger the runner lifecycle.
 */

const getAgentId = () => env.testZaiAgentId || env.testAgentId
const hasLLM = () => !!env.testProviderKey || !!getAgentId()

describe.skipIf(!isFeatureEnabled('agents'))('Tier 1: WebSocket Close Resilience (C1 fix)', () => {
  const ctx = readContext()
  let agentId = ''
  let fixtures: TFixtureResult | null = null

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      fixtures = await setupFixtures({
        orgId: ctx.orgId,
        providerBrand: 'zai',
        apiKey: env.testProviderKey,
        projectName: uniqueName('WS Resilience Test'),
        agentName: uniqueName('WS Resilience Agent'),
      })

      if (fixtures.agent?.id) {
        agentId = fixtures.agent.id
      }
    }

    if (!agentId) agentId = getAgentId()
  })

  afterAll(async () => {
    if (!fixtures) return
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  const createSessionToken = async (): Promise<string | null> => {
    const res = await post<Record<string, any>>(
      `/_/ai/sessions`,
      { agentId }
    )
    if (res.status !== 200 || !res.data?.sessionToken) return null
    return res.data.sessionToken
  }

  // ─── Rapid Close During Runner Init (C1 fix) ──────────────────────

  test.skipIf(!hasLLM())('closing WS immediately after prompt does not crash server', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws } = await createWSConnection(token!, { timeout: 10_000 })

    // Send prompt then close immediately — triggers the race condition
    // that C1 fixes (close() during #ensureRunner init)
    ws.send(JSON.stringify({
      type: EWSEventType.Prompt,
      prompt: 'Say hello',
    }))

    // Close immediately — before the runner has finished init
    ws.close()

    // Wait a moment for the server to process the close
    await new Promise(r => setTimeout(r, 2_000))

    // Verify the server is still healthy after the rapid close
    const healthRes = await get(`/health`, { rawPath: true })
    expect(healthRes.status).toBe(200)
  })

  test.skipIf(!hasLLM())('multiple rapid connect-prompt-close cycles leave server healthy', async () => {
    // Run 3 rapid cycles of connect → prompt → immediate close
    for (let i = 0; i < 3; i++) {
      const token = await createSessionToken()
      expect(token).toBeTruthy()

      const { ws } = await createWSConnection(token!, { timeout: 10_000 })

      ws.send(JSON.stringify({
        type: EWSEventType.Prompt,
        prompt: `Cycle ${i + 1}: Say hello`,
      }))

      // Close immediately
      ws.close()

      // Brief pause between cycles
      await new Promise(r => setTimeout(r, 500))
    }

    // Wait for server to process all closures
    await new Promise(r => setTimeout(r, 3_000))

    // Server should still be healthy
    const healthRes = await get(`/health`, { rawPath: true })
    expect(healthRes.status).toBe(200)
  })

  test.skipIf(!hasLLM())('new connection works after rapid close of previous', async () => {
    const token1 = await createSessionToken()
    expect(token1).toBeTruthy()

    // Connect, send prompt, close immediately
    const { ws: ws1 } = await createWSConnection(token1!, { timeout: 10_000 })
    ws1.send(JSON.stringify({
      type: EWSEventType.Prompt,
      prompt: 'First prompt — will close immediately',
    }))
    ws1.close()

    // Wait for server to clean up
    await new Promise(r => setTimeout(r, 2_000))

    // New connection should work normally
    const token2 = await createSessionToken()
    expect(token2).toBeTruthy()

    const { ws: ws2, messages, waitForClose } = await createWSConnection(token2!, { timeout: 60_000 })

    ws2.send(JSON.stringify({
      type: EWSEventType.Prompt,
      prompt: 'Second prompt — should work normally',
    }))

    // Wait for the done event or timeout
    const closeResult = await Promise.race([
      waitForClose(),
      new Promise<{ closeCode: number; closeReason: string }>(r =>
        setTimeout(() => {
          ws2.close()
          r({ closeCode: -1, closeReason: 'timeout' })
        }, 30_000)
      ),
    ])

    // Should have received at least some messages
    expect(messages.length).toBeGreaterThanOrEqual(1)

    // Should not get an auth rejection
    if (closeResult.closeCode !== -1) {
      expect(closeResult.closeCode).not.toBe(4001)
    }
  })

  // ─── Close During Streaming (C1 abort fix) ─────────────────────────

  test.skipIf(!hasLLM())('closing mid-stream does not crash server (abort controller fix)', async () => {
    const token = await createSessionToken()
    expect(token).toBeTruthy()

    const { ws, messages, waitForClose } = await createWSConnection(token!, { timeout: 60_000 })

    // Send a long prompt so the LLM is mid-stream
    ws.send(JSON.stringify({
      type: EWSEventType.Prompt,
      prompt: 'Write a very detailed 2000-word essay about artificial intelligence history',
    }))

    // Wait for at least one text_delta to confirm streaming has started
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (messages.some(m => m.type === EWSEventType.TextDelta)) {
          clearInterval(check)
          resolve()
        }
      }, 100)
      // Safety: resolve after 10s even if no delta (LLM might be slow)
      setTimeout(() => { clearInterval(check); resolve() }, 10_000)
    })

    // Close while streaming — the abort controller fix should handle this
    ws.close()

    // Wait for close to complete
    await Promise.race([
      waitForClose(),
      new Promise(r => setTimeout(r, 5_000)),
    ])

    // Server should still be healthy
    await new Promise(r => setTimeout(r, 1_000))
    const healthRes = await get(`/health`, { rawPath: true })
    expect(healthRes.status).toBe(200)
  })
})
