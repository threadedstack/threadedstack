import type { AuthManager } from '@TRL/auth'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@TRL/constants', async () => {
  const actual = await vi.importActual('@TRL/constants')
  return {
    ...actual,
    MaxRetries: 3,
    RetryDelays: [0, 0, 0],
  }
})

const mockFetch = vi.fn()
vi.stubGlobal(`fetch`, mockFetch)

import { ApiClient } from './client'
import { Agent, Thread, Message, Organization } from '@tdsk/domain'

const makeCreds = () => ({
  apiKey: `tdsk_test123`,
  proxyUrl: `https://proxy.test`,
})

const makeAuth = (creds: ReturnType<typeof makeCreds> | null = makeCreds()) =>
  ({ getCredentials: vi.fn().mockReturnValue(creds) }) as unknown as AuthManager

describe(`ApiClient`, () => {
  let client: ApiClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new ApiClient(makeAuth())
  })

  describe(`authentication`, () => {
    it(`should throw when not logged in`, async () => {
      client = new ApiClient(makeAuth(null))
      await expect(client.listOrgs()).rejects.toThrow(`Not logged in`)
    })

    it(`should include Authorization header`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      })

      await client.listOrgs()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer tdsk_test123`,
          }),
        })
      )
    })
  })

  describe(`error handling`, () => {
    it(`should throw on non-2xx response`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: `Forbidden`,
        text: async () => `Access denied`,
      })

      await expect(client.listOrgs()).rejects.toThrow(`API error (403)`)
    })

    it(`should handle empty error body`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: `Internal Server Error`,
        text: async () => ``,
      })

      await expect(client.listOrgs()).rejects.toThrow(
        `API error (500): Internal Server Error`
      )
    })
  })

  describe(`listOrgs`, () => {
    it(`should call GET /_/orgs`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: `org1` }] }),
      })

      const result = await client.listOrgs()

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs`,
        expect.any(Object)
      )
      expect(result).toEqual([{ id: `org1` }])
    })
  })

  describe(`getOrg`, () => {
    it(`should call GET /_/orgs/:orgId`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: `org1`, name: `Test` } }),
      })

      const result = await client.getOrg(`org1`)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1`,
        expect.any(Object)
      )
      expect(result).toEqual({ id: `org1`, name: `Test` })
    })
  })

  describe(`listAgents`, () => {
    it(`should call GET /_/orgs/:orgId/agents`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: `agent1` }] }),
      })

      const result = await client.listAgents(`org1`)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents`,
        expect.any(Object)
      )
      expect(result[0].id).toEqual(`agent1`)
    })
  })

  describe(`getAgent`, () => {
    it(`should call GET /_/orgs/:orgId/agents/:id`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: new Agent({ id: `agent1`, name: `Bot` }) }),
      })

      const result = await client.getAgent(`org1`, `agent1`)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1`,
        expect.any(Object)
      )
      expect(result.id).toEqual(`agent1`)
      expect(result.name).toEqual(`Bot`)
    })
  })

  describe(`createSession`, () => {
    it(`should POST to /_/ai/sessions`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            sessionToken: `sess-abc`,
            provider: `anthropic`,
            model: `claude-sonnet-4-20250514`,
            maxTokens: 4096,
          },
        }),
      })

      const result = await client.createSession(`agent1`)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/ai/sessions`,
        expect.objectContaining({
          method: `POST`,
          headers: expect.objectContaining({
            'Content-Type': `application/json`,
          }),
          body: JSON.stringify({ agentId: `agent1` }),
        })
      )
      expect(result).toEqual({
        sessionToken: `sess-abc`,
        provider: `anthropic`,
        model: `claude-sonnet-4-20250514`,
        maxTokens: 4096,
      })
    })
  })

  describe(`proxyUrl`, () => {
    it(`should return the proxy URL from credentials`, () => {
      expect(client.proxyUrl).toBe(`https://proxy.test`)
    })

    it(`should throw when not logged in`, () => {
      client = new ApiClient(makeAuth(null))
      expect(() => client.proxyUrl).toThrow(`Not logged in`)
    })
  })

  describe(`listThreads`, () => {
    it(`should call GET /_/orgs/:orgId/agents/:agentId/threads`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: `t1` }] }),
      })

      const result = await client.listThreads(`org1`, `agent1`)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1/threads`,
        expect.any(Object)
      )
      expect(result[0].id).toEqual(`t1`)
    })
  })

  describe(`getThread`, () => {
    it(`should call GET /_/orgs/:orgId/agents/:agentId/threads/:id`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: `t1`, name: `Chat` } }),
      })

      const result = await client.getThread(`org1`, `agent1`, `t1`)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1/threads/t1`,
        expect.any(Object)
      )
      expect(result.id).toEqual(`t1`)
      expect(result.name).toEqual(`Chat`)
    })
  })

  describe(`createThread`, () => {
    it(`should POST to /_/orgs/:orgId/agents/:agentId/threads`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: `t-new`, name: `REPL session` } }),
      })

      const result = await client.createThread(`org1`, `agent1`)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1/threads`,
        expect.objectContaining({
          method: `POST`,
          body: JSON.stringify({ name: `REPL session` }),
        })
      )
      expect(result.id).toEqual(`t-new`)
      expect(result.name).toEqual(`REPL session`)
    })

    it(`should use custom name when provided`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: `t-new`, name: `My Chat` } }),
      })

      await client.createThread(`org1`, `agent1`, `My Chat`)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ name: `My Chat` }),
        })
      )
    })
  })

  describe(`listMessages`, () => {
    it(`should call GET with full thread path`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: `m1`, content: `Hi` }] }),
      })

      const result = await client.listMessages(`org1`, `agent1`, `t1`)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1/threads/t1/messages`,
        expect.any(Object)
      )
      expect(result).toEqual([{ id: `m1`, content: `Hi` }])
    })
  })

  describe(`createMessage`, () => {
    it(`should POST to messages endpoint`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: `m-new` } }),
      })

      const result = await client.createMessage(`org1`, `agent1`, `t1`, {
        type: `user`,
        content: [{ type: `text`, text: `Hello` }],
        orgId: `org1`,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1/threads/t1/messages`,
        expect.objectContaining({
          method: `POST`,
          body: JSON.stringify({
            type: `user`,
            content: [{ type: `text`, text: `Hello` }],
            orgId: `org1`,
          }),
        })
      )
      expect(result).toEqual({ id: `m-new` })
    })

    it(`should throw when not logged in`, async () => {
      client = new ApiClient(makeAuth(null))
      await expect(
        client.createMessage(`org1`, `agent1`, `t1`, {
          type: `user`,
          content: [],
          orgId: `org1`,
        })
      ).rejects.toThrow(`Not logged in`)
    })
  })

  describe(`retry logic`, () => {
    it(`retries on network error up to 3 times`, async () => {
      const networkError = Object.assign(new Error(`connect failed`), {
        code: `ECONNREFUSED`,
      })
      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({
          ok: true,
          json: async () => ({ data: [] }),
        })

      const result = await client.listOrgs()

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result).toEqual([])
    })

    it(`retries on 429 with backoff`, async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: `Too Many Requests`,
          text: async () => `Rate limited`,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ data: [] }),
        })

      const result = await client.listOrgs()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual([])
    })

    it(`does not retry on 4xx errors (except 429)`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: `Bad Request`,
        text: async () => `Invalid`,
      })

      await expect(client.listOrgs()).rejects.toThrow(`API error (400)`)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it(`retries on 500 errors`, async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: `Internal Server Error`,
          text: async () => `Server error`,
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ data: [] }),
        })

      const result = await client.listOrgs()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual([])
    })

    it(`throws after max retries exhausted`, async () => {
      const networkError = Object.assign(new Error(`connect failed`), {
        code: `ECONNREFUSED`,
      })
      mockFetch.mockRejectedValue(networkError)

      await expect(client.listOrgs()).rejects.toThrow(`connect failed`)
      expect(mockFetch).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
    })
  })

  describe(`listProviders`, () => {
    it(`lists available providers for an agent`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: `p1`,
              name: `Anthropic`,
              model: `claude-sonnet`,
              provider: `anthropic`,
            },
            { id: `p2`, name: `OpenAI`, model: `gpt-4o`, provider: `openai` },
          ],
        }),
      })

      const result = await client.listProviders(`org1`)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/providers`,
        expect.any(Object)
      )
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe(`Anthropic`)
    })
  })

  describe(`createSession with providerId`, () => {
    it(`should POST with providerId when specified`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            sessionToken: `sess-abc`,
            provider: `openai`,
            model: `gpt-4o`,
            maxTokens: 4096,
          },
        }),
      })

      await client.createSession(`agent1`, `provider-123`)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/ai/sessions`,
        expect.objectContaining({
          method: `POST`,
          body: JSON.stringify({ agentId: `agent1`, providerId: `provider-123` }),
        })
      )
    })

    it(`should POST without providerId when not specified`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            sessionToken: `sess-abc`,
            provider: `anthropic`,
            model: `claude-sonnet-4-20250514`,
            maxTokens: 4096,
          },
        }),
      })

      await client.createSession(`agent1`)

      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/ai/sessions`,
        expect.objectContaining({
          method: `POST`,
          body: JSON.stringify({ agentId: `agent1` }),
        })
      )
    })
  })
})
