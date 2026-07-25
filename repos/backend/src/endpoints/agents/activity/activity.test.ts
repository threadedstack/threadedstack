import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig } from '@TBE/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  Agent,
  EQueryOp,
  EPermAction,
  EPermResource,
  Record as RecordModel,
} from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { orgProjects } from '@TBE/endpoints/orgs/orgProjects'

/**
 * Tag each `authorize()` result with the grant it was built from, so a test can
 * assert WHICH permissions an endpoint demands rather than only how many
 * middleware it happens to carry.
 */
vi.mock(`@TBE/middleware/authorize`, () => ({
  authorize: (action: unknown, resource: unknown) =>
    Object.assign(vi.fn(), { grant: { action, resource } }),
}))

import { getAgentStatus } from './getAgentStatus'
import { listAgentTurns } from './listAgentTurns'
import { listAgentMessages } from './listAgentMessages'
import { listAgentMemories } from './listAgentMemories'
import { resolveActivityQuery } from './resolveActivityQuery'

const OrgId = `og_org00001`
const AgentId = `ag_agent001`
const ProjectId = `pj_proj0001`

/** The two collection shapes the resolver has to tell apart. */
const TimestampedCollection = { agentField: `agentId`, timeField: `at` }
const MessagesCollection = { agentField: `to` }

describe(`resolveActivityQuery`, () => {
  it(`filters by the collection's agent field and sorts newest first by default`, () => {
    expect(resolveActivityQuery(AgentId, {}, TimestampedCollection)).toEqual({
      where: [{ field: `agentId`, op: EQueryOp.eq, value: AgentId }],
      orderBy: { field: `at`, direction: `desc` },
      limit: 25,
    })
  })

  it(`clamps limit to the 1-100 range and coerces a numeric string`, () => {
    const limitOf = (limit: unknown) =>
      resolveActivityQuery(AgentId, { limit }, TimestampedCollection).limit

    expect(limitOf(`50`)).toBe(50)
    expect(limitOf(`500`)).toBe(100)
    expect(limitOf(`0`)).toBe(1)
    expect(limitOf(`-10`)).toBe(1)
    // Garbage falls back to the default rather than NaN reaching the query.
    expect(limitOf(`abc`)).toBe(25)
    expect(limitOf(undefined)).toBe(25)
    // An exponential string is read as the huge value it is and clamped, not
    // truncated to its leading digit.
    expect(limitOf(`1e21`)).toBe(100)
  })

  it(`adds a keyset cursor on the time field when before is supplied`, () => {
    const query = resolveActivityQuery(
      AgentId,
      { before: `2026-07-24T00:00:00Z` },
      TimestampedCollection
    )

    expect(query.where).toEqual([
      { field: `agentId`, op: EQueryOp.eq, value: AgentId },
      { field: `at`, op: EQueryOp.lt, value: `2026-07-24T00:00:00Z` },
    ])
  })

  it(`ignores a non-string before rather than injecting an array`, () => {
    // Express parses `?before=a&before=b` into an array — it must never reach
    // the query layer as a bound value.
    const query = resolveActivityQuery(
      AgentId,
      { before: [`a`, `b`] },
      TimestampedCollection
    )

    expect(query.where).toHaveLength(1)
  })

  it(`never orders or keysets a collection with no time field`, () => {
    // `agent_messages` declares no timestamp; naming one would make the query
    // compiler throw, turning every read into a 500.
    const query = resolveActivityQuery(
      AgentId,
      { before: `2026-07-24T00:00:00Z` },
      MessagesCollection
    )

    expect(query.orderBy).toBeUndefined()
    expect(query.where).toEqual([{ field: `to`, op: EQueryOp.eq, value: AgentId }])
  })

  it(`pages a time-field-less collection by a clamped offset`, () => {
    const offsetOf = (offset: unknown) =>
      resolveActivityQuery(AgentId, { offset }, MessagesCollection).offset

    expect(offsetOf(`25`)).toBe(25)
    expect(offsetOf(`-5`)).toBe(0)
    expect(offsetOf(`abc`)).toBe(0)
    expect(offsetOf(undefined)).toBe(0)
  })

  it(`caps offset at the top, so an absurd page can never reach the SQL layer`, () => {
    const offsetOf = (offset: unknown) =>
      resolveActivityQuery(AgentId, { offset }, MessagesCollection).offset

    // `compileRecordQuery` clamps offset only at the bottom, so a value that
    // survives here goes straight to Postgres — where a 21-digit offset fails
    // to cast to bigint (a caller-triggerable 500) and a merely large one buys
    // a full scan to skip rows that do not exist.
    expect(offsetOf(`999999999999999999999`)).toBe(10000)
    expect(offsetOf(`1e21`)).toBe(10000)
    expect(offsetOf(1e21)).toBe(10000)
    expect(offsetOf(`10001`)).toBe(10000)
    // Non-finite input is treated as absent rather than as "page forever".
    expect(offsetOf(`Infinity`)).toBe(0)
    expect(offsetOf(Number.POSITIVE_INFINITY)).toBe(0)
    // A fractional offset is floored, never handed to the driver as a float.
    expect(offsetOf(`25.9`)).toBe(25)

    for (const hostile of [`999999999999999999999`, `1e21`, 1e21, `Infinity`])
      expect(
        Number.isSafeInteger(offsetOf(hostile)),
        String(hostile)
      ).toBe(true)
  })

  it(`never offsets a keyset-paged collection, which would skip rows`, () => {
    const query = resolveActivityQuery(
      AgentId,
      { offset: `25` },
      TimestampedCollection
    )

    expect(query.offset).toBeUndefined()
  })
})

/** Fresh mock app with the agent + record services the activity endpoints use. */
const buildApp = (agent: Agent | null = buildAgent()) => {
  const query = vi.fn().mockResolvedValue({ data: [] })
  const get = vi.fn().mockResolvedValue(agent ? { data: agent } : {})

  const app = {
    locals: { db: { services: { agent: { get }, record: { query } } } },
  } as unknown as TApp

  return { app, query, get }
}

const buildAgent = (overrides: Partial<Agent> = {}) =>
  new Agent({
    id: AgentId,
    name: `cmo`,
    orgId: OrgId,
    projects: [{ id: ProjectId }] as any,
    ...overrides,
  })

/** Fresh res + spies for a single action invocation. */
const buildCtx = () => {
  const json = vi.fn()
  const status = vi.fn().mockReturnThis()
  const res = { status, json } as unknown as Response
  return { res, json, status }
}

const buildReq = (
  app: TApp,
  params: Record<string, string | undefined> = {
    orgId: OrgId,
    projectId: ProjectId,
    agentId: AgentId,
  },
  query: Record<string, unknown> = {}
) => ({ app, user: { id: `us_user0001` }, params, query, body: {} }) as unknown as TRequest

describe(`agent activity endpoints`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`declares the expected routes and methods`, () => {
    expect(getAgentStatus.path).toBe(`/status`)
    expect(getAgentStatus.method).toBe(EPMethod.Get)
    expect(listAgentTurns.path).toBe(`/turns`)
    expect(listAgentTurns.method).toBe(EPMethod.Get)
    expect(listAgentMessages.path).toBe(`/messages`)
    expect(listAgentMessages.method).toBe(EPMethod.Get)
    expect(listAgentMemories.path).toBe(`/memories`)
    expect(listAgentMemories.method).toBe(EPMethod.Get)
  })

  it(`demands BOTH agent:read and collection:read on every route`, () => {
    // These endpoints return raw Collection documents — the same bytes the
    // generic `POST .../records/query` route serves behind `collection:read`.
    // With only `agent:read` they would be a way around a revoked collection
    // grant, since `resolveEffectivePermissions` intersects permission
    // overrides and API-key permissions.
    for (const [name, endpoint] of Object.entries({
      getAgentStatus,
      listAgentTurns,
      listAgentMessages,
      listAgentMemories,
    })) {
      const grants = (endpoint.middleware ?? []).map(
        (mw) => (mw as unknown as { grant?: unknown }).grant
      )

      expect(grants, name).toEqual([
        { action: EPermAction.read, resource: EPermResource.agent },
        { action: EPermAction.read, resource: EPermResource.collection },
      ])
    }
  })

  describe(`getAgentStatus`, () => {
    it(`returns the newest status row for the agent`, async () => {
      const { app, query } = buildApp()
      const { res, json } = buildCtx()
      query.mockResolvedValue({
        data: [
          new RecordModel({
            id: `rc_status01`,
            data: { agentId: AgentId, turnCount: 7 },
            projectId: ProjectId,
            collectionId: `col_resstt`,
          }),
        ],
      })

      await getAgentStatus.action?.(buildReq(app), res)

      expect(query).toHaveBeenCalledWith(ProjectId, `resident_status`, {
        where: [{ field: `agentId`, op: EQueryOp.eq, value: AgentId }],
        limit: 1,
      })
      expect(json).toHaveBeenCalledWith({
        data: {
          id: `rc_status01`,
          data: { agentId: AgentId, turnCount: 7 },
          createdAt: undefined,
        },
      })
    })

    it(`never orders resident_status, which declares no timestamp field`, async () => {
      // Naming a field the collection schema does not declare makes the query
      // compiler throw, so this read would 500 on every call.
      const { app, query } = buildApp()
      const { res } = buildCtx()

      await getAgentStatus.action?.(buildReq(app), res)

      expect(query.mock.calls[0][2]).not.toHaveProperty(`orderBy`)
    })

    it(`redacts the heartbeat too, including an undeclared key`, async () => {
      // The declared schema is counters and flags, but the record service's
      // `#validateData` only walks DECLARED fields and never strips an unknown
      // key, and the heartbeat Function spreads `...prev` every beat — so a key
      // injected once is re-emitted forever. The absence of free text here is a
      // convention, not something storage enforces.
      const { app, query } = buildApp()
      const { res, json } = buildCtx()
      query.mockResolvedValue({
        data: [
          new RecordModel({
            id: `rc_status02`,
            data: {
              agentId: AgentId,
              turnCount: 7,
              currentActivity: `connector:push with ghp_abcdefghijklmnopqrstuvwxyz012345`,
              scratch: `tdsk_liveKey1234567890`,
            },
            projectId: ProjectId,
            collectionId: `col_resstt`,
          }),
        ],
      })

      await getAgentStatus.action?.(buildReq(app), res)

      expect(json.mock.calls[0][0].data.data).toEqual({
        agentId: AgentId,
        turnCount: 7,
        currentActivity: `connector:push with [redacted]`,
        scratch: `[redacted]`,
      })
    })

    it(`returns null status when the agent has never run, not a 404`, async () => {
      // A scheduled (non-resident) agent legitimately has no heartbeat row.
      const { app, query } = buildApp()
      const { res, json } = buildCtx()
      query.mockResolvedValue({ data: [] })

      await getAgentStatus.action?.(buildReq(app), res)

      expect(json).toHaveBeenCalledWith({ data: null })
    })
  })

  describe(`listAgentTurns`, () => {
    it(`queries resident_transcripts by agentId, newest first`, async () => {
      const { app, query } = buildApp()
      const { res } = buildCtx()

      await listAgentTurns.action?.(buildReq(app), res)

      expect(query).toHaveBeenCalledWith(ProjectId, `resident_transcripts`, {
        where: [{ field: `agentId`, op: EQueryOp.eq, value: AgentId }],
        orderBy: { field: `at`, direction: `desc` },
        limit: 25,
      })
    })

    it(`passes the caller's limit and before cursor through`, async () => {
      const { app, query } = buildApp()
      const { res } = buildCtx()

      await listAgentTurns.action?.(
        buildReq(app, undefined, { limit: `5`, before: `2026-07-24T00:00:00Z` }),
        res
      )

      expect(query.mock.calls[0][2]).toEqual({
        where: [
          { field: `agentId`, op: EQueryOp.eq, value: AgentId },
          { field: `at`, op: EQueryOp.lt, value: `2026-07-24T00:00:00Z` },
        ],
        orderBy: { field: `at`, direction: `desc` },
        limit: 5,
      })
    })

    it(`returns { id, data, createdAt } and never leaks the scoping columns`, async () => {
      const { app, query } = buildApp()
      const { res, json } = buildCtx()
      query.mockResolvedValue({
        data: [
          new RecordModel({
            id: `rc_turn0001`,
            data: { event: `agenda:groom` },
            projectId: ProjectId,
            collectionId: `col_restrn`,
            createdAt: `2026-07-24T01:00:00.000Z`,
          }),
        ],
      })

      await listAgentTurns.action?.(buildReq(app), res)

      expect(json).toHaveBeenCalledWith({
        data: [
          {
            id: `rc_turn0001`,
            data: { event: `agenda:groom` },
            createdAt: `2026-07-24T01:00:00.000Z`,
          },
        ],
      })

      const [row] = json.mock.calls[0][0].data
      expect(row).not.toHaveProperty(`projectId`)
      expect(row).not.toHaveProperty(`collectionId`)
    })

    it(`redacts secret-shaped text anywhere in the turn, including nested`, async () => {
      const { app, query } = buildApp()
      const { res, json } = buildCtx()

      const stored = {
        event: `work:cycle`,
        input: `rotate tdsk_liveKey1234567890`,
        output: {
          steps: [`called openai with sk-live-abc123`],
          curl: `-H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9"`,
        },
      }
      const row = new RecordModel({
        id: `rc_turn0002`,
        data: stored,
        projectId: ProjectId,
        collectionId: `col_restrn`,
      })
      query.mockResolvedValue({ data: [row] })

      await listAgentTurns.action?.(buildReq(app), res)

      const [sent] = json.mock.calls[0][0].data
      expect(sent.data).toEqual({
        event: `work:cycle`,
        input: `rotate [redacted]`,
        output: {
          steps: [`called openai with [redacted]`],
          curl: `-H "Authorization: Bearer [redacted]"`,
        },
      })
    })

    it(`never mutates the stored record while redacting`, async () => {
      // The record instances come from the DB layer and are shared, so
      // redacting in place would corrupt them for every later reader in the
      // same process.
      const { app, query } = buildApp()
      const { res, json } = buildCtx()

      const row = new RecordModel({
        id: `rc_turn0003`,
        data: { output: `key sk-live-abc123`, nested: { key: `tdsk_liveKey1234567890` } },
        projectId: ProjectId,
        collectionId: `col_restrn`,
      })
      query.mockResolvedValue({ data: [row] })

      await listAgentTurns.action?.(buildReq(app), res)

      expect(row.data).toEqual({
        output: `key sk-live-abc123`,
        nested: { key: `tdsk_liveKey1234567890` },
      })

      const [sent] = json.mock.calls[0][0].data
      expect(sent.data).not.toBe(row.data)
      expect(sent.data.nested).not.toBe(row.data.nested)
    })

    it(`leaves an ordinary turn byte-identical`, async () => {
      // Redaction is anchored on word boundaries precisely so routine agent
      // prose survives — an unanchored `sk-` eats `task-management`.
      const { app, query } = buildApp()
      const { res, json } = buildCtx()

      const stored = {
        event: `agenda:groom`,
        output: `groomed task-management, checked disk-usage and risk-assessment`,
        importance: 7,
        ok: true,
        meta: null,
      }
      query.mockResolvedValue({
        data: [
          new RecordModel({
            id: `rc_turn0004`,
            data: stored,
            projectId: ProjectId,
            collectionId: `col_restrn`,
          }),
        ],
      })

      await listAgentTurns.action?.(buildReq(app), res)

      expect(json.mock.calls[0][0].data[0].data).toEqual(stored)
    })

    it(`returns an empty list when the agent has no turns`, async () => {
      const { app, query } = buildApp()
      const { res, json } = buildCtx()
      query.mockResolvedValue({ data: [] })

      await listAgentTurns.action?.(buildReq(app), res)

      expect(json).toHaveBeenCalledWith({ data: [] })
    })

    it(`surfaces a record-service error rather than an empty list`, async () => {
      const { app, query } = buildApp()
      const { res } = buildCtx()
      query.mockResolvedValue({ error: { message: `DB failure` } })

      await expect(listAgentTurns.action?.(buildReq(app), res)).rejects.toThrow(
        `DB failure`
      )
    })
  })

  describe(`listAgentMessages`, () => {
    it(`queries agent_messages by recipient, since rows carry no agentId`, async () => {
      const { app, query } = buildApp()
      const { res } = buildCtx()

      await listAgentMessages.action?.(buildReq(app), res)

      expect(query).toHaveBeenCalledWith(ProjectId, `agent_messages`, {
        where: [{ field: `to`, op: EQueryOp.eq, value: AgentId }],
        limit: 25,
        offset: 0,
      })
    })

    it(`never names a time field agent_messages does not declare`, async () => {
      const { app, query } = buildApp()
      const { res } = buildCtx()

      await listAgentMessages.action?.(
        buildReq(app, undefined, { before: `2026-07-24T00:00:00Z` }),
        res
      )

      const sent = query.mock.calls[0][2]
      expect(sent.orderBy).toBeUndefined()
      expect(sent.where).toHaveLength(1)
    })

    it(`redacts a message body`, async () => {
      const { app, query } = buildApp()
      const { res, json } = buildCtx()

      query.mockResolvedValue({
        data: [
          new RecordModel({
            id: `rc_msg00001`,
            data: {
              to: AgentId,
              from: `ag_ceo00001`,
              subject: `connector creds`,
              body: `use ghp_abcdefghijklmnopqrstuvwxyz012345 and xoxb-123456789012-abcdef`,
            },
            projectId: ProjectId,
            collectionId: `col_agtmsg`,
          }),
        ],
      })

      await listAgentMessages.action?.(buildReq(app), res)

      const [sent] = json.mock.calls[0][0].data
      expect(sent.data.body).toBe(`use [redacted] and [redacted]`)
      expect(sent.data.subject).toBe(`connector creds`)
      expect(sent.data.from).toBe(`ag_ceo00001`)
    })
  })

  describe(`listAgentMemories`, () => {
    it(`queries resident_memories by agentId, newest first`, async () => {
      const { app, query } = buildApp()
      const { res } = buildCtx()

      await listAgentMemories.action?.(buildReq(app), res)

      expect(query).toHaveBeenCalledWith(ProjectId, `resident_memories`, {
        where: [{ field: `agentId`, op: EQueryOp.eq, value: AgentId }],
        orderBy: { field: `at`, direction: `desc` },
        limit: 25,
      })
    })

    it(`redacts memory text, which is free-form and agent-authored`, async () => {
      // Same exposure class as a transcript: whatever the agent was holding can
      // be written into a memory verbatim.
      const { app, query } = buildApp()
      const { res, json } = buildCtx()

      query.mockResolvedValue({
        data: [
          new RecordModel({
            id: `rc_mem00001`,
            data: { text: `deploy key is AKIAIOSFODNN7EXAMPLE`, importance: 8 },
            projectId: ProjectId,
            collectionId: `col_resmem`,
          }),
        ],
      })

      await listAgentMemories.action?.(buildReq(app), res)

      const [sent] = json.mock.calls[0][0].data
      expect(sent.data).toEqual({ text: `deploy key is [redacted]`, importance: 8 })
    })
  })

  describe(`scope guard`, () => {
    const endpoints = {
      getAgentStatus,
      listAgentTurns,
      listAgentMessages,
      listAgentMemories,
    }

    it(`404s when the agent is not in the caller's org, before reading any collection`, async () => {
      for (const [name, endpoint] of Object.entries(endpoints)) {
        const { app, query } = buildApp(buildAgent({ orgId: `og_other001` }))
        const { res } = buildCtx()

        await expect(
          endpoint.action?.(buildReq(app), res),
          name
        ).rejects.toThrow(`Agent not found`)
        expect(query, name).not.toHaveBeenCalled()
      }
    })

    it(`404s when the agent is not bound to the requested project`, async () => {
      for (const [name, endpoint] of Object.entries(endpoints)) {
        const { app, query } = buildApp(
          buildAgent({ projects: [{ id: `pj_other001` }] as any })
        )
        const { res } = buildCtx()

        await expect(
          endpoint.action?.(buildReq(app), res),
          name
        ).rejects.toThrow(`Agent not found`)
        expect(query, name).not.toHaveBeenCalled()
      }
    })

    it(`404s when the agent has no projects at all`, async () => {
      const { app, query } = buildApp(buildAgent({ projects: [] as any }))
      const { res } = buildCtx()

      await expect(listAgentTurns.action?.(buildReq(app), res)).rejects.toThrow(
        `Agent not found`
      )
      expect(query).not.toHaveBeenCalled()
    })

    it(`404s when the agent does not exist`, async () => {
      const { app, query } = buildApp(null)
      const { res } = buildCtx()

      await expect(listAgentTurns.action?.(buildReq(app), res)).rejects.toThrow(
        `Agent not found`
      )
      expect(query).not.toHaveBeenCalled()
    })

    it(`500s when the agent lookup itself fails`, async () => {
      const { app, get } = buildApp()
      const { res } = buildCtx()
      get.mockResolvedValue({ error: { message: `lookup exploded` } })

      await expect(listAgentTurns.action?.(buildReq(app), res)).rejects.toThrow(
        `lookup exploded`
      )
    })

    it(`400s when a required route param is missing`, async () => {
      const cases: [string, Record<string, string | undefined>][] = [
        [`orgId is required`, { projectId: ProjectId, agentId: AgentId }],
        [`projectId is required`, { orgId: OrgId, agentId: AgentId }],
        [`agentId is required`, { orgId: OrgId, projectId: ProjectId }],
      ]

      for (const [message, params] of cases) {
        const { app, get } = buildApp()
        const { res } = buildCtx()

        await expect(
          listAgentTurns.action?.(buildReq(app, params), res),
          message
        ).rejects.toThrow(message)
        expect(get, message).not.toHaveBeenCalled()
      }
    })
  })
})

describe(`agent activity route mount`, () => {
  const projectAgents = orgProjects.endpoints?.projectAgents as TEndpointConfig
  const activity = projectAgents?.endpoints?.projectAgentActivity as TEndpointConfig

  it(`nests activity inside the agents group rather than as a sibling`, () => {
    // A sibling on `/:projectId/agents/:agentId/activity` would still match the
    // agents group's `use` prefix on the way past, running its guards twice.
    expect(orgProjects.endpoints?.projectAgentActivity).toBeUndefined()
    expect(activity).toBeDefined()
    expect(activity.path).toBe(`/:agentId/activity`)
    expect(activity.method).toBe(EPMethod.Use)
  })

  it(`registers all four activity endpoints`, () => {
    expect(activity.endpoints?.getAgentStatus).toBe(getAgentStatus)
    expect(activity.endpoints?.listAgentTurns).toBe(listAgentTurns)
    expect(activity.endpoints?.listAgentMessages).toBe(listAgentMessages)
    expect(activity.endpoints?.listAgentMemories).toBe(listAgentMemories)
  })

  it(`inherits the parent group's guards instead of redeclaring them`, () => {
    expect(activity.middleware).toBeUndefined()
    expect(projectAgents.middleware?.length).toBeGreaterThan(0)
  })
})
