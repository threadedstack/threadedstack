import type { Response } from 'express'
import type { TDatabase } from '@tdsk/database'

import { EEndpointType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentEndpoint } from '@TBE/services/endpoints/agentEndpoint'

// Mock logger
vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// Mock checkPermission
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn().mockResolvedValue(undefined),
}))

describe(`AgentEndpoint`, () => {
  let service: AgentEndpoint

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AgentEndpoint({} as TDatabase)
    service.run = vi.fn().mockResolvedValue(undefined)
  })

  describe(`type`, () => {
    it(`should be agent`, () => {
      expect(service.type).toBe(EEndpointType.agent)
    })
  })

  describe(`validateOptions`, () => {
    it(`should pass when agentId is present`, () => {
      expect(() => service.validateOptions({ agentId: `agent-123` })).not.toThrow()
    })

    it(`should throw when agentId is missing`, () => {
      expect(() => service.validateOptions({})).toThrow(
        `Agent endpoint requires an agentId in options`
      )
    })

    it(`should throw when options is undefined`, () => {
      expect(() => service.validateOptions(undefined as any)).toThrow(
        `Agent endpoint requires an agentId in options`
      )
    })

    it(`should throw when options is null`, () => {
      expect(() => service.validateOptions(null as any)).toThrow(
        `Agent endpoint requires an agentId in options`
      )
    })

    it(`should pass when agentId is present with overrides`, () => {
      expect(() =>
        service.validateOptions({
          agentId: `agent-123`,
          overrides: { model: `gpt-4`, maxTokens: 1000 },
        })
      ).not.toThrow()
    })
  })

  describe(`execute`, () => {
    it(`should call executeAgent with correct parameters`, async () => {
      const mockReq = {
        user: { id: `user-1` },
        body: { prompt: `Hello`, threadId: `thread-1` },
      } as any
      const mockRes = {} as Response
      const mockEndpoint = {
        type: EEndpointType.agent,
        projectId: `project-1`,
        options: {
          agentId: `agent-123`,
          overrides: { model: `gpt-4` },
        },
      } as any
      await service.execute(mockReq, mockRes, mockEndpoint)

      expect(service.run).toHaveBeenCalledWith(mockReq, mockRes, {
        agentId: `agent-123`,
        prompt: `Hello`,
        userId: `user-1`,
        threadId: `thread-1`,
        overrides: { model: `gpt-4` },
      })
    })

    it(`should throw 401 when user is not authenticated`, async () => {
      const mockReq = {
        user: undefined,
        body: { prompt: `Hello` },
      } as any
      const mockRes = {} as Response
      const mockEndpoint = {
        type: EEndpointType.agent,
        projectId: `project-1`,
        options: { agentId: `agent-123` },
      } as any

      await expect(service.execute(mockReq, mockRes, mockEndpoint)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should throw 400 when prompt is missing`, async () => {
      const mockReq = {
        user: { id: `user-1` },
        body: {},
      } as any
      const mockRes = {} as Response
      const mockEndpoint = {
        type: EEndpointType.agent,
        projectId: `project-1`,
        options: { agentId: `agent-123` },
      } as any

      await expect(service.execute(mockReq, mockRes, mockEndpoint)).rejects.toThrow(
        `prompt is required`
      )
    })

    it(`should throw 400 when endpoint has no agentId`, async () => {
      const mockReq = {
        user: { id: `user-1` },
        body: { prompt: `Hello` },
      } as any
      const mockRes = {} as Response
      const mockEndpoint = {
        type: EEndpointType.agent,
        projectId: `project-1`,
        options: {},
      } as any

      await expect(service.execute(mockReq, mockRes, mockEndpoint)).rejects.toThrow(
        `Agent endpoint has no agentId configured`
      )
    })

    it(`should work without overrides`, async () => {
      const mockReq = {
        user: { id: `user-1` },
        body: { prompt: `Hello` },
      } as any
      const mockRes = {} as Response
      const mockEndpoint = {
        type: EEndpointType.agent,
        projectId: `project-1`,
        options: { agentId: `agent-123` },
      } as any

      await service.execute(mockReq, mockRes, mockEndpoint)

      expect(service.run).toHaveBeenCalledWith(mockReq, mockRes, {
        agentId: `agent-123`,
        prompt: `Hello`,
        userId: `user-1`,
        threadId: undefined,
        overrides: undefined,
      })
    })
  })
})
