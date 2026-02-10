import { describe, it, expect, vi } from 'vitest'
import { fromAuthHeaders, setAuthHeaders } from './authHeaders'

describe(`fromAuthHeaders`, () => {
  it(`should extract headers from request`, () => {
    const req = {
      header: vi.fn((key: string) => {
        const map: Record<string, string> = {
          'X-User-Id': `user-123`,
          'X-User-Email': `test@test.com`,
          'X-User-Role': `admin`,
          'X-Org-Id': `org-456`,
        }
        return map[key]
      }),
    }

    const result = fromAuthHeaders(req)
    expect(result.userId).toBe(`user-123`)
    expect(result.email).toBe(`test@test.com`)
    expect(result.role).toBe(`admin`)
    expect(result.orgId).toBe(`org-456`)
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
    const pxReq = { setHeader: vi.fn() }
    const req = {
      user: {
        userId: `user-123`,
        email: `test@test.com`,
        role: `admin`,
        orgId: `org-456`,
      },
    }

    setAuthHeaders(pxReq, req)
    expect(pxReq.setHeader).toHaveBeenCalledWith(`X-User-Id`, `user-123`)
    expect(pxReq.setHeader).toHaveBeenCalledWith(`X-User-Email`, `test@test.com`)
    expect(pxReq.setHeader).toHaveBeenCalledWith(`X-User-Role`, `admin`)
    expect(pxReq.setHeader).toHaveBeenCalledWith(`X-Org-Id`, `org-456`)
  })

  it(`should skip undefined values`, () => {
    const pxReq = { setHeader: vi.fn() }
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
    expect(calledKeys).not.toContain(`X-User-Role`)
    expect(calledKeys).not.toContain(`X-Org-Id`)
  })
})
