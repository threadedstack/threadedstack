import type { TRequest, TResponse } from '@TBE/types'
import type { NextFunction } from 'express'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiKey, hashKey, ApiKeyPrefix } from '@tdsk/domain'

import { residentAuth } from './residentAuth'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { logger } from '@TBE/utils/logger'

const AgentId = `ag_agent001`
const OtherAgentId = `ag_other001`

const ResidentToken = `${ApiKeyPrefix}resident-secret-1`

const buildResidentKey = (overrides: Partial<ApiKey> = {}) =>
  new ApiKey({
    id: `ak_res00001`,
    name: `resident:${AgentId}`,
    active: true,
    keyHash: hashKey(ResidentToken),
    keyPrefix: ResidentToken.slice(0, 12),
    residentAgentId: AgentId,
    ...overrides,
  })

describe(`residentAuth middleware`, () => {
  let mockNext: ReturnType<typeof vi.fn>
  let mockRes: Partial<TResponse>
  let mockGetByHash: ReturnType<typeof vi.fn>
  let mockTouchLastUsed: ReturnType<typeof vi.fn>

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      headers: { authorization: `Bearer ${ResidentToken}` },
      params: { agentId: AgentId },
      app: {
        locals: {
          db: {
            services: {
              apiKey: {
                getByHash: mockGetByHash,
                touchLastUsed: mockTouchLastUsed,
              },
            },
          },
        },
      },
      ...overrides,
    } as unknown as TRequest
  }

  beforeEach(() => {
    mockNext = vi.fn()
    mockRes = {} as Partial<TResponse>
    mockGetByHash = vi.fn().mockResolvedValue({ data: buildResidentKey() })
    mockTouchLastUsed = vi.fn().mockResolvedValue({ data: true })
    vi.clearAllMocks()
    mockGetByHash.mockResolvedValue({ data: buildResidentKey() })
    mockTouchLastUsed.mockResolvedValue({ data: true })
  })

  it(`calls next() and touches lastUsedAt for a valid resident key bound to the URL agent`, async () => {
    const req = buildMockReq()
    await residentAuth(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith()
    expect(mockGetByHash).toHaveBeenCalledWith(hashKey(ResidentToken))
    expect(mockTouchLastUsed).toHaveBeenCalledWith(`ak_res00001`)
  })

  it(`rejects with 401 when no Authorization header is present`, async () => {
    const req = buildMockReq({ headers: {} })
    await residentAuth(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    const error = mockNext.mock.calls[0][0]
    expect(error.status).toBe(401)
    expect(mockGetByHash).not.toHaveBeenCalled()
  })

  it(`rejects with 401 for a malformed Authorization header (not "Bearer <token>")`, async () => {
    const req = buildMockReq({ headers: { authorization: ResidentToken } })
    await residentAuth(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    expect(mockNext.mock.calls[0][0].status).toBe(401)
    expect(mockGetByHash).not.toHaveBeenCalled()
  })

  it(`rejects with 401 for a token that is not a tdsk_* key`, async () => {
    const req = buildMockReq({ headers: { authorization: `Bearer not-a-tdsk-key` } })
    await residentAuth(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    expect(mockNext.mock.calls[0][0].status).toBe(401)
    expect(mockGetByHash).not.toHaveBeenCalled()
  })

  it(`rejects with 401 when the db lookup errors`, async () => {
    mockGetByHash.mockResolvedValue({ error: new Error(`db down`) })
    const req = buildMockReq()
    await residentAuth(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    expect(mockNext.mock.calls[0][0].status).toBe(401)
    expect(mockNext.mock.calls[0][0].message).toBe(`Invalid API key`)
  })

  it(`rejects with 401 when no key matches the hash`, async () => {
    mockGetByHash.mockResolvedValue({ data: undefined })
    const req = buildMockReq()
    await residentAuth(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    expect(mockNext.mock.calls[0][0].status).toBe(401)
    expect(mockNext.mock.calls[0][0].message).toBe(`Invalid API key`)
  })

  it(`rejects with 401 "API key revoked" when the key is inactive`, async () => {
    mockGetByHash.mockResolvedValue({ data: buildResidentKey({ active: false }) })
    const req = buildMockReq()
    await residentAuth(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    const error = mockNext.mock.calls[0][0]
    expect(error.status).toBe(401)
    expect(error.message).toBe(`API key revoked`)
  })

  it(`rejects with 401 "API key expired" when the key is past its expiresAt`, async () => {
    mockGetByHash.mockResolvedValue({
      data: buildResidentKey({ active: true, expiresAt: new Date(Date.now() - 1000) }),
    })
    const req = buildMockReq()
    await residentAuth(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    const error = mockNext.mock.calls[0][0]
    expect(error.status).toBe(401)
    expect(error.message).toBe(`API key expired`)
  })

  it(`rejects with 403 "Not a resident API key" when the key has no residentAgentId`, async () => {
    mockGetByHash.mockResolvedValue({
      data: buildResidentKey({ residentAgentId: undefined }),
    })
    const req = buildMockReq()
    await residentAuth(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    const error = mockNext.mock.calls[0][0]
    expect(error.status).toBe(403)
    expect(error.message).toBe(`Not a resident API key`)
  })

  it(`rejects with 403 when the resident key is bound to a different agent than the URL`, async () => {
    mockGetByHash.mockResolvedValue({
      data: buildResidentKey({ residentAgentId: OtherAgentId }),
    })
    const req = buildMockReq({ params: { agentId: AgentId } })
    await residentAuth(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    const error = mockNext.mock.calls[0][0]
    expect(error.status).toBe(403)
    expect(error.message).toBe(`Resident key is not bound to this agent`)
    expect(mockTouchLastUsed).not.toHaveBeenCalled()
  })

  it(`still calls next() when touchLastUsed rejects, but logs the error`, async () => {
    mockTouchLastUsed.mockRejectedValue(new Error(`write failed`))
    const req = buildMockReq()
    await residentAuth(req, mockRes as TResponse, mockNext as NextFunction)

    expect(mockNext).toHaveBeenCalledWith()
    // Flush the fire-and-forget touchLastUsed rejection handler.
    await new Promise((resolve) => setImmediate(resolve))
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to update resident key lastUsedAt: write failed`)
    )
  })
})
