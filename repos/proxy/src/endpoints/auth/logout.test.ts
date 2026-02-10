import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { logout } from './logout'

vi.mock('@TPX/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

describe('POST /auth/logout', () => {
  it('should return success message on logout', async () => {
    const req = {
      user: { userId: 'u1' },
    } as unknown as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response

    await logout(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      data: { message: 'Logged out successfully' },
    })
  })
})
