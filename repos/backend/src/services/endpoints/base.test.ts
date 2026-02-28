import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EEndpointType, EPermAction, EPermResource } from '@tdsk/domain'

// Mock checkPermission
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn(),
}))

// Mock logger
vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { BaseEndpoint } from './base'

// Concrete test subclass since BaseEndpoint is abstract
class TestEndpointService extends BaseEndpoint {
  readonly type = EEndpointType.proxy

  validateOptions(options: Record<string, any>): void {
    if (!options?.testField) throw new Error(`testField is required`)
  }

  async execute(): Promise<void> {
    // no-op for testing base class
  }
}

describe(`BaseEndpoint`, () => {
  let service: TestEndpointService
  let mockReq: Partial<TRequest>

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TestEndpointService()
    mockReq = {
      method: `GET`,
      user: { id: `user-1` } as any,
    } as Partial<TRequest>
  })

  describe(`checkPermission`, () => {
    it(`should skip permission check for public endpoints`, async () => {
      const endpoint = { public: true, projectId: `p1` } as any
      await service.checkPermission(mockReq as TRequest, endpoint)
      expect(checkPermission).not.toHaveBeenCalled()
    })

    it(`should check permission for non-public endpoints`, async () => {
      const mockCheck = checkPermission as ReturnType<typeof vi.fn>
      mockCheck.mockResolvedValue(undefined)

      const endpoint = { public: false, projectId: `p1` } as any
      await service.checkPermission(mockReq as TRequest, endpoint)

      expect(mockCheck).toHaveBeenCalledWith(
        mockReq,
        EPermAction.read,
        EPermResource.endpoint,
        { projectId: `p1` }
      )
    })

    it(`should throw 403 when permission check fails`, async () => {
      const mockCheck = checkPermission as ReturnType<typeof vi.fn>
      mockCheck.mockRejectedValue(new Error(`forbidden`))

      const endpoint = { public: false, projectId: `p1` } as any
      await expect(
        service.checkPermission(mockReq as TRequest, endpoint)
      ).rejects.toThrow(`Insufficient permissions to use this endpoint`)
    })

    it(`should check permission when public is undefined (default non-public)`, async () => {
      const mockCheck = checkPermission as ReturnType<typeof vi.fn>
      mockCheck.mockResolvedValue(undefined)

      const endpoint = { projectId: `p1` } as any
      await service.checkPermission(mockReq as TRequest, endpoint)

      expect(mockCheck).toHaveBeenCalled()
    })
  })

  describe(`fetchSecrets`, () => {
    it(`should fetch secrets scoped to the endpoint project`, async () => {
      const mockSecrets = [{ id: `s1`, name: `SECRET_1` }]
      const mockDb = {
        services: {
          secret: {
            list: vi.fn().mockResolvedValue({ data: mockSecrets }),
          },
        },
      }

      const endpoint = { projectId: `proj-123` } as any
      const result = await service.fetchSecrets(mockDb as any, endpoint)

      expect(mockDb.services.secret.list).toHaveBeenCalledWith({
        where: { projectId: `proj-123` },
      })
      expect(result).toEqual(mockSecrets)
    })

    it(`should return empty array when no secrets found`, async () => {
      const mockDb = {
        services: {
          secret: {
            list: vi.fn().mockResolvedValue({ data: undefined }),
          },
        },
      }

      const endpoint = { projectId: `proj-123` } as any
      const result = await service.fetchSecrets(mockDb as any, endpoint)

      expect(result).toEqual([])
    })
  })

  describe(`validateProject`, () => {
    it(`should not throw when endpoint belongs to the project`, () => {
      const endpoint = { projectId: `proj-123` } as any
      expect(() => service.validateProject(endpoint, `proj-123`)).not.toThrow()
    })

    it(`should throw 403 when endpoint does not belong to project`, () => {
      const endpoint = { projectId: `proj-123` } as any
      expect(() => service.validateProject(endpoint, `proj-999`)).toThrow(
        `Endpoint does not belong to this project`
      )
    })
  })

  describe(`validateMethod`, () => {
    it(`should not throw when methods match (case-insensitive)`, () => {
      const req = { method: `POST` } as TRequest
      const endpoint = { method: `post` } as any
      expect(() => service.validateMethod(req, endpoint)).not.toThrow()
    })

    it(`should throw 405 when methods do not match`, () => {
      const req = { method: `GET` } as TRequest
      const endpoint = { method: `POST` } as any
      expect(() => service.validateMethod(req, endpoint)).toThrow(
        `Method GET not allowed. Endpoint accepts POST`
      )
    })

    it(`should not throw when no method specified on endpoint`, () => {
      const req = { method: `GET` } as TRequest
      const endpoint = {} as any
      expect(() => service.validateMethod(req, endpoint)).not.toThrow()
    })
  })
})
