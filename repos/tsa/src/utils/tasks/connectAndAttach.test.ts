import type { ApiClient } from '@TSA/services/api'
import type { AuthManager } from '@TSA/services/auth'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSandboxConnectPod = vi.fn()
const mockConnectShellWebSocket = vi.fn()

vi.mock(`@TSA/utils/tasks/sandboxConnectPod`, () => ({
  sandboxConnectPod: (...args: any[]) => mockSandboxConnectPod(...args),
}))
vi.mock(`@TSA/utils/tasks/shellWebSocket`, () => ({
  connectShellWebSocket: (...args: any[]) => mockConnectShellWebSocket(...args),
}))

import { connectAndAttach } from './connectAndAttach'

const makeClient = () => ({ proxyUrl: `https://proxy.test` }) as unknown as ApiClient

const makeAuth = (creds?: { apiKey?: string; token?: string; insecure?: boolean }) =>
  ({
    creds: vi.fn().mockReturnValue(creds ?? { apiKey: `tdsk_test_key` }),
  }) as unknown as AuthManager

const defaultConnectResp = {
  sandboxId: `sb-resolved`,
  shellToken: `shell-tok`,
  podName: `pod-1`,
  workdir: `/workspace`,
}

describe(`connectAndAttach`, () => {
  let exitCode: number | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    exitCode = undefined

    mockSandboxConnectPod.mockResolvedValue(defaultConnectResp)
    mockConnectShellWebSocket.mockResolvedValue(`session-id`)

    vi.spyOn(process, `exit`).mockImplementation((code?: any) => {
      exitCode = code ?? 0
      throw new Error(`__EXIT__`)
    })
    vi.spyOn(process.stderr, `write`).mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const run = async (overrides?: Partial<Parameters<typeof connectAndAttach>[0]>) => {
    try {
      await connectAndAttach({
        client: makeClient(),
        auth: makeAuth(),
        orgId: `org-1`,
        projectId: `proj-1`,
        sandboxId: `sb-1`,
        ...overrides,
      })
    } catch (err: any) {
      if (err.message !== `__EXIT__`) throw err
    }
  }

  it(`connects to pod and opens shell WebSocket`, async () => {
    const client = makeClient()
    const auth = makeAuth({ apiKey: `tdsk_key` })

    await run({ client, auth })

    expect(mockSandboxConnectPod).toHaveBeenCalledWith(client, `org-1`, `proj-1`, `sb-1`)
    expect(mockConnectShellWebSocket).toHaveBeenCalledWith({
      proxyUrl: `https://proxy.test`,
      bearerToken: `tdsk_key`,
      sandboxId: `sb-resolved`,
      insecure: false,
      sessionId: undefined,
      run: undefined,
    })
    expect(exitCode).toBeUndefined()
  })

  it(`prefers apiKey over shellToken and creds.token`, async () => {
    const auth = makeAuth({ apiKey: `tdsk_key`, token: `jwt_tok` })
    mockSandboxConnectPod.mockResolvedValue({
      ...defaultConnectResp,
      shellToken: `shell-tok`,
    })
    await run({ auth })

    const call = mockConnectShellWebSocket.mock.calls[0][0]
    expect(call.bearerToken).toBe(`tdsk_key`)
  })

  it(`falls back to shellToken when no apiKey`, async () => {
    const auth = makeAuth({ token: `jwt_tok` })
    await run({ auth })

    const call = mockConnectShellWebSocket.mock.calls[0][0]
    expect(call.bearerToken).toBe(`shell-tok`)
  })

  it(`falls back to creds.token as last resort`, async () => {
    const auth = makeAuth({ token: `jwt_tok` })
    mockSandboxConnectPod.mockResolvedValue({
      ...defaultConnectResp,
      shellToken: undefined,
    })
    await run({ auth })

    const call = mockConnectShellWebSocket.mock.calls[0][0]
    expect(call.bearerToken).toBe(`jwt_tok`)
  })

  it(`exits with code 1 when no bearer token is available`, async () => {
    const auth = makeAuth({})
    mockSandboxConnectPod.mockResolvedValue({
      ...defaultConnectResp,
      shellToken: undefined,
    })
    await run({ auth })

    expect(exitCode).toBe(1)
    expect(mockConnectShellWebSocket).not.toHaveBeenCalled()
  })

  it(`passes sessionId through to connectShellWebSocket`, async () => {
    await run({ sessionId: `sess-123` })

    const call = mockConnectShellWebSocket.mock.calls[0][0]
    expect(call.sessionId).toBe(`sess-123`)
  })

  it(`passes run flag through to connectShellWebSocket`, async () => {
    await run({ run: true })

    const call = mockConnectShellWebSocket.mock.calls[0][0]
    expect(call.run).toBe(true)
  })

  it(`passes insecure flag from creds`, async () => {
    const auth = makeAuth({ apiKey: `tdsk_key`, insecure: true })
    await run({ auth })

    const call = mockConnectShellWebSocket.mock.calls[0][0]
    expect(call.insecure).toBe(true)
  })

  it(`writes error to stderr when no credentials available`, async () => {
    const stderrSpy = vi.spyOn(process.stderr, `write`).mockImplementation(() => true)
    const auth = makeAuth({})
    mockSandboxConnectPod.mockResolvedValue({
      ...defaultConnectResp,
      shellToken: undefined,
    })
    await run({ auth })

    const output = stderrSpy.mock.calls.flat().join(``)
    expect(output).toContain(`No authentication credentials available`)
  })

  it(`propagates sandboxConnectPod errors to the caller`, async () => {
    mockSandboxConnectPod.mockRejectedValue(new Error(`Pod connection timed out`))
    await expect(
      connectAndAttach({
        client: makeClient(),
        auth: makeAuth(),
        orgId: `org-1`,
        projectId: `proj-1`,
        sandboxId: `sb-1`,
      })
    ).rejects.toThrow(`Pod connection timed out`)
    expect(mockConnectShellWebSocket).not.toHaveBeenCalled()
  })

  it(`handles auth.creds() returning null by using shellToken`, async () => {
    const auth = { creds: vi.fn().mockReturnValue(null) } as unknown as AuthManager
    await run({ auth })

    const call = mockConnectShellWebSocket.mock.calls[0][0]
    expect(call.bearerToken).toBe(`shell-tok`)
    expect(call.insecure).toBe(false)
  })
})
