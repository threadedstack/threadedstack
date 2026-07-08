import { describe, it, expect, vi } from 'vitest'
import { requireOrgSandbox } from './requireOrgSandbox'

describe(`requireOrgSandbox`, () => {
  const buildDb = (sandbox: any = undefined, error: any = null) => ({
    services: {
      sandbox: {
        get: vi.fn().mockResolvedValue({ data: sandbox, error }),
      },
    },
  })

  it(`should resolve without a db lookup when environment has no sandboxId`, async () => {
    const db = buildDb()
    await expect(
      requireOrgSandbox(db as any, { foo: `bar` }, `org-1`)
    ).resolves.toBeUndefined()
    expect(db.services.sandbox.get).not.toHaveBeenCalled()
  })

  it(`should resolve without a db lookup when environment is null`, async () => {
    const db = buildDb()
    await expect(requireOrgSandbox(db as any, null, `org-1`)).resolves.toBeUndefined()
    expect(db.services.sandbox.get).not.toHaveBeenCalled()
  })

  it(`should resolve without a db lookup when sandboxId is an empty string`, async () => {
    const db = buildDb()
    await expect(
      requireOrgSandbox(db as any, { sandboxId: `` }, `org-1`)
    ).resolves.toBeUndefined()
    expect(db.services.sandbox.get).not.toHaveBeenCalled()
  })

  it(`should resolve without a db lookup when sandboxId is not a string`, async () => {
    const db = buildDb()
    await expect(
      requireOrgSandbox(db as any, { sandboxId: 123 }, `org-1`)
    ).resolves.toBeUndefined()
    expect(db.services.sandbox.get).not.toHaveBeenCalled()
  })

  it(`should throw 500 when the sandbox lookup errors`, async () => {
    const db = buildDb(undefined, { message: `db exploded` })
    await expect(
      requireOrgSandbox(db as any, { sandboxId: `sb-1` }, `org-1`)
    ).rejects.toMatchObject({ status: 500, message: `db exploded` })
  })

  it(`should throw 400 when the sandbox does not exist`, async () => {
    const db = buildDb(undefined)
    await expect(
      requireOrgSandbox(db as any, { sandboxId: `sb-1` }, `org-1`)
    ).rejects.toMatchObject({
      status: 400,
      message: `Sandbox sb-1 not found`,
    })
  })

  it(`should throw 403 when the sandbox belongs to a different org`, async () => {
    const db = buildDb({ id: `sb-1`, orgId: `other-org` })
    await expect(
      requireOrgSandbox(db as any, { sandboxId: `sb-1` }, `org-1`)
    ).rejects.toMatchObject({
      status: 403,
      message: `Sandbox sb-1 does not belong to this organization`,
      code: `FORBIDDEN`,
    })
  })

  it(`should resolve when the sandbox belongs to the org`, async () => {
    const db = buildDb({ id: `sb-1`, orgId: `org-1` })
    await expect(
      requireOrgSandbox(db as any, { sandboxId: `sb-1` }, `org-1`)
    ).resolves.toBeUndefined()
    expect(db.services.sandbox.get).toHaveBeenCalledWith(`sb-1`)
  })
})
