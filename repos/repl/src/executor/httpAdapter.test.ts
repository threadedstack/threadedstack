import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpMessageAdapter } from './httpAdapter'
import type { ApiClient } from '@TRL/api'

const makeClient = () =>
  ({
    listMessages: vi.fn().mockResolvedValue([
      { type: `user`, content: [{ type: `text`, text: `Hello` }] },
      { type: `assistant`, content: [{ type: `text`, text: `Hi there` }] },
    ]),
    createMessage: vi.fn().mockResolvedValue({ id: `m-new` }),
  }) as unknown as ApiClient

describe(`HttpMessageAdapter`, () => {
  let adapter: HttpMessageAdapter
  let client: ReturnType<typeof makeClient>

  beforeEach(() => {
    client = makeClient()
    adapter = new HttpMessageAdapter(client, `org-1`, `agent-1`)
  })

  describe(`listMessages`, () => {
    it(`should call client.listMessages with correct params`, async () => {
      const result = await adapter.listMessages({
        where: { threadId: `t1` },
        limit: 50,
        offset: 0,
      })

      expect(client.listMessages).toHaveBeenCalledWith(`org-1`, `agent-1`, `t1`, {
        limit: 50,
        offset: 0,
      })
      expect(result.data).toHaveLength(2)
      expect(result.data![0].type).toBe(`user`)
    })

    it(`should return empty array when client returns null`, async () => {
      ;(client.listMessages as any).mockResolvedValue(null)

      const result = await adapter.listMessages({
        where: { threadId: `t1` },
        limit: 50,
        offset: 0,
      })

      expect(result.data).toEqual([])
    })
  })

  describe(`createMessage`, () => {
    it(`should call client.createMessage with correct params`, async () => {
      await adapter.createMessage({
        threadId: `t1`,
        type: `user`,
        content: [{ type: `text`, text: `Hello` }],
        orgId: `org-1`,
      })

      expect(client.createMessage).toHaveBeenCalledWith(`org-1`, `agent-1`, `t1`, {
        type: `user`,
        content: [{ type: `text`, text: `Hello` }],
        orgId: `org-1`,
      })
    })
  })
})
