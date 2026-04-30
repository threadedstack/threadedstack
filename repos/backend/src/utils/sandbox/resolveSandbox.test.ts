import type { TDatabase } from '@tdsk/database'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Exception } from '@tdsk/domain'
import { resolveSandbox } from './resolveSandbox'

type TSandboxService = TDatabase[`services`][`sandbox`]

const mockSandbox = {
  id: `sb_abc1234`,
  name: `test-sandbox`,
  orgId: `org_1`,
  projectId: `proj_123`,
} as any

const buildService = () =>
  ({
    get: vi.fn(),
    getByProjectAlias: vi.fn(),
  }) as unknown as TSandboxService & {
    get: ReturnType<typeof vi.fn>
    getByProjectAlias: ReturnType<typeof vi.fn>
  }

describe(`resolveSandbox`, () => {
  let service: ReturnType<typeof buildService>

  beforeEach(() => {
    service = buildService()
  })

  describe(`ID path (sb_ prefix)`, () => {
    it(`returns sandbox when found by ID`, async () => {
      service.get.mockResolvedValue({ data: mockSandbox })
      const result = await resolveSandbox(service, `sb_abc1234`)
      expect(service.get).toHaveBeenCalledWith(`sb_abc1234`)
      expect(service.getByProjectAlias).not.toHaveBeenCalled()
      expect(result).toBe(mockSandbox)
    })

    it(`throws 404 when error message contains 'not found'`, async () => {
      service.get.mockResolvedValue({ error: { message: `Sandbox not found` } })
      await expect(resolveSandbox(service, `sb_abc1234`)).rejects.toThrow(Exception)
      try {
        await resolveSandbox(service, `sb_abc1234`)
      } catch (err) {
        expect((err as Exception).status).toBe(404)
      }
    })

    it(`throws 500 when error message does not contain 'not found'`, async () => {
      service.get.mockResolvedValue({ error: { message: `connection refused` } })
      await expect(resolveSandbox(service, `sb_abc1234`)).rejects.toThrow(Exception)
      try {
        await resolveSandbox(service, `sb_abc1234`)
      } catch (err) {
        expect((err as Exception).status).toBe(500)
        expect((err as Exception).message).toBe(`connection refused`)
      }
    })

    it(`throws 404 when data is null and no error`, async () => {
      service.get.mockResolvedValue({ data: null })
      await expect(resolveSandbox(service, `sb_abc1234`)).rejects.toThrow(Exception)
      try {
        await resolveSandbox(service, `sb_abc1234`)
      } catch (err) {
        expect((err as Exception).status).toBe(404)
      }
    })
  })

  describe(`Alias path (no sb_ prefix)`, () => {
    it(`returns sandbox when found by alias`, async () => {
      service.getByProjectAlias.mockResolvedValue({ data: mockSandbox })
      const result = await resolveSandbox(service, `my-alias`, `proj_123`)
      expect(service.getByProjectAlias).toHaveBeenCalledWith(`proj_123`, `my-alias`)
      expect(service.get).not.toHaveBeenCalled()
      expect(result).toBe(mockSandbox)
    })

    it(`throws 400 when projectId is not provided`, async () => {
      await expect(resolveSandbox(service, `my-alias`)).rejects.toThrow(Exception)
      try {
        await resolveSandbox(service, `my-alias`)
      } catch (err) {
        expect((err as Exception).status).toBe(400)
        expect((err as Exception).message).toContain(`projectId is required`)
      }
    })

    it(`throws 404 when error message contains 'not found'`, async () => {
      service.getByProjectAlias.mockResolvedValue({
        error: { message: `Sandbox not found` },
      })
      await expect(resolveSandbox(service, `my-alias`, `proj_123`)).rejects.toThrow(
        Exception
      )
      try {
        await resolveSandbox(service, `my-alias`, `proj_123`)
      } catch (err) {
        expect((err as Exception).status).toBe(404)
      }
    })

    it(`throws 500 when error message does not contain 'not found'`, async () => {
      service.getByProjectAlias.mockResolvedValue({
        error: { message: `database timeout` },
      })
      await expect(resolveSandbox(service, `my-alias`, `proj_123`)).rejects.toThrow(
        Exception
      )
      try {
        await resolveSandbox(service, `my-alias`, `proj_123`)
      } catch (err) {
        expect((err as Exception).status).toBe(500)
        expect((err as Exception).message).toBe(`database timeout`)
      }
    })
  })
})
