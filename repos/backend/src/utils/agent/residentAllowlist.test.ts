import { Agent, EQueryOp } from '@tdsk/domain'
import { describe, it, expect, vi } from 'vitest'

import { resolveResidentAllowlist, ResidentConfigsCollection } from './residentAllowlist'

const AgentId = `ag_agent001`
const ProjectId = `pj_proj0001`

const buildAgent = () => new Agent({ id: AgentId, name: `res`, orgId: `og_org00001` })

const buildDb = (records: any[] | Error = []) =>
  ({
    services: {
      record: {
        query: vi
          .fn()
          .mockResolvedValue(
            records instanceof Error ? { error: records } : { data: records }
          ),
      },
    },
  }) as any

describe(`resolveResidentAllowlist`, () => {
  it(`returns the actions array from the agent's resident_configs record`, async () => {
    const db = buildDb([
      {
        id: `rec_cfg001`,
        data: { agentId: AgentId, actions: [`sendAgentMessage`, `heartbeat`] },
      },
    ])

    const allowlist = await resolveResidentAllowlist(db, buildAgent(), ProjectId)

    expect(allowlist).toEqual([`sendAgentMessage`, `heartbeat`])
    // Resolved server-side from the dispatch project's collection, keyed by
    // the agent's identity — never anything the request supplied.
    expect(db.services.record.query).toHaveBeenCalledWith(
      ProjectId,
      ResidentConfigsCollection,
      {
        where: [{ field: `agentId`, op: EQueryOp.eq, value: AgentId }],
        limit: 1,
      }
    )
  })

  it(`fails closed to [] when the agent has no resident_configs record`, async () => {
    expect(await resolveResidentAllowlist(buildDb([]), buildAgent(), ProjectId)).toEqual(
      []
    )
  })

  it(`fails closed to [] when no projectId is given`, async () => {
    const db = buildDb([{ id: `rec_cfg001`, data: { agentId: AgentId, actions: [`x`] } }])
    expect(await resolveResidentAllowlist(db, buildAgent())).toEqual([])
    expect(db.services.record.query).not.toHaveBeenCalled()
  })

  it(`fails closed to [] when the record has no actions array`, async () => {
    const db = buildDb([{ id: `rec_cfg001`, data: { agentId: AgentId } }])
    expect(await resolveResidentAllowlist(db, buildAgent(), ProjectId)).toEqual([])

    const notArray = buildDb([
      { id: `rec_cfg001`, data: { agentId: AgentId, actions: `sendAgentMessage` } },
    ])
    expect(await resolveResidentAllowlist(notArray, buildAgent(), ProjectId)).toEqual([])
  })

  it(`drops non-string entries from the actions array`, async () => {
    const db = buildDb([
      {
        id: `rec_cfg001`,
        data: { agentId: AgentId, actions: [`heartbeat`, 7, null, { evil: true }] },
      },
    ])
    expect(await resolveResidentAllowlist(db, buildAgent(), ProjectId)).toEqual([
      `heartbeat`,
    ])
  })

  it(`fails closed to [] when the records query errors`, async () => {
    const db = buildDb(new Error(`db down`))
    expect(await resolveResidentAllowlist(db, buildAgent(), ProjectId)).toEqual([])
  })
})
