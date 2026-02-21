import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { echo } from './echo'

describe('Echo Endpoint', () => {
  const createMockRes = () =>
    ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }) as unknown as Response

  it('should return 200 with request details', () => {
    const mockReq = {
      method: 'POST',
      path: '/echo',
      headers: { 'x-test': 'value' },
      body: { key: 'data' },
      query: {},
    } as unknown as Request

    const mockRes = createMockRes()
    echo(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith({
      method: 'POST',
      path: '/echo',
      headers: { 'x-test': 'value' },
      body: { key: 'data' },
      query: {},
    })
  })

  it('should reflect the HTTP method', () => {
    const mockReq = {
      method: 'PUT',
      path: '/echo',
      headers: {},
      body: undefined,
      query: {},
    } as unknown as Request

    const mockRes = createMockRes()
    echo(mockReq, mockRes)

    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT' }))
  })

  it('should echo query parameters', () => {
    const mockReq = {
      method: 'GET',
      path: '/echo',
      headers: {},
      body: undefined,
      query: { search: 'test', limit: '10' },
    } as unknown as Request

    const mockRes = createMockRes()
    echo(mockReq, mockRes)

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { search: 'test', limit: '10' },
      })
    )
  })

  it('should echo all incoming headers', () => {
    const mockReq = {
      method: 'GET',
      path: '/echo',
      headers: {
        authorization: 'Bearer sk-test-123',
        'x-custom-header': 'custom-value',
        'content-type': 'application/json',
      },
      body: undefined,
      query: {},
    } as unknown as Request

    const mockRes = createMockRes()
    echo(mockReq, mockRes)

    const call = (mockRes.json as any).mock.calls[0][0]
    expect(call.headers.authorization).toBe('Bearer sk-test-123')
    expect(call.headers['x-custom-header']).toBe('custom-value')
  })

  it('should handle empty body gracefully', () => {
    const mockReq = {
      method: 'GET',
      path: '/echo',
      headers: {},
      body: undefined,
      query: {},
    } as unknown as Request

    const mockRes = createMockRes()
    echo(mockReq, mockRes)

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ body: undefined })
    )
  })
})
