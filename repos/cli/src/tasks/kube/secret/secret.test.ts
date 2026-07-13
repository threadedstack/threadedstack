import type { TTaskActionArgs } from '@TSCL/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockWriteFileSync,
  mockRmSync,
  mockKubectlCreate,
  mockKubectlDelete,
  mockTaskError,
} = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockKubectlCreate: vi.fn(),
  mockKubectlDelete: vi.fn(),
  mockTaskError: vi.fn(),
}))

vi.mock(`fs`, () => ({
  writeFileSync: mockWriteFileSync,
  rmSync: mockRmSync,
}))

vi.mock(`@tdsk/logger`, () => ({
  Logger: {
    info: vi.fn(),
    header: vi.fn(),
    error: vi.fn(),
    empty: vi.fn(),
    colors: { white: (str: string) => str },
  },
}))

vi.mock(`@TSCL/utils/tasks/error`, () => ({ taskError: mockTaskError }))

vi.mock(`@TSCL/utils/kube/kubectl`, () => ({
  kubectl: {
    create: mockKubectlCreate,
    delete: mockKubectlDelete,
  },
}))

import { secret } from './secret'

const buildProps = (params: Record<string, any> = {}) =>
  ({
    params: {
      name: `my-secret`,
      value: `s3cr3t-value`,
      ...params,
    },
  }) as unknown as TTaskActionArgs

describe(`secretAct`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockKubectlDelete.mockResolvedValue(``)
    mockKubectlCreate.mockResolvedValue(``)
  })

  it(`writes the temp secret file owner-only (mode 0600)`, async () => {
    await secret.action(buildProps())

    expect(mockWriteFileSync).toHaveBeenCalledWith(expect.any(String), `s3cr3t-value`, {
      mode: 0o600,
    })
  })

  it(`removes the temp secret file after a successful kubectl create`, async () => {
    await secret.action(buildProps())

    expect(mockKubectlCreate).toHaveBeenCalled()
    expect(mockRmSync).toHaveBeenCalledTimes(1)
  })

  it(`still removes the temp secret file when kubectl create rejects (e.g. kubectl missing -- ENOENT)`, async () => {
    mockKubectlCreate.mockRejectedValue(
      Object.assign(new Error(`spawn kubectl ENOENT`), {
        code: `ENOENT`,
      })
    )

    await expect(secret.action(buildProps())).rejects.toThrow(`spawn kubectl ENOENT`)

    expect(mockRmSync).toHaveBeenCalledTimes(1)
  })

  it(`still removes the temp secret file when kubectl delete rejects`, async () => {
    mockKubectlDelete.mockRejectedValue(new Error(`connection refused`))

    await expect(secret.action(buildProps())).rejects.toThrow(`connection refused`)

    expect(mockKubectlCreate).not.toHaveBeenCalled()
    expect(mockRmSync).toHaveBeenCalledTimes(1)
  })
})
