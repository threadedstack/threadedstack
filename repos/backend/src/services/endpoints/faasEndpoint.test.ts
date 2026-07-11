import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'

import { EEndpointType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FaaSEndpoint } from '@TBE/services/endpoints/faasEndpoint'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'

// Mock FunctionExecutor
vi.mock(`@TBE/services/functions/functionExecutor`, () => ({
  FunctionExecutor: {
    execute: vi.fn(),
  },
}))

// Mock logger
vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock checkPermission
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn(),
}))

describe(`FaaSEndpoint`, () => {
  let service: FaaSEndpoint
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockDb: {
    services: {
      function: { get: ReturnType<typeof vi.fn> }
      secret: { list: ReturnType<typeof vi.fn> }
      project?: { get: ReturnType<typeof vi.fn> }
      org?: { get: ReturnType<typeof vi.fn> }
      subscription?: { findByUser: ReturnType<typeof vi.fn> }
      quota?: {
        incrementIfUnderLimit: ReturnType<typeof vi.fn>
        increment: ReturnType<typeof vi.fn>
        decrement: ReturnType<typeof vi.fn>
      }
    }
  }
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockSetHeader: ReturnType<typeof vi.fn>

  const mockFunction = {
    id: `func-123`,
    name: `testFunction`,
    language: `javascript`,
    projectId: `project-1`,
    content: `export default async (req, ctx) => ({ statusCode: 200, body: { ok: true } })`,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockJson = vi.fn()
    mockSetHeader = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
      setHeader: mockSetHeader,
    } as Partial<Response>

    mockReq = {
      method: `POST`,
      path: `/proxy/project-1/endpoint-1/some/path`,
      headers: { 'content-type': `application/json` },
      query: { foo: `bar` },
      body: { input: `data` },
    } as Partial<TRequest>

    mockDb = {
      services: {
        function: { get: vi.fn() },
        secret: { list: vi.fn().mockResolvedValue({ data: [] }) },
      },
    }

    service = new FaaSEndpoint(mockDb as unknown as TDatabase)
  })

  describe(`type`, () => {
    it(`should be faas`, () => {
      expect(service.type).toBe(EEndpointType.faas)
    })
  })

  describe(`validateOptions`, () => {
    it(`should pass when functionId is present`, () => {
      expect(() => service.validateOptions({ functionId: `func-123` })).not.toThrow()
    })

    it(`should throw when functionId is missing`, () => {
      expect(() => service.validateOptions({})).toThrow(
        `FaaS endpoint requires a functionId in options`
      )
    })

    it(`should throw when options is undefined`, () => {
      expect(() => service.validateOptions(undefined as any)).toThrow(
        `FaaS endpoint requires a functionId in options`
      )
    })
  })

  describe(`execute`, () => {
    it(`should execute function and return HTTP response`, async () => {
      mockDb.services.function.get.mockResolvedValue({ data: mockFunction })

      const mockExecute = FunctionExecutor.execute as ReturnType<typeof vi.fn>
      mockExecute.mockResolvedValue({
        success: true,
        output: { statusCode: 201, body: { created: true } },
        duration: 150,
      })

      const endpoint = {
        type: EEndpointType.faas,
        projectId: `project-1`,
        options: {
          type: EEndpointType.faas,
          functionId: `func-123`,
          envVars: { NODE_ENV: `test` },
          arguments: { key: `value` },
        },
      } as any

      await service.execute(mockReq as TRequest, mockRes as Response, endpoint)

      expect(mockDb.services.function.get).toHaveBeenCalledWith(`func-123`)
      expect(mockExecute).toHaveBeenCalledWith(mockFunction, {
        db: mockDb,
        request: {
          method: `POST`,
          path: `/proxy/project-1/endpoint-1/some/path`,
          headers: { 'content-type': `application/json` },
          query: { foo: `bar` },
          body: { input: `data` },
        },
        context: {
          envVars: { NODE_ENV: `test` },
          args: { key: `value` },
        },
      })
      expect(mockStatus).toHaveBeenCalledWith(201)
      expect(mockJson).toHaveBeenCalledWith({ created: true })
    })

    it(`should return 404 when function not found`, async () => {
      mockDb.services.function.get.mockResolvedValue({ data: undefined })

      const endpoint = {
        type: EEndpointType.faas,
        projectId: `project-1`,
        options: {
          type: EEndpointType.faas,
          functionId: `missing-func`,
        },
      } as any

      await expect(
        service.execute(mockReq as TRequest, mockRes as Response, endpoint)
      ).rejects.toThrow(`Function not found: missing-func`)
    })

    it(`should return 500 when function execution fails`, async () => {
      mockDb.services.function.get.mockResolvedValue({ data: mockFunction })

      const mockExecute = FunctionExecutor.execute as ReturnType<typeof vi.fn>
      mockExecute.mockResolvedValue({
        success: false,
        output: null,
        duration: 50,
        error: `Runtime error: cannot read property of undefined`,
      })

      const endpoint = {
        type: EEndpointType.faas,
        projectId: `project-1`,
        options: {
          type: EEndpointType.faas,
          functionId: `func-123`,
        },
      } as any

      await expect(
        service.execute(mockReq as TRequest, mockRes as Response, endpoint)
      ).rejects.toThrow(
        `Function execution failed: Runtime error: cannot read property of undefined`
      )
    })

    it(`should use default 200 status when no statusCode in function output`, async () => {
      mockDb.services.function.get.mockResolvedValue({ data: mockFunction })

      const mockExecute = FunctionExecutor.execute as ReturnType<typeof vi.fn>
      mockExecute.mockResolvedValue({
        success: true,
        output: { body: { message: `hello` } },
        duration: 100,
      })

      const endpoint = {
        type: EEndpointType.faas,
        projectId: `project-1`,
        options: {
          type: EEndpointType.faas,
          functionId: `func-123`,
        },
      } as any

      await service.execute(mockReq as TRequest, mockRes as Response, endpoint)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ message: `hello` })
    })

    it(`should set custom response headers from function output`, async () => {
      mockDb.services.function.get.mockResolvedValue({ data: mockFunction })

      const mockExecute = FunctionExecutor.execute as ReturnType<typeof vi.fn>
      mockExecute.mockResolvedValue({
        success: true,
        output: {
          statusCode: 200,
          headers: {
            'X-Custom-Header': `custom-value`,
            'X-Request-Id': `req-abc-123`,
          },
          body: { data: `response` },
        },
        duration: 80,
      })

      const endpoint = {
        type: EEndpointType.faas,
        projectId: `project-1`,
        options: {
          type: EEndpointType.faas,
          functionId: `func-123`,
        },
      } as any

      await service.execute(mockReq as TRequest, mockRes as Response, endpoint)

      expect(mockSetHeader).toHaveBeenCalledWith(`X-Custom-Header`, `custom-value`)
      expect(mockSetHeader).toHaveBeenCalledWith(`X-Request-Id`, `req-abc-123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: `response` })
    })

    it(`should throw 400 when endpoint has no functionId`, async () => {
      const endpoint = {
        type: EEndpointType.faas,
        projectId: `project-1`,
        options: {
          type: EEndpointType.faas,
        },
      } as any

      await expect(
        service.execute(mockReq as TRequest, mockRes as Response, endpoint)
      ).rejects.toThrow(`FaaS endpoint has no functionId configured`)
    })

    it(`should return raw output as body when output has no body property`, async () => {
      mockDb.services.function.get.mockResolvedValue({ data: mockFunction })

      const mockExecute = FunctionExecutor.execute as ReturnType<typeof vi.fn>
      mockExecute.mockResolvedValue({
        success: true,
        output: `raw string output`,
        duration: 60,
      })

      const endpoint = {
        type: EEndpointType.faas,
        projectId: `project-1`,
        options: {
          type: EEndpointType.faas,
          functionId: `func-123`,
        },
      } as any

      await service.execute(mockReq as TRequest, mockRes as Response, endpoint)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith(`raw string output`)
    })

    describe(`compute quota enforcement`, () => {
      const wireQuotaServices = () => {
        mockDb.services.project = {
          get: vi.fn().mockResolvedValue({ data: { orgId: `org-1` } }),
        }
        mockDb.services.org = {
          get: vi.fn().mockResolvedValue({ data: { ownerId: `user-1` } }),
        }
        mockDb.services.subscription = {
          findByUser: vi.fn().mockResolvedValue({ data: { tier: `free` } }),
        }
        mockDb.services.quota = {
          incrementIfUnderLimit: vi.fn(),
          increment: vi.fn().mockResolvedValue({ data: {} }),
          decrement: vi.fn().mockResolvedValue({ data: {} }),
        }
      }

      const faasEndpoint = () =>
        ({
          id: `ep-1`,
          type: EEndpointType.faas,
          projectId: `project-1`,
          options: { type: EEndpointType.faas, functionId: `func-123` },
        }) as any

      it(`rejects the request before executing when compute usage is already at the limit`, async () => {
        wireQuotaServices()
        mockDb.services.quota!.incrementIfUnderLimit.mockResolvedValue({
          data: null,
          quotaExceeded: true,
        })
        mockDb.services.function.get.mockResolvedValue({ data: mockFunction })

        await expect(
          service.execute(mockReq as TRequest, mockRes as Response, faasEndpoint())
        ).rejects.toThrow(`Compute quota exceeded`)

        expect(mockDb.services.quota!.incrementIfUnderLimit).toHaveBeenCalledWith(
          `org-1`,
          expect.any(String),
          `compute`,
          1_000,
          1
        )
        expect(FunctionExecutor.execute).not.toHaveBeenCalled()
      })

      it(`proceeds and trues up the reservation to the actual cost when under the limit`, async () => {
        wireQuotaServices()
        mockDb.services.quota!.incrementIfUnderLimit.mockResolvedValue({
          data: { compute: 1 },
        })
        mockDb.services.function.get.mockResolvedValue({ data: mockFunction })

        const mockExecute = FunctionExecutor.execute as ReturnType<typeof vi.fn>
        mockExecute.mockResolvedValue({
          success: true,
          output: { statusCode: 200, body: { ok: true } },
        })

        const dateSpy = vi.spyOn(Date, `now`)
        dateSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(16_000) // runtimeMs = 15_000

        try {
          await service.execute(mockReq as TRequest, mockRes as Response, faasEndpoint())
        } finally {
          dateSpy.mockRestore()
        }

        // Reserved 1 unit pre-execution; computeUnits(1, 15_000) = 1 + ceil(15_000/10_000) = 3.
        // True-up amount is the remainder: 3 - 1 = 2.
        expect(mockDb.services.quota!.increment).toHaveBeenCalledWith(
          `org-1`,
          expect.any(String),
          `compute`,
          2
        )
        expect(mockDb.services.quota!.decrement).not.toHaveBeenCalled()
      })

      it(`rolls back the reservation when the function execution fails`, async () => {
        wireQuotaServices()
        mockDb.services.quota!.incrementIfUnderLimit.mockResolvedValue({
          data: { compute: 1 },
        })
        mockDb.services.function.get.mockResolvedValue({ data: mockFunction })

        const mockExecute = FunctionExecutor.execute as ReturnType<typeof vi.fn>
        mockExecute.mockResolvedValue({
          success: false,
          output: null,
          error: `boom`,
        })

        await expect(
          service.execute(mockReq as TRequest, mockRes as Response, faasEndpoint())
        ).rejects.toThrow(`Function execution failed: boom`)

        expect(mockDb.services.quota!.decrement).toHaveBeenCalledWith(
          `org-1`,
          expect.any(String),
          `compute`,
          1
        )
        expect(mockDb.services.quota!.increment).not.toHaveBeenCalled()
      })

      it(`tracks but does not enforce compute usage for an unlimited-tier org`, async () => {
        wireQuotaServices()
        mockDb.services.subscription!.findByUser.mockResolvedValue({
          data: { tier: `team` },
        })
        mockDb.services.function.get.mockResolvedValue({ data: mockFunction })

        const mockExecute = FunctionExecutor.execute as ReturnType<typeof vi.fn>
        mockExecute.mockResolvedValue({
          success: true,
          output: { statusCode: 200, body: { ok: true } },
        })

        await service.execute(mockReq as TRequest, mockRes as Response, faasEndpoint())

        expect(mockDb.services.quota!.incrementIfUnderLimit).not.toHaveBeenCalled()
        expect(mockDb.services.quota!.increment).toHaveBeenCalled()
      })

      it(`fails closed (503) when the compute-quota check itself errors`, async () => {
        wireQuotaServices()
        mockDb.services.org!.get.mockResolvedValue({
          data: null,
          error: new Error(`db down`),
        })
        mockDb.services.function.get.mockResolvedValue({ data: mockFunction })

        await expect(
          service.execute(mockReq as TRequest, mockRes as Response, faasEndpoint())
        ).rejects.toThrow(`quota_check_unavailable`)

        expect(FunctionExecutor.execute).not.toHaveBeenCalled()
      })

      it(`skips enforcement entirely when the required db services aren't wired (existing behavior)`, async () => {
        // mockDb by default has no project/org/subscription/quota services.
        mockDb.services.function.get.mockResolvedValue({ data: mockFunction })

        const mockExecute = FunctionExecutor.execute as ReturnType<typeof vi.fn>
        mockExecute.mockResolvedValue({
          success: true,
          output: { statusCode: 200, body: { ok: true } },
        })

        await service.execute(mockReq as TRequest, mockRes as Response, faasEndpoint())

        expect(mockStatus).toHaveBeenCalledWith(200)
      })
    })
  })
})
