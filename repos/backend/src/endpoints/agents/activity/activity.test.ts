import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig } from '@TBE/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Agent, EQueryOp, Record as RecordModel } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { orgProjects } from '@TBE/endpoints/orgs/orgProjects'

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

  it(`guards every route with an agent read authorization`, () => {
    for (const endpoint of [
      getAgentStatus,
      listAgentTurns,
      listAgentMessages,
      listAgentMemories,
    ])
      expect(endpoint.middleware?.length).toBeGreaterThan(0)
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
