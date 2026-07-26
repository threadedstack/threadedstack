import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { config } from '@TBE/configs/backend.config'
import { listOrgSandboxSessions } from './listOrgSandboxSessions'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock(`@TDB/configs/db.config`, () => ({
  config: { logger: { label: `db`, level: `error` } },
}))

describe(`GET /:orgId/sandboxes/sessions - List org sandbox sessions`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockListByOrg: ReturnType<typeof vi.fn>

  const buildApp = () => {
    mockListByOrg = vi.fn().mockResolvedValue({ data: [{ id: `sess-1` }] })

    return {
      locals: {
        config,
        db: {
          services: {
            sandboxSession: { listByOrg: mockListByOrg },
          },
        },
      },
    } as unknown as TApp
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: buildApp(),
      user: { id: `test-user-id`, email: `test@example.com` } as any,
      params: { orgId: `org-1` },
      query: {},
    }
  })

  it(`should have correct endpoint configuration`, () => {
    expect(listOrgSandboxSessions.path).toBe(`/sessions`)
    expect(listOrgSandboxSessions.method).toBe(`get`)
    expect(typeof listOrgSandboxSessions.action).toBe(`function`)
  })

  it(`should throw 400 when orgId parameter is missing`, async () => {
    mockReq.params = {}

    await expect(
      listOrgSandboxSessions.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`orgId parameter required`)

    expect(mockListByOrg).not.toHaveBeenCalled()
  })

  it(`should default the status filter to 'connected' when no status query param is passed`, async () => {
    await listOrgSandboxSessions.action(mockReq as TRequest, mockRes as Response)

    expect(mockListByOrg).toHaveBeenCalledWith(`org-1`, {
      limit: expect.any(Number),
      offset: expect.any(Number),
      where: { status: `connected` },
    })
  })

  it(`should use an explicit ?status= query param to override the default filter`, async () => {
    mockReq.query = { status: `crashed` }

    await listOrgSandboxSessions.action(mockReq as TRequest, mockRes as Response)

    expect(mockListByOrg).toHaveBeenCalledWith(`org-1`, {
      limit: expect.any(Number),
      offset: expect.any(Number),
      where: { status: `crashed` },
    })
  })

  it(`should pass pagination params through to listByOrg`, async () => {
    mockReq.query = { limit: `5`, offset: `10` }

    await listOrgSandboxSessions.action(mockReq as TRequest, mockRes as Response)

    expect(mockListByOrg).toHaveBeenCalledWith(`org-1`, {
      limit: 5,
      offset: 10,
      where: { status: `connected` },
    })
  })

  it(`should throw 500 when listByOrg errors`, async () => {
    mockListByOrg.mockResolvedValue({ error: new Error(`DB read failed`) })

    await expect(
      listOrgSandboxSessions.action(mockReq as TRequest, mockRes as Response)
    ).rejects.toThrow(`DB read failed`)
  })

  it(`should return 200 with the sessions data, defaulting to an empty array`, async () => {
    await listOrgSandboxSessions.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({
      data: [{ id: `sess-1` }],
      limit: expect.any(Number),
      offset: expect.any(Number),
    })
  })

  it(`should return an empty array when listByOrg resolves with no data`, async () => {
    mockListByOrg.mockResolvedValue({ data: undefined })

    await listOrgSandboxSessions.action(mockReq as TRequest, mockRes as Response)

    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ data: [] }))
  })
})
