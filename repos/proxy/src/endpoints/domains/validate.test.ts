import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { validate } from './validate'

vi.mock('@TPX/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

const mockReq = (query: Record<string, unknown>, validateReturn?: unknown) => {
  const mockValidate = vi.fn()
  if (validateReturn instanceof Error) {
    mockValidate.mockRejectedValue(validateReturn)
  } else {
    mockValidate.mockResolvedValue(validateReturn)
  }

  return {
    query,
    app: {
      locals: {
        db: {
          services: {
            domain: { validate: mockValidate },
          },
        },
      },
    },
  } as unknown as Request
}

describe('GET /domains/validate', () => {
  it('should return 400 when domain query param is missing', async () => {
    const req = mockReq({})
    const res = mockRes()

    await validate(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Domain parameter is required' })
  })

  it('should return 403 when domain is not valid', async () => {
    const req = mockReq({ domain: 'unknown.com' }, null)
    const res = mockRes()

    await validate(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Domain not found or not verified' })
  })

  it('should return 200 for a valid domain', async () => {
    const req = mockReq({ domain: 'valid.com' }, { id: 'd1', domain: 'valid.com' })
    const res = mockRes()

    await validate(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ status: 'valid', domain: 'valid.com' })
  })

  it('should return 500 when the database throws', async () => {
    const req = mockReq({ domain: 'error.com' }, new Error('DB connection lost'))
    const res = mockRes()

    await validate(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
})
