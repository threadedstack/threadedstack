import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { me } from './me'

vi.mock(`@TPX/utils/logger`, () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

describe(`GET /auth/me`, () => {
  it(`should return user data when req.user is present`, async () => {
    const req = {
      user: { userId: `u1`, role: `admin`, email: `a@b.com` },
    } as unknown as Request
    const res = mockRes()

    await me(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      data: {
        user: { id: `u1`, role: `admin`, email: `a@b.com` },
      },
    })
  })

  it(`should return 401 when req.user is undefined`, async () => {
    const req = {} as Request
    const res = mockRes()

    await me(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: `Not authenticated` })
  })
})
