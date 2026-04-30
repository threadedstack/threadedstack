import http from 'node:http'
import { execFile } from 'node:child_process'
import { browserLogin } from './browserAuth'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`node:child_process`, () => ({
  execFile: vi.fn(),
}))

const mockedExecFile = vi.mocked(execFile)

const sendCallback = (
  port: number,
  params: Record<string, string>
): Promise<{ statusCode: number; body: string }> => {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(params).toString()
    const req = http.get(`http://127.0.0.1:${port}/callback?${query}`, (res) => {
      let body = ``
      res.on(`data`, (chunk: Buffer) => {
        body += chunk.toString()
      })
      res.on(`end`, () => resolve({ statusCode: res.statusCode || 0, body }))
    })
    req.on(`error`, reject)
  })
}

const sendRequest = (
  port: number,
  path: string
): Promise<{ statusCode: number; body: string }> => {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let body = ``
      res.on(`data`, (chunk: Buffer) => {
        body += chunk.toString()
      })
      res.on(`end`, () => resolve({ statusCode: res.statusCode || 0, body }))
    })
    req.on(`error`, reject)
  })
}

/**
 * Extracts the port and state from the URL passed to the mocked execFile.
 * On macOS: execFile('open', [loginUrl], cb)
 * The login URL has ?port=X&state=Y appended by browserLogin.
 */
const extractPortAndState = (): { port: number; state: string } => {
  const calls = mockedExecFile.mock.calls
  const lastCall = calls[calls.length - 1]
  // args is the second parameter: string[]
  const args = lastCall[1] as string[]
  const urlStr = args[args.length - 1]
  const url = new URL(urlStr)
  return {
    port: Number(url.searchParams.get(`port`)),
    state: url.searchParams.get(`state`) || ``,
  }
}

describe(`browserLogin`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should resolve with token data on valid callback`, async () => {
    const loginPromise = browserLogin(`https://auth.example.com/cli`)

    // Wait for the server to start and execFile to be called
    await new Promise((r) => setTimeout(r, 50))
    const { port, state } = extractPortAndState()

    const [response, result] = await Promise.all([
      sendCallback(port, {
        token: `jwt.issued.token`,
        expiresAt: `2099-12-31T00:00:00.000Z`,
        state,
        neonAuthUrl: `https://auth.example.com`,
      }),
      loginPromise,
    ])

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain(`Authentication successful`)
    expect(result).toEqual({
      token: `jwt.issued.token`,
      expiresAt: `2099-12-31T00:00:00.000Z`,
      neonAuthUrl: `https://auth.example.com`,
    })
  })

  it(`should reject when state does not match`, async () => {
    const loginPromise = browserLogin(`https://auth.example.com/cli`)
    loginPromise.catch(() => {})

    await new Promise((r) => setTimeout(r, 50))
    const { port } = extractPortAndState()

    const response = await sendCallback(port, {
      token: `jwt.issued.token`,
      expiresAt: `2099-12-31T00:00:00.000Z`,
      state: `wrong-state-value`,
    })

    expect(response.statusCode).toBe(400)
    expect(response.body).toContain(`State mismatch`)

    await expect(loginPromise).rejects.toThrow(`state mismatch`)
  })

  it(`should reject when token is missing from callback`, async () => {
    const loginPromise = browserLogin(`https://auth.example.com/cli`)
    // Attach a no-op catch to prevent unhandled rejection warnings
    loginPromise.catch(() => {})

    await new Promise((r) => setTimeout(r, 50))
    const { port, state } = extractPortAndState()

    const response = await sendCallback(port, { state })

    expect(response.statusCode).toBe(400)
    expect(response.body).toContain(`No token received`)

    await expect(loginPromise).rejects.toThrow(`No token received from browser`)
  })

  it(`should propagate error query param as rejection reason`, async () => {
    const loginPromise = browserLogin(`https://auth.example.com/cli`)
    // Attach a no-op catch to prevent unhandled rejection warnings
    loginPromise.catch(() => {})

    await new Promise((r) => setTimeout(r, 50))
    const { port, state } = extractPortAndState()

    const response = await sendCallback(port, {
      state,
      error: `user_denied`,
    })

    expect(response.statusCode).toBe(400)
    expect(response.body).toContain(`user_denied`)

    await expect(loginPromise).rejects.toThrow(`user_denied`)
  })

  it(`should return 404 for non-callback paths`, async () => {
    const loginPromise = browserLogin(`https://auth.example.com/cli`)

    await new Promise((r) => setTimeout(r, 50))
    const { port, state } = extractPortAndState()

    const response = await sendRequest(port, `/health`)

    expect(response.statusCode).toBe(404)

    // Clean up: send valid callback to close server
    await sendCallback(port, {
      token: `jwt.token`,
      expiresAt: `2099-12-31T00:00:00.000Z`,
      state,
    })

    await loginPromise
  })

  it(`should resolve without neonAuthUrl when not provided in callback`, async () => {
    const loginPromise = browserLogin(`https://auth.example.com/cli`)

    await new Promise((r) => setTimeout(r, 50))
    const { port, state } = extractPortAndState()

    await sendCallback(port, {
      token: `jwt.issued.token`,
      expiresAt: `2099-12-31T00:00:00.000Z`,
      state,
    })

    const result = await loginPromise
    expect(result.neonAuthUrl).toBeUndefined()
  })

  it(`should reject after timeout`, async () => {
    vi.useFakeTimers()
    const loginPromise = browserLogin(`https://auth.example.com/cli`)
    loginPromise.catch(() => {})

    // Don't send any callback, just advance time past the timeout
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100)

    await expect(loginPromise).rejects.toThrow(`timed out`)
    vi.useRealTimers()
  })
})
