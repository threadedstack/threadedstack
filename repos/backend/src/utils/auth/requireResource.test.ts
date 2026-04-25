import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireResource } from './requireResource'

describe(`requireResource`, () => {
  const buildService = (data?: any, error?: any) => ({
    get: vi.fn().mockResolvedValue({ data, error }),
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should return data when resource found`, async () => {
    const resource = { orgId: `org-1`, projectId: `proj-1`, name: `test` }
    const service = buildService(resource)

    const result = await requireResource(service, `resource-id`, `Endpoint`)

    expect(result).toBe(resource)
  })

  it(`should throw 500 when service.get returns error`, async () => {
    const service = buildService(undefined, new Error(`DB error`))

    try {
      await requireResource(service, `resource-id`, `Endpoint`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(500)
      expect(err.message).toBe(`DB error`)
    }
  })

  it(`should throw 404 when service.get returns not found error`, async () => {
    const service = buildService(undefined, new Error(`Resource not found`))

    try {
      await requireResource(service, `resource-id`, `Endpoint`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(404)
      expect(err.message).toBe(`Endpoint not found`)
    }
  })

  it(`should throw 404 when service.get returns no data`, async () => {
    const service = buildService(undefined)

    try {
      await requireResource(service, `resource-id`, `Endpoint`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.status).toBe(404)
      expect(err.message).toBe(`Endpoint not found`)
    }
  })

  it(`should pass the correct id to service.get`, async () => {
    const resource = { orgId: `org-1` }
    const service = buildService(resource)

    await requireResource(service, `my-specific-id`, `Endpoint`)

    expect(service.get).toHaveBeenCalledWith(`my-specific-id`)
  })

  it(`should use the label in the 404 error message`, async () => {
    const service = buildService(undefined)

    try {
      await requireResource(service, `resource-id`, `Custom Label`)
      expect.unreachable(`Should have thrown`)
    } catch (err: any) {
      expect(err.message).toBe(`Custom Label not found`)
    }
  })
})
