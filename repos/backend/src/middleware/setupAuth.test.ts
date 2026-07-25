import type { NextFunction, Router } from 'express'
import type { TRequest, TResponse, TApp } from '@TBE/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authenticate, setupAuth } from './setupAuth'
import { shouldIgnore } from '@TBE/utils/auth/shouldIgnore'
import { authenticateRequest } from '@TBE/utils/auth/authenticateRequest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock(`@TBE/utils/auth/shouldIgnore`, () => ({
  shouldIgnore: vi.fn(),
}))

vi.mock(`@TBE/utils/auth/authenticateRequest`, () => ({
  authenticateRequest: vi.fn(),
}))

describe(`authenticate`, () => {
  let mockNext: ReturnType<typeof vi.fn>
  let mockRes: TResponse
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  const mockReq = {} as TRequest

  beforeEach(() => {
    vi.clearAllMocks()
    mockJson = vi.fn()
    mockStatus = vi.fn(() => ({ json: mockJson }) as any)
    mockRes = { status: mockStatus, json: mockJson } as unknown as TResponse
    mockNext = vi.fn()
  })

  it(`calls next() and skips authenticateRequest when shouldIgnore is true`, async () => {
    vi.mocked(shouldIgnore).mockReturnValue(true)

    await authenticate(mockReq, mockRes, mockNext as NextFunction)

    expect(authenticateRequest).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalledOnce()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`calls next() when shouldIgnore is false and authenticateRequest resolves`, async () => {
    vi.mocked(shouldIgnore).mockReturnValue(false)
    vi.mocked(authenticateRequest).mockResolvedValue(undefined as any)

    await authenticate(mockReq, mockRes, mockNext as NextFunction)

    expect(authenticateRequest).toHaveBeenCalledWith(mockReq, mockRes)
    expect(mockNext).toHaveBeenCalledOnce()
    expect(mockStatus).not.toHaveBeenCalled()
  })

  it(`responds with the thrown error's status and message when authenticateRequest rejects with a status-bearing Error`, async () => {
    vi.mocked(shouldIgnore).mockReturnValue(false)
    const err = Object.assign(new Error(`Forbidden`), { status: 403 })
    vi.mocked(authenticateRequest).mockRejectedValue(err)

    await authenticate(mockReq, mockRes, mockNext as NextFunction)

    expect(mockStatus).toHaveBeenCalledWith(403)
    expect(mockJson).toHaveBeenCalledWith({ error: `Forbidden` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`responds 401 with the Error's message when authenticateRequest rejects with a plain Error with no status`, async () => {
    vi.mocked(shouldIgnore).mockReturnValue(false)
    vi.mocked(authenticateRequest).mockRejectedValue(new Error(`Invalid token`))

    await authenticate(mockReq, mockRes, mockNext as NextFunction)

    expect(mockStatus).toHaveBeenCalledWith(401)
    expect(mockJson).toHaveBeenCalledWith({ error: `Invalid token` })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`responds 401 with the literal 'Authentication failed' when authenticateRequest rejects with a non-Error throw`, async () => {
    vi.mocked(shouldIgnore).mockReturnValue(false)
    vi.mocked(authenticateRequest).mockRejectedValue(`some string error`)

    await authenticate(mockReq, mockRes, mockNext as NextFunction)

    expect(mockStatus).toHaveBeenCalledWith(401)
    expect(mockJson).toHaveBeenCalledWith({ error: `Authentication failed` })
    expect(mockNext).not.toHaveBeenCalled()
  })
})

describe(`setupAuth`, () => {
  it(`registers the authenticate middleware on the router`, async () => {
    const mockUse = vi.fn()
    const mockRouter = { use: mockUse } as unknown as Router
    const mockApp = {} as TApp

    await setupAuth(mockApp, mockRouter)

    expect(mockUse).toHaveBeenCalledWith(authenticate)
  })
})
