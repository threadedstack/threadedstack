import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { health } from './health'

describe('Health Endpoint', () => {
  it('should return 200 with status ok', () => {
    const mockReq = {} as Request
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response

    health(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        service: 'auth-proxy',
        timestamp: expect.any(String),
      })
    )
  })
})
