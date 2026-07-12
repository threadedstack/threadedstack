import type { AddressInfo } from 'node:net'
import express from 'express'
import { createProxyLimiter } from './rateLimit'
import { describe, it, expect, afterEach } from 'vitest'

/**
 * Drives real HTTP requests against a minimal express app (rather than
 * hand-mocking Response internals) since express-rate-limit reads/writes
 * several response methods (setHeader, append, headersSent, etc).
 */
const startTestApp = (opts: Parameters<typeof createProxyLimiter>[0]) => {
  const app = express()
  app.use((req, _res, next) => {
    const apiKeyId = req.header(`x-test-api-key-id`)
    const orgId = req.header(`x-test-org-id`)
    if (apiKeyId || orgId) req.user = { email: ``, userId: `u1`, apiKeyId, orgId }
    next()
  })
  app.use(`/proxy`, createProxyLimiter(opts))
  app.use(`/proxy/test`, (_req, res) => {
    res.status(200).json({ ok: true })
  })

  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    const server = app.listen(0, `127.0.0.1`, () => {
      const { port } = server.address() as AddressInfo
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      })
    })
  })
}

describe(`createProxyLimiter`, () => {
  let close: (() => Promise<void>) | null = null

  afterEach(async () => {
    await close?.()
    close = null
  })

  it(`allows requests within the limit and rejects with 429 once exceeded`, async () => {
    const started = await startTestApp({ limit: 3, windowMs: 60_000 })
    close = started.close

    const headers = { 'x-test-api-key-id': `key-1` }
    const res1 = await fetch(`${started.url}/proxy/test`, { headers })
    const res2 = await fetch(`${started.url}/proxy/test`, { headers })
    const res3 = await fetch(`${started.url}/proxy/test`, { headers })
    const res4 = await fetch(`${started.url}/proxy/test`, { headers })

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(res3.status).toBe(200)
    expect(res4.status).toBe(429)
    expect(await res4.json()).toEqual({
      error: `Too many requests, please try again later`,
    })
  })

  it(`throttles per API key -- a different key is unaffected by another key's limit`, async () => {
    const started = await startTestApp({ limit: 1, windowMs: 60_000 })
    close = started.close

    const key1Res1 = await fetch(`${started.url}/proxy/test`, {
      headers: { 'x-test-api-key-id': `key-1` },
    })
    const key1Res2 = await fetch(`${started.url}/proxy/test`, {
      headers: { 'x-test-api-key-id': `key-1` },
    })
    const key2Res1 = await fetch(`${started.url}/proxy/test`, {
      headers: { 'x-test-api-key-id': `key-2` },
    })

    expect(key1Res1.status).toBe(200)
    expect(key1Res2.status).toBe(429) // key-1 exhausted its own limit
    expect(key2Res1.status).toBe(200) // key-2 has its own independent bucket
  })

  it(`falls back to org id, then IP, when no API key is present`, async () => {
    const started = await startTestApp({ limit: 1, windowMs: 60_000 })
    close = started.close

    const orgRes1 = await fetch(`${started.url}/proxy/test`, {
      headers: { 'x-test-org-id': `org-1` },
    })
    const orgRes2 = await fetch(`${started.url}/proxy/test`, {
      headers: { 'x-test-org-id': `org-1` },
    })
    // No api key, no org id -- keys by IP, independent bucket from org-1.
    const ipRes1 = await fetch(`${started.url}/proxy/test`)

    expect(orgRes1.status).toBe(200)
    expect(orgRes2.status).toBe(429)
    expect(ipRes1.status).toBe(200)
  })
})
