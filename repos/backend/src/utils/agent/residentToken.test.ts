import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiKey, ApiKeyPrefix } from '@tdsk/domain'

import { createResidentToken, revokeResidentKeysExcept } from './residentToken'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const buildDb = () => {
  const services = {
    apiKey: {
      getByResidentAgent: vi.fn().mockResolvedValue({ data: [] }),
      revoke: vi.fn().mockResolvedValue({ data: true }),
      create: vi.fn(
        async (data: ApiKey): Promise<{ data?: ApiKey; error?: Error }> => ({
          data: new ApiKey({ ...data, id: `ak_new00001` }),
        })
      ),
    },
  }
  return { db: { services } as any, services }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`createResidentToken`, () => {
  it(`creates a key WITHOUT listing or revoking any prior keys`, async () => {
    const { db, services } = buildDb()

    const { key, apiKey } = await createResidentToken(db, `og_org00001`, `ag_agent001`)

    expect(apiKey.id).toBe(`ak_new00001`)
    expect(key.startsWith(ApiKeyPrefix)).toBe(true)
    expect(services.apiKey.create).toHaveBeenCalledOnce()
    // The whole point of the split: the old pod's token stays valid — no revoke here.
    expect(services.apiKey.getByResidentAgent).not.toHaveBeenCalled()
    expect(services.apiKey.revoke).not.toHaveBeenCalled()
  })

  it(`throws a 500 Exception when the create fails`, async () => {
    const { db, services } = buildDb()
    services.apiKey.create.mockResolvedValue({ error: new Error(`insert failed`) })

    await expect(
      createResidentToken(db, `og_org00001`, `ag_agent001`)
    ).rejects.toMatchObject({ status: 500 })
  })
})

describe(`revokeResidentKeysExcept`, () => {
  it(`revokes every active resident key except the one to keep`, async () => {
    const { db, services } = buildDb()
    services.apiKey.getByResidentAgent.mockResolvedValue({
      data: [
        new ApiKey({ id: `ak_old00001` }),
        new ApiKey({ id: `ak_keep0001` }),
        new ApiKey({ id: `ak_old00002` }),
      ],
    })

    await revokeResidentKeysExcept(db, `ag_agent001`, `ak_keep0001`)

    expect(services.apiKey.revoke).toHaveBeenCalledTimes(2)
    expect(services.apiKey.revoke).toHaveBeenCalledWith(`ak_old00001`)
    expect(services.apiKey.revoke).toHaveBeenCalledWith(`ak_old00002`)
    expect(services.apiKey.revoke).not.toHaveBeenCalledWith(`ak_keep0001`)
  })

  it(`throws a 500 when the key lookup fails`, async () => {
    const { db, services } = buildDb()
    services.apiKey.getByResidentAgent.mockResolvedValue({ error: new Error(`db down`) })

    await expect(
      revokeResidentKeysExcept(db, `ag_agent001`, `ak_keep0001`)
    ).rejects.toMatchObject({ status: 500 })
    expect(services.apiKey.revoke).not.toHaveBeenCalled()
  })
})
