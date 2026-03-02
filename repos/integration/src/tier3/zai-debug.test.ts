import { env } from '../utils/env'
import { post } from '../utils/api-client'
import { readContext } from '../utils/test-context'
import { describe, test, expect, beforeAll } from 'vitest'

/**
 * Temporary debug test to inspect actual Z.AI SSE error events.
 */

const hasZaiAgent = () => !!env.testZaiAgentId

describe(`Z.AI Debug`, () => {
  const ctx = readContext()
  let agentId = ``

  beforeAll(async () => {
    if (!hasZaiAgent()) return
    agentId = env.testZaiAgentId
  })

  test.skipIf(!hasZaiAgent())(`inspect Z.AI session + streaming response`, async () => {
    // 1. Create session
    const sessionRes = await post<{ data: Record<string, any> }>(`/_/ai/sessions`, { agentId })
    console.log(`Session status:`, sessionRes.status)
    console.log(`Session data:`, JSON.stringify(sessionRes.data, null, 2))

    expect(sessionRes.status).toBe(200)
    const { sessionToken, provider, model } = sessionRes.data.data
    console.log(`Provider: ${provider}, Model: ${model}`)

    // 2. Stream and capture raw response
    const url = `${env.proxyUrl}/ai/chat`
    const res = await fetch(url, {
      method: `POST`,
      headers: {
        [`Content-Type`]: `application/json`,
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        messages: [{ role: `user`, content: [{ type: `text`, text: `Say hi` }] }],
      }),
      signal: AbortSignal.timeout(15_000),
    })

    const rawText = await res.text()

    // Parse events for inspection
    const lines = rawText.split(`\n`).filter((l) => l.startsWith(`data: `))
    for (const line of lines) {
      const payload = line.slice(6).trim()
      if (payload === `[DONE]`) {
        console.log(`Event: [DONE]`)
        continue
      }
      try {
        const parsed = JSON.parse(payload)
        console.log(`Event:`, JSON.stringify(parsed))
      } catch {
        console.log(`Non-JSON line:`, payload)
      }
    }

    // Just assert we got a response
    expect(res.status).toBeGreaterThanOrEqual(200)
  })
})
