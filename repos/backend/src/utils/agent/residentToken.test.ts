import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiKey, hashKey, ApiKeyPrefix } from '@tdsk/domain'

import {
  mintResidentToken,
  createResidentToken,
  revokeResidentKeysExcept,
} from './residentToken'

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

describe(`mintResidentToken`, () => {
  it(`creates a resident-bound org-scoped key and returns the secret once`, async () => {
    const { db, services } = buildDb()

    const { key, apiKey } = await mintResidentToken(db, `og_org00001`, `ag_agent001`)

    expect(key.startsWith(ApiKeyPrefix)).toBe(true)
    expect(apiKey.id).toBe(`ak_new00001`)
    expect(services.apiKey.revoke).not.toHaveBeenCalled()

    const created = services.apiKey.create.mock.calls[0][0] as ApiKey
    expect(created).toBeInstanceOf(ApiKey)
    expect(created.orgId).toBe(`og_org00001`)
    expect(created.residentAgentId).toBe(`ag_agent001`)
    expect(created.name).toBe(`resident:ag_agent001`)
    expect(created.active).toBe(true)
    expect(created.permissions).toEqual([])
    // Only the hash is stored — and it must be the hash of the returned secret
    expect(created.keyHash).toBe(hashKey(key))
    expect(created.key).toBeUndefined()
    expect(key.startsWith(created.keyPrefix)).toBe(true)
  })

  it(`rotates create-first-then-revoke: the new key survives, every prior key is revoked`, async () => {
    const { db, services } = buildDb()
    services.apiKey.getByResidentAgent.mockResolvedValue({
      data: [
        new ApiKey({ id: `ak_old00001` }),
        new ApiKey({ id: `ak_old00002` }),
        new ApiKey({ id: `ak_new00001` }), // the freshly-minted key must be kept
      ],
    })

    await mintResidentToken(db, `og_org00001`, `ag_agent001`)

    expect(services.apiKey.create).toHaveBeenCalledOnce()
    expect(services.apiKey.getByResidentAgent).toHaveBeenCalledWith(`ag_agent001`)
    expect(services.apiKey.revoke).toHaveBeenCalledTimes(2)
    expect(services.apiKey.revoke).toHaveBeenCalledWith(`ak_old00001`)
    expect(services.apiKey.revoke).toHaveBeenCalledWith(`ak_old00002`)
    // Never revokes the key it just minted.
    expect(services.apiKey.revoke).not.toHaveBeenCalledWith(`ak_new00001`)
  })

  it(`mints a unique secret per call`, async () => {
    const { db } = buildDb()

    const first = await mintResidentToken(db, `og_org00001`, `ag_agent001`)
    const second = await mintResidentToken(db, `og_org00001`, `ag_agent001`)
    expect(first.key).not.toBe(second.key)
  })

  it(`throws a 500 when the prior-key lookup fails (after the new key is created)`, async () => {
    const { db, services } = buildDb()
    services.apiKey.getByResidentAgent.mockResolvedValue({
      error: new Error(`db down`),
    })

    await expect(
      mintResidentToken(db, `og_org00001`, `ag_agent001`)
    ).rejects.toMatchObject({ status: 500 })
    // create-first: the new key exists before revoke is attempted.
    expect(services.apiKey.create).toHaveBeenCalledOnce()
  })

  it(`throws a 500 when revoking a prior key fails (after the new key is created)`, async () => {
    const { db, services } = buildDb()
    services.apiKey.getByResidentAgent.mockResolvedValue({
      data: [new ApiKey({ id: `ak_old00001` })],
    })
    services.apiKey.revoke.mockResolvedValue({ error: new Error(`nope`) })

    await expect(
      mintResidentToken(db, `og_org00001`, `ag_agent001`)
    ).rejects.toMatchObject({ status: 500 })
    expect(services.apiKey.create).toHaveBeenCalledOnce()
  })

  it(`throws a 500 Exception when the create fails`, async () => {
    const { db, services } = buildDb()
    services.apiKey.create.mockResolvedValue({ error: new Error(`insert failed`) })

    await expect(
      mintResidentToken(db, `og_org00001`, `ag_agent001`)
    ).rejects.toMatchObject({ status: 500 })
    // create failed → no revoke sweep is attempted.
    expect(services.apiKey.revoke).not.toHaveBeenCalled()
  })
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
