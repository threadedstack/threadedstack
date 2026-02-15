import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TRequest } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from './requireResource'

// Mock checkPermission
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
}))

import { checkPermission } from '@TBE/utils/auth/checkPermission'

const mockCheckPermission = vi.mocked(checkPermission)

describe(`requireResourceWithPermission`, () => {
  const mockReq = {} as TRequest

  const buildService = (data?: any, error?: any) => ({
    get: vi.fn().mockResolvedValue({ data, error }),
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should return data when resource found and permission granted`, async () => {
    const resource = { orgId: `org-1`, projectId: `proj-1`, name: `test` }
    const service = buildService(resource)

    const result = await requireResourceWithPermission(
      mockReq,
      service,
      `resource-id`,
      EPermAction.read,
      EPermResource.endpoint,
      `Endpoint`
    )

    expect(result).toBe(resource)
  })

  it(`should throw 500 when service.get returns error`, async () => {
    const service = buildService(undefined, new Error(`DB error`))

    try {
      await requireResourceWithPermission(
        mockReq,
        service,
        `resource-id`,
        EPermAction.read,
        EPermResource.endpoint,
        `Endpoint`
      )
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(500)
      expect(err.message).toBe(`DB error`)
    }
  })

  it(`should throw 404 when service.get returns no data`, async () => {
    const service = buildService(undefined)

    try {
      await requireResourceWithPermission(
        mockReq,
        service,
        `resource-id`,
        EPermAction.read,
        EPermResource.endpoint,
        `Endpoint`
      )
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(404)
      expect(err.message).toBe(`Endpoint not found`)
    }
  })

  it(`should call checkPermission with orgId from resource`, async () => {
    const resource = { orgId: `org-1` }
    const service = buildService(resource)

    await requireResourceWithPermission(
      mockReq,
      service,
      `resource-id`,
      EPermAction.read,
      EPermResource.apiKey,
      `API key`
    )

    expect(mockCheckPermission).toHaveBeenCalledWith(
      mockReq,
      EPermAction.read,
      EPermResource.apiKey,
      { orgId: `org-1`, projectId: undefined }
    )
  })

  it(`should call checkPermission with projectId from resource`, async () => {
    const resource = { projectId: `proj-1` }
    const service = buildService(resource)

    await requireResourceWithPermission(
      mockReq,
      service,
      `resource-id`,
      EPermAction.update,
      EPermResource.function,
      `Function`
    )

    expect(mockCheckPermission).toHaveBeenCalledWith(
      mockReq,
      EPermAction.update,
      EPermResource.function,
      { orgId: undefined, projectId: `proj-1` }
    )
  })

  it(`should call checkPermission with both orgId and projectId`, async () => {
    const resource = { orgId: `org-1`, projectId: `proj-1` }
    const service = buildService(resource)

    await requireResourceWithPermission(
      mockReq,
      service,
      `resource-id`,
      EPermAction.read,
      EPermResource.secret,
      `Secret`
    )

    expect(mockCheckPermission).toHaveBeenCalledWith(
      mockReq,
      EPermAction.read,
      EPermResource.secret,
      { orgId: `org-1`, projectId: `proj-1` }
    )
  })

  it(`should use custom getContext when provided`, async () => {
    const resource = { orgId: `org-1`, projectId: `proj-1`, customField: `custom-org` }
    const service = buildService(resource)

    await requireResourceWithPermission(
      mockReq,
      service,
      `resource-id`,
      EPermAction.read,
      EPermResource.provider,
      `Provider`,
      (data) => ({ orgId: data.orgId || undefined, projectId: undefined })
    )

    expect(mockCheckPermission).toHaveBeenCalledWith(
      mockReq,
      EPermAction.read,
      EPermResource.provider,
      { orgId: `org-1`, projectId: undefined }
    )
  })

  it(`should throw permission error when checkPermission fails`, async () => {
    const resource = { orgId: `org-1` }
    const service = buildService(resource)

    mockCheckPermission.mockRejectedValueOnce(
      Object.assign(new Error(`Permission denied`), { status: 403 })
    )

    try {
      await requireResourceWithPermission(
        mockReq,
        service,
        `resource-id`,
        EPermAction.delete,
        EPermResource.apiKey,
        `API key`
      )
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(403)
      expect(err.message).toBe(`Permission denied`)
    }
  })

  it(`should pass the correct id to service.get`, async () => {
    const resource = { orgId: `org-1` }
    const service = buildService(resource)

    await requireResourceWithPermission(
      mockReq,
      service,
      `my-specific-id`,
      EPermAction.read,
      EPermResource.endpoint,
      `Endpoint`
    )

    expect(service.get).toHaveBeenCalledWith(`my-specific-id`)
  })

  it(`should use the label in the 404 error message`, async () => {
    const service = buildService(undefined)

    try {
      await requireResourceWithPermission(
        mockReq,
        service,
        `resource-id`,
        EPermAction.read,
        EPermResource.function,
        `Custom Label`
      )
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.message).toBe(`Custom Label not found`)
    }
  })

  it(`should not call checkPermission when resource not found`, async () => {
    const service = buildService(undefined)

    try {
      await requireResourceWithPermission(
        mockReq,
        service,
        `resource-id`,
        EPermAction.read,
        EPermResource.endpoint,
        `Endpoint`
      )
    } catch {
      // Expected to throw
    }

    expect(mockCheckPermission).not.toHaveBeenCalled()
  })
})
