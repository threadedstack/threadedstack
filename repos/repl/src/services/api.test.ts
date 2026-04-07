import type { AuthManager } from '@TRL/services/auth'

import { ApiClient } from './api'
import { Agent } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TRL/constants`, async () => {
  const actual = await vi.importActual(`@TRL/constants`)
  return {
    ...actual,
    MaxRetries: 3,
    RetryDelays: [0, 0, 0],
  }
})

const mockFetch = vi.fn()
vi.stubGlobal(`fetch`, mockFetch)

const makeCreds = () => ({
  apiKey: `tdsk_test123`,
  proxyUrl: `https://proxy.test`,
})

const makeAuth = (creds: ReturnType<typeof makeCreds> | null = makeCreds()) =>
  ({ creds: vi.fn().mockReturnValue(creds) }) as unknown as AuthManager

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
        status: 200,
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
    it(`should return ok:false on non-2xx response`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: `Forbidden`,
        text: async () => `Access denied`,
      })

      const result = await client.listOrgs()

      expect(result.ok).toBe(false)
      expect(result.status).toBe(403)
      expect(result.error).toBeDefined()
    })

    it(`should return ok:false with error on 500`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: `Internal Server Error`,
        text: async () => ``,
      })

      // 500 is retryable — mock all retries to fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: `Internal Server Error`,
        text: async () => `Server Error`,
      })

      const result = await client.listOrgs()
      expect(result.ok).toBe(false)
      expect(result.status).toBe(500)
    })
  })

  describe(`listOrgs`, () => {
    it(`should call GET /_/orgs`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: `org1` }] }),
      })

      const { data, ok } = await client.listOrgs()

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs`,
        expect.any(Object)
      )
      expect(data?.[0]).toMatchObject({ id: `org1` })
    })

    it(`should return Organization instances`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: `org1`, name: `Test Org` }] }),
      })

      const { data } = await client.listOrgs()
      expect(data).toHaveLength(1)
      expect(data?.[0].id).toBe(`org1`)
    })
  })

  describe(`getOrg`, () => {
    it(`should call GET /_/orgs/:orgId`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: `org1`, name: `Test` } }),
      })

      const { data, ok } = await client.getOrg(`org1`)

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1`,
        expect.any(Object)
      )
      expect(data?.id).toBe(`org1`)
      expect(data?.name).toBe(`Test`)
    })
  })

  describe(`listAgents`, () => {
    it(`should call GET /_/orgs/:orgId/agents`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: `agent1` }] }),
      })

      const { data, ok } = await client.listAgents(`org1`)

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents`,
        expect.any(Object)
      )
      expect(data?.[0]).toBeInstanceOf(Agent)
      expect(data?.[0].id).toEqual(`agent1`)
    })
  })

  describe(`getAgent`, () => {
    it(`should call GET /_/orgs/:orgId/agents/:id`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: `agent1`, name: `Bot` } }),
      })

      const { data, ok } = await client.getAgent(`org1`, `agent1`)

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1`,
        expect.any(Object)
      )
      expect(data?.id).toEqual(`agent1`)
      expect(data?.name).toEqual(`Bot`)
    })
  })

  describe(`createSession`, () => {
    it(`should POST to /_/ai/sessions`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            sessionToken: `sess-abc`,
            provider: `anthropic`,
            model: `claude-sonnet-4-20250514`,
            maxTokens: 4096,
          },
        }),
      })

      const { data, ok } = await client.createSession(`agent1`)

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/ai/sessions`,
        expect.objectContaining({
          method: `POST`,
          headers: expect.objectContaining({
            [`Content-Type`]: `application/json`,
          }),
          body: JSON.stringify({ agentId: `agent1` }),
        })
      )
      expect(data).toEqual({
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
        status: 200,
        json: async () => ({ data: [{ id: `t1` }] }),
      })

      const { data, ok } = await client.listThreads(`org1`, `agent1`)

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1/threads`,
        expect.any(Object)
      )
      expect(data?.[0].id).toEqual(`t1`)
    })
  })

  describe(`getThread`, () => {
    it(`should call GET /_/orgs/:orgId/agents/:agentId/threads/:id`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: `t1`, name: `Chat` } }),
      })

      const { data, ok } = await client.getThread(`org1`, `agent1`, `t1`)

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1/threads/t1`,
        expect.any(Object)
      )
      expect(data?.id).toEqual(`t1`)
      expect(data?.name).toEqual(`Chat`)
    })
  })

  describe(`createThread`, () => {
    it(`should POST to /_/orgs/:orgId/agents/:agentId/threads`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: `t-new`, name: `REPL session` } }),
      })

      const { data, ok } = await client.createThread(`org1`, `agent1`)

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1/threads`,
        expect.objectContaining({
          method: `POST`,
          body: JSON.stringify({ name: `REPL session` }),
        })
      )
      expect(data?.id).toEqual(`t-new`)
      expect(data?.name).toEqual(`REPL session`)
    })

    it(`should use custom name when provided`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
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
        status: 200,
        json: async () => ({ data: [{ id: `m1`, content: `Hi` }] }),
      })

      const { data, ok } = await client.listMessages(`org1`, `agent1`, `t1`)

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1/threads/t1/messages`,
        expect.any(Object)
      )
      expect(data?.[0]).toMatchObject({ id: `m1` })
    })
  })

  describe(`createMessage`, () => {
    it(`should POST to messages endpoint`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: `m-new` } }),
      })

      const { data, ok } = await client.createMessage(`org1`, `agent1`, `t1`, {
        type: `user`,
        content: [{ type: `text`, text: `Hello` }],
        orgId: `org1`,
      })

      expect(ok).toBe(true)
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
      expect(data?.id).toEqual(`m-new`)
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
    it(`retries on network error up to 3 times then returns ok:true on success`, async () => {
      const networkError = new TypeError(`fetch failed`)
      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        })

      const result = await client.listOrgs()

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result.ok).toBe(true)
      expect(result.data).toEqual([])
    })

    it(`retries on 429 with backoff and returns ok:true on success`, async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: `Too Many Requests`,
          text: async () => `Rate limited`,
        })
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        })

      const result = await client.listOrgs()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.ok).toBe(true)
      expect(result.data).toEqual([])
    })

    it(`does not retry on 4xx errors (except 429) — returns ok:false immediately`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: `Bad Request`,
        text: async () => `Invalid`,
      })

      const result = await client.listOrgs()
      expect(result.ok).toBe(false)
      expect(result.status).toBe(400)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it(`retries on 500 errors and returns ok:true on success`, async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: `Internal Server Error`,
          text: async () => `Server error`,
        })
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        })

      const result = await client.listOrgs()

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.ok).toBe(true)
    })

    it(`returns ok:false after max retries exhausted`, async () => {
      const networkError = new TypeError(`fetch failed`)
      mockFetch.mockRejectedValue(networkError)

      const result = await client.listOrgs()

      expect(mockFetch).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
      expect(result.ok).toBe(false)
    })

    it(`does not retry on 401 — returns ok:false immediately`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: `Unauthorized`,
        text: async () => `Unauthorized`,
      })

      const result = await client.listOrgs()
      expect(result.ok).toBe(false)
      expect(result.status).toBe(401)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it(`does not retry on 403 — returns ok:false immediately`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: `Forbidden`,
        text: async () => `Forbidden`,
      })

      const result = await client.listOrgs()
      expect(result.ok).toBe(false)
      expect(result.status).toBe(403)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe(`listProviders`, () => {
    it(`lists available providers for an agent`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
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

      const { data, ok } = await client.listProviders(`org1`)

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/providers`,
        expect.any(Object)
      )
      expect(data).toHaveLength(2)
      expect(data?.[0].name).toBe(`Anthropic`)
    })
  })

  describe(`listProjects`, () => {
    it(`should call GET /_/orgs/:orgId/projects`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: `p1`, name: `My Project` }] }),
      })

      const { data, ok } = await client.listProjects(`org1`)

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/projects`,
        expect.any(Object)
      )
      expect(data).toEqual([{ id: `p1`, name: `My Project` }])
    })
  })

  describe(`deleteThread`, () => {
    it(`should call DELETE on the thread endpoint`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: undefined }),
      })

      const { ok } = await client.deleteThread(`org1`, `agent1`, `t1`)

      expect(ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs/org1/agents/agent1/threads/t1`,
        expect.objectContaining({
          method: `DELETE`,
        })
      )
    })
  })

  describe(`createSession with providerId`, () => {
    it(`should POST with providerId when specified`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
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
        status: 200,
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

  describe(`#ensureAuth syncs URL and bearer before each request`, () => {
    it(`updates URL if proxyUrl changes between calls`, async () => {
      const creds = makeCreds()
      const auth = { creds: vi.fn().mockReturnValue(creds) } as unknown as AuthManager
      const c = new ApiClient(auth)

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      })

      await c.listOrgs()
      expect(mockFetch).toHaveBeenCalledWith(
        `https://proxy.test/_/orgs`,
        expect.any(Object)
      )

      // Simulate URL change
      ;(auth as any).creds.mockReturnValue({
        ...creds,
        proxyUrl: `https://new.proxy.test`,
      })

      mockFetch.mockClear()
      await c.listOrgs()
      expect(mockFetch).toHaveBeenCalledWith(
        `https://new.proxy.test/_/orgs`,
        expect.any(Object)
      )
    })
  })
})
