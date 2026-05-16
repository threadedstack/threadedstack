import { describe, it, expect, vi } from 'vitest'
import { fromAuthHeaders, setAuthHeaders } from './authHeaders'

describe(`fromAuthHeaders`, () => {
  it(`should extract headers from request`, () => {
    const req = {
      header: vi.fn((key: string) => {
        const map: Record<string, string> = {
          'X-User-Id': `user-123`,
          'X-User-Email': `test@test.com`,
        }
        return map[key]
      }),
    }

    const result = fromAuthHeaders(req)
    expect(result.userId).toBe(`user-123`)
    expect(result.email).toBe(`test@test.com`)
  })

  it(`should return partial when headers are missing`, () => {
    const req = {
      header: vi.fn(() => undefined),
    }

    const result = fromAuthHeaders(req)
    expect(result.userId).toBeUndefined()
    expect(result.email).toBeUndefined()
  })
})

describe(`setAuthHeaders`, () => {
  it(`should set headers on proxy request`, () => {
    const pxReq = { setHeader: vi.fn(), removeHeader: vi.fn() }
    const req = {
      user: {
        userId: `user-123`,
        email: `test@test.com`,
      },
    }

    setAuthHeaders(pxReq, req)
    expect(pxReq.setHeader).toHaveBeenCalledWith(`X-User-Id`, `user-123`)
    expect(pxReq.setHeader).toHaveBeenCalledWith(`X-User-Email`, `test@test.com`)
  })

  it(`should skip undefined values`, () => {
    const pxReq = { setHeader: vi.fn(), removeHeader: vi.fn() }
    const req = {
      user: {
        userId: `user-123`,
      },
    }

    setAuthHeaders(pxReq, req)
    expect(pxReq.setHeader).toHaveBeenCalledWith(`X-User-Id`, `user-123`)
    const calls = pxReq.setHeader.mock.calls
    const calledKeys = calls.map((c: string[]) => c[0])
    expect(calledKeys).not.toContain(`X-User-Email`)
  })

  it(`should strip all auth headers before setting new ones`, () => {
    const pxReq = { setHeader: vi.fn(), removeHeader: vi.fn() }
    const req = {
      user: {
        userId: `user-123`,
      },
    }

    setAuthHeaders(pxReq, req)

    const removedKeys = pxReq.removeHeader.mock.calls.map((c: string[]) => c[0])
    expect(removedKeys).toContain(`X-User-Id`)
    expect(removedKeys).toContain(`X-User-Email`)
    expect(removedKeys).toContain(`X-User-Org-Id`)
    expect(removedKeys).toContain(`X-Api-Key-Role`)
  })
})
