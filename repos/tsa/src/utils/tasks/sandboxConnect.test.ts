import type { ApiClient } from '@TSA/services/api'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnsureSshConfig = vi.fn()
const mockGetPublicKey = vi.fn()

vi.mock(`@TSA/theme`, () => ({
  themed: (_style: string, text: string) => text,
}))

vi.mock(`@TSA/services/sync/sshConfig`, () => ({
  ensureSshConfig: (...args: any[]) => mockEnsureSshConfig(...args),
  getPublicKey: (...args: any[]) => mockGetPublicKey(...args),
}))

import { sandboxConnect } from './sandboxConnect'

const makeClient = (overrides?: Partial<ApiClient>) =>
  ({
    connectSandbox: vi.fn(),
    injectSshKey: vi.fn(),
    ...overrides,
  }) as unknown as ApiClient

const defaultConnectResp = {
  sandboxId: `sb-resolved`,
  instanceId: `pod-1`,
  workdir: `/workspace`,
  command: `bash`,
  password: `secret`,
}

describe(`sandboxConnect`, () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    stdoutSpy = vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
    mockEnsureSshConfig.mockReturnValue(undefined)
    mockGetPublicKey.mockReturnValue(`ssh-ed25519 AAAAC3test pubkey`)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it(`returns connect response and injects SSH key on success`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({ data: defaultConnectResp }),
      injectSshKey: vi.fn().mockResolvedValue({}),
    })

    const result = await sandboxConnect(client, `org-1`, `proj-1`, `sb-1`)

    expect(result).toEqual(defaultConnectResp)
    expect(client.connectSandbox).toHaveBeenCalledWith(
      `org-1`,
      `proj-1`,
      `sb-1`,
      undefined
    )
    expect(mockEnsureSshConfig).toHaveBeenCalled()
    expect(mockGetPublicKey).toHaveBeenCalled()
    expect(client.injectSshKey).toHaveBeenCalledWith(
      `org-1`,
      `proj-1`,
      `sb-resolved`,
      `pod-1`,
      `ssh-ed25519 AAAAC3test pubkey`
    )
    expect(stdoutSpy).toHaveBeenCalledTimes(2)
  })

  it(`throws when API connect fails`, async () => {
    const client = makeClient({
      connectSandbox: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: `Connection refused` } }),
    })

    await expect(sandboxConnect(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `Connection refused`
    )
    expect(client.injectSshKey).not.toHaveBeenCalled()
  })

  it(`throws generic message when API returns error without message`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({ data: null, error: {} }),
    })

    await expect(sandboxConnect(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `Failed to connect to sandbox`
    )
  })

  it(`throws when instanceId is missing`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({
        data: { ...defaultConnectResp, instanceId: undefined },
      }),
    })

    await expect(sandboxConnect(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `No instance ID returned from server`
    )
    expect(client.injectSshKey).not.toHaveBeenCalled()
  })

  it(`throws when SSH config setup fails`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({ data: defaultConnectResp }),
    })
    mockEnsureSshConfig.mockImplementation(() => {
      throw new Error(`Permission denied: ~/.ssh`)
    })

    await expect(sandboxConnect(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `Failed to configure SSH: Permission denied: ~/.ssh`
    )
    expect(client.injectSshKey).not.toHaveBeenCalled()
  })

  it(`throws when getPublicKey fails`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({ data: defaultConnectResp }),
    })
    mockGetPublicKey.mockImplementation(() => {
      throw new Error(`Key file not found`)
    })

    await expect(sandboxConnect(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `Failed to configure SSH: Key file not found`
    )
    expect(client.injectSshKey).not.toHaveBeenCalled()
  })

  it(`throws when SSH key injection fails`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({ data: defaultConnectResp }),
      injectSshKey: vi.fn().mockResolvedValue({ error: { message: `Unauthorized` } }),
    })

    await expect(sandboxConnect(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `SSH key injection failed: Unauthorized`
    )
  })

  it(`passes instanceId option through to API call`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({ data: defaultConnectResp }),
      injectSshKey: vi.fn().mockResolvedValue({}),
    })

    await sandboxConnect(client, `org-1`, `proj-1`, `sb-1`, { instanceId: `custom-inst` })

    expect(client.connectSandbox).toHaveBeenCalledWith(`org-1`, `proj-1`, `sb-1`, {
      instanceId: `custom-inst`,
    })
  })

  it(`passes newInstance option through to API call`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({ data: defaultConnectResp }),
      injectSshKey: vi.fn().mockResolvedValue({}),
    })

    await sandboxConnect(client, `org-1`, `proj-1`, `sb-1`, { newInstance: true })

    expect(client.connectSandbox).toHaveBeenCalledWith(`org-1`, `proj-1`, `sb-1`, {
      newInstance: true,
    })
  })

  it(`throws when sandboxId is missing from response`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({
        data: { ...defaultConnectResp, sandboxId: undefined },
      }),
    })

    await expect(sandboxConnect(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `Server did not return a resolved sandbox ID`
    )
  })
})
