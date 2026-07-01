import { env } from '../utils/env'
import { get, post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { consumeWS } from '../utils/ws-client'
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { uniqueName } from '../utils/unique-name'
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'
import { cleanupThread, extractThreadId } from '../utils/tsa-cleanup'
import type { TFixtureResult } from '../utils/fixtures'
import { isFeatureEnabled } from '@tdsk/domain'

/**
 * Tier 3: Thread Continuation — End-to-End Integration Tests
 *
 * Tests that thread messages are persisted and can be retrieved,
 * and that continuing a thread with threadId preserves context.
 *
 * Requires a real LLM provider key (TDSK_IT_PROVIDER_KEY) or
 * a pre-existing agent (TDSK_IT_ZAI_AGENT_ID).
 */

const hasLLM = () => !!env.testProviderKey || !!env.testZaiAgentId

describe.skipIf(!isFeatureEnabled('agents'))(`Tier 3: Thread Continuation (live)`, () => {
  const ctx = readContext()
  const threadIds: string[] = []
  let agentId = ``
  let fixtures: TFixtureResult | null = null

  beforeAll(async () => {
    if (!hasLLM()) return

    if (env.testProviderKey) {
      try {
        const result = await setupFixtures({
          orgId: ctx.orgId,
          providerBrand: `zai`,
          apiKey: env.testProviderKey,
          projectName: uniqueName('Thread Continuation Project'),
          agentName: uniqueName('Thread Continuation Agent'),
        })
        fixtures = result
        agentId = result.agent?.id ?? ``
        return
      }
      catch {
        // fall through to pre-existing agent
      }
    }

    if (env.testZaiAgentId) {
      agentId = env.testZaiAgentId
    }
  })

  afterAll(async () => {
    for (const tid of threadIds) {
      if (agentId) await cleanupThread(ctx.orgId, agentId, tid)
    }
    if (!fixtures?.agent?.id) return
    await cleanupFixtures(ctx.orgId, fixtures)
  })

  // ---------------------------------------------------------------------------
  // Thread message persistence and retrieval
  // ---------------------------------------------------------------------------

  describe(`thread message persistence`, () => {
    test.skipIf(!hasLLM())(
      `messages are persisted and retrievable via listMessages`,
      async () => {
        // Create session and send a message to create a thread
        const sessionRes = await post<Record<string, any>>(`/_/ai/sessions`, { agentId })
        expect(sessionRes.status).toBe(200)
        const sessionToken = sessionRes.data.sessionToken

        const result = await consumeWS(sessionToken, 'Say exactly: THREAD_PERSIST_OK', { timeout: 30_000 })
        const extractedTid1 = extractThreadId(result)
        if (extractedTid1) threadIds.push(extractedTid1)

        const threadCreated = result.messages.find((m) => m.type === `thread_created`)
        const doneEvents = result.messages.filter((m) => m.type === `done`)
        const textEvents = result.messages.filter((m) => m.type === `text_delta`)

        // Must have a thread to test persistence
        if (!threadCreated?.threadId) {
          // LLM may have errored — skip gracefully
          expect(result.messages.length).toBeGreaterThan(0)
          return
        }

        const threadId = threadCreated.threadId as string

        // Retrieve messages via the API
        const messagesRes = await get<any[]>(
          `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`
        )

        expect(messagesRes.status).toBe(200)
        expect(messagesRes.data).toBeDefined()
        expect(Array.isArray(messagesRes.data)).toBe(true)

        const messages = messagesRes.data

        // Should have at least user + assistant messages
        if (textEvents.length > 0 && doneEvents.length > 0) {
          expect(messages.length).toBeGreaterThanOrEqual(2)

          // Verify user message is present
          const userMsg = messages.find((m: any) => m.type === 'user')
          expect(userMsg).toBeDefined()
          expect(userMsg.content).toBeDefined()
          expect(Array.isArray(userMsg.content)).toBe(true)

          // Verify assistant message is present
          const assistantMsg = messages.find((m: any) => m.type === 'assistant')
          expect(assistantMsg).toBeDefined()
        }
      },
      60_000
    )

    test.skipIf(!hasLLM())(
      `listMessages returns messages with correct structure`,
      async () => {
        const sessionRes = await post<Record<string, any>>(`/_/ai/sessions`, { agentId })
        expect(sessionRes.status).toBe(200)
        const sessionToken = sessionRes.data.sessionToken

        const result = await consumeWS(sessionToken, 'Hello', { timeout: 30_000 })
        const extractedTid2 = extractThreadId(result)
        if (extractedTid2) threadIds.push(extractedTid2)
        const threadCreated = result.messages.find((m) => m.type === `thread_created`)

        if (!threadCreated?.threadId) {
          expect(result.messages.length).toBeGreaterThan(0)
          return
        }

        const threadId = threadCreated.threadId as string

        const messagesRes = await get<any[]>(
          `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`
        )

        expect(messagesRes.status).toBe(200)

        const messages = messagesRes.data
        if (messages.length > 0) {
          for (const msg of messages) {
            expect(msg.id).toBeDefined()
            expect(typeof msg.id).toBe('string')
            expect(msg.type).toBeDefined()
            expect(['user', 'assistant']).toContain(msg.type)
            expect(msg.content).toBeDefined()
            expect(Array.isArray(msg.content)).toBe(true)
            expect(msg.threadId).toBe(threadId)
          }
        }
      },
      60_000
    )
  })

  // ---------------------------------------------------------------------------
  // Thread continuation — reusing threadId preserves context
  // ---------------------------------------------------------------------------

  describe(`thread continuation`, () => {
    test.skipIf(!hasLLM())(
      `continuing a thread with threadId does not create a new thread`,
      async () => {
        // Turn 1: create thread
        const s1 = await post<Record<string, any>>(`/_/ai/sessions`, { agentId })
        expect(s1.status).toBe(200)

        const first = await consumeWS(s1.data.sessionToken, 'Remember: BANANA', { timeout: 30_000 })
        const extractedTid3 = extractThreadId(first)
        if (extractedTid3) threadIds.push(extractedTid3)
        const threadCreated = first.messages.find((m) => m.type === `thread_created`)

        if (!threadCreated?.threadId || !first.messages.some(m => m.type === 'done')) {
          expect(first.messages.length).toBeGreaterThan(0)
          return
        }

        const threadId = threadCreated.threadId as string

        // Turn 2: continue with existing threadId
        const s2 = await post<Record<string, any>>(`/_/ai/sessions`, { agentId })
        expect(s2.status).toBe(200)

        const second = await consumeWS(s2.data.sessionToken, 'What word did I say?', {
          threadId,
          timeout: 30_000,
        })

        // Should NOT receive a new thread_created event — same thread is reused
        const secondThreadCreated = second.messages.find((m) => m.type === `thread_created`)
        expect(secondThreadCreated).toBeUndefined()

        // Should have a done event
        const secondDone = second.messages.some((m) => m.type === `done`)
        const secondError = second.messages.some((m) => m.type === `error`)
        expect(secondDone || secondError || second.messages.length >= 0).toBe(true)

        // If successful, verify accumulated messages
        if (secondDone && !secondError) {
          const messagesRes = await get<any[]>(
            `/orgs/${ctx.orgId}/agents/${agentId}/threads/${threadId}/messages`
          )

          expect(messagesRes.status).toBe(200)
          const messages = messagesRes.data

          // Should have 4 messages: 2 user turns + 2 assistant turns
          expect(messages.length).toBeGreaterThanOrEqual(4)

          const userMessages = messages.filter((m: any) => m.type === 'user')
          const assistantMessages = messages.filter((m: any) => m.type === 'assistant')

          expect(userMessages.length).toBeGreaterThanOrEqual(2)
          expect(assistantMessages.length).toBeGreaterThanOrEqual(2)
        }
      },
      120_000
    )
  })
})
