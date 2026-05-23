import type { ApiClient } from '@TSA/services/api'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(`@TSA/theme`, () => ({
  themed: (_style: string, text: string) => text,
}))

import { sandboxConnectPod } from './sandboxConnectPod'

const makeClient = (overrides?: Partial<ApiClient>) =>
  ({
    connectSandbox: vi.fn(),
    ...overrides,
  }) as unknown as ApiClient

const defaultConnectResp = {
  sandboxId: `sb-resolved`,
  instanceId: `pod-1`,
  workdir: `/workspace`,
  command: `bash`,
}

describe(`sandboxConnectPod`, () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    stdoutSpy = vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it(`returns connect response on success`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({ data: defaultConnectResp }),
    })

    const result = await sandboxConnectPod(client, `org-1`, `proj-1`, `sb-1`)

    expect(result).toEqual(defaultConnectResp)
    expect(client.connectSandbox).toHaveBeenCalledWith(
      `org-1`,
      `proj-1`,
      `sb-1`,
      undefined
    )
    expect(stdoutSpy).toHaveBeenCalledTimes(2)
  })

  it(`throws when API returns error`, async () => {
    const client = makeClient({
      connectSandbox: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: `Connection refused` } }),
    })

    await expect(sandboxConnectPod(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `Connection refused`
    )
  })

  it(`throws generic message when API returns error without message`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({ data: null, error: {} }),
    })

    await expect(sandboxConnectPod(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `Failed to connect to sandbox`
    )
  })

  it(`throws when instanceId is missing from response`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({
        data: { ...defaultConnectResp, instanceId: undefined },
      }),
    })

    await expect(sandboxConnectPod(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `No instance ID returned from server`
    )
  })

  it(`throws when sandboxId is missing from response`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({
        data: { ...defaultConnectResp, sandboxId: undefined },
      }),
    })

    await expect(sandboxConnectPod(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `Server did not return a resolved sandbox ID`
    )
  })

  it(`throws when workdir is missing from response`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({
        data: { ...defaultConnectResp, workdir: undefined },
      }),
    })

    await expect(sandboxConnectPod(client, `org-1`, `proj-1`, `sb-1`)).rejects.toThrow(
      `Server did not return a workdir`
    )
  })

  it(`passes instanceId option through to API call`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({ data: defaultConnectResp }),
    })

    await sandboxConnectPod(client, `org-1`, `proj-1`, `sb-1`, {
      instanceId: `custom-inst`,
    })

    expect(client.connectSandbox).toHaveBeenCalledWith(`org-1`, `proj-1`, `sb-1`, {
      instanceId: `custom-inst`,
    })
  })

  it(`passes newInstance option through to API call`, async () => {
    const client = makeClient({
      connectSandbox: vi.fn().mockResolvedValue({ data: defaultConnectResp }),
    })

    await sandboxConnectPod(client, `org-1`, `proj-1`, `sb-1`, { newInstance: true })

    expect(client.connectSandbox).toHaveBeenCalledWith(`org-1`, `proj-1`, `sb-1`, {
      newInstance: true,
    })
  })
})
