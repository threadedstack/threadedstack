import { describe, it, expect, vi } from 'vitest'
import { EProvider } from '@tdsk/domain'
import { validateGitProviderInputs } from './validateGitProviderInputs'

describe(`validateGitProviderInputs`, () => {
  const buildDb = (providers: any[] = [], error: any = null) => ({
    services: {
      provider: {
        list: vi.fn().mockResolvedValue({ data: providers, error }),
      },
    },
  })

  it(`should return undefined when inputs is not an array`, async () => {
    const db = buildDb()
    const result = await validateGitProviderInputs(db as any, `org-1`, undefined)
    expect(result).toBeUndefined()
    expect(db.services.provider.list).not.toHaveBeenCalled()
  })

  it(`should return an empty array when inputs is empty`, async () => {
    const db = buildDb()
    const result = await validateGitProviderInputs(db as any, `org-1`, [])
    expect(result).toEqual([])
    expect(db.services.provider.list).not.toHaveBeenCalled()
  })

  it(`should throw 400 when an entry is missing projectId`, async () => {
    const db = buildDb()
    await expect(
      validateGitProviderInputs(db as any, `org-1`, [
        { projectId: ``, providers: [] } as any,
      ])
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining(`projectId is required`),
    })
  })

  it(`should throw 400 when providers is not an array`, async () => {
    const db = buildDb()
    await expect(
      validateGitProviderInputs(db as any, `org-1`, [
        { projectId: `proj-1`, providers: `not-an-array` } as any,
      ])
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining(`providers must be an array for project proj-1`),
    })
  })

  it(`should skip the db lookup when no provider entries carry an id`, async () => {
    const db = buildDb()
    const inputs = [{ projectId: `proj-1`, providers: [{}, { id: `` }] as any }]
    const result = await validateGitProviderInputs(db as any, `org-1`, inputs)
    expect(result).toEqual(inputs)
    expect(db.services.provider.list).not.toHaveBeenCalled()
  })

  it(`should throw 500 when the provider lookup errors`, async () => {
    const db = buildDb([], { message: `db exploded` })
    await expect(
      validateGitProviderInputs(db as any, `org-1`, [
        { projectId: `proj-1`, providers: [{ id: `prov-1` }] },
      ])
    ).rejects.toMatchObject({ status: 500, message: `db exploded` })
  })

  it(`should throw 404 when a referenced provider does not exist`, async () => {
    const db = buildDb([])
    await expect(
      validateGitProviderInputs(db as any, `org-1`, [
        { projectId: `proj-1`, providers: [{ id: `missing-provider` }] },
      ])
    ).rejects.toMatchObject({
      status: 404,
      message: `Git provider missing-provider not found`,
    })
  })

  it(`should throw 403 when the provider belongs to a different org`, async () => {
    const db = buildDb([{ id: `prov-1`, orgId: `other-org`, type: EProvider.git }])
    await expect(
      validateGitProviderInputs(db as any, `org-1`, [
        { projectId: `proj-1`, providers: [{ id: `prov-1` }] },
      ])
    ).rejects.toMatchObject({
      status: 403,
      message: `Provider prov-1 does not belong to organization org-1`,
    })
  })

  it(`should throw 400 when the provider is not a git provider`, async () => {
    const db = buildDb([{ id: `prov-1`, orgId: `org-1`, type: EProvider.ai }])
    await expect(
      validateGitProviderInputs(db as any, `org-1`, [
        { projectId: `proj-1`, providers: [{ id: `prov-1` }] },
      ])
    ).rejects.toMatchObject({
      status: 400,
      message: `Provider prov-1 is not a git provider`,
    })
  })

  it(`should return the inputs unchanged when all providers are valid git providers for the org`, async () => {
    const db = buildDb([
      { id: `prov-1`, orgId: `org-1`, type: EProvider.git },
      { id: `prov-2`, orgId: `org-1`, type: EProvider.git },
    ])
    const inputs = [
      {
        projectId: `proj-1`,
        providers: [{ id: `prov-1`, branch: `main` }, { id: `prov-2` }],
      },
    ]
    const result = await validateGitProviderInputs(db as any, `org-1`, inputs)
    expect(result).toBe(inputs)
  })

  it(`should validate every entry across multiple projects`, async () => {
    const db = buildDb([{ id: `prov-1`, orgId: `org-1`, type: EProvider.git }])
    const inputs = [
      { projectId: `proj-1`, providers: [{ id: `prov-1` }] },
      { projectId: `proj-2`, providers: [{ id: `prov-missing` }] },
    ]
    await expect(
      validateGitProviderInputs(db as any, `org-1`, inputs)
    ).rejects.toMatchObject({
      status: 404,
      message: `Git provider prov-missing not found`,
    })
  })
})
