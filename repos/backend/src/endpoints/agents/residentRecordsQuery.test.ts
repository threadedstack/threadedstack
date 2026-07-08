import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Agent, ApiKey, hashKey, ApiKeyPrefix } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { residentAuth } from '@TBE/middleware/residentAuth'
import { residentRecordsQuery, residentRecordsQueryAction } from './residentRecordsQuery'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const OrgId = `og_org00001`
const AgentId = `ag_agent001`
const ProjectId = `pj_proj0001`
const OtherAgentId = `ag_other001`

const ResidentToken = `${ApiKeyPrefix}resident-secret-1`
const OtherResidentToken = `${ApiKeyPrefix}resident-secret-2`

const keysByHash: Record<string, ApiKey> = {
  [hashKey(ResidentToken)]: new ApiKey({
    id: `ak_res00001`,
    name: `resident:${AgentId}`,
    active: true,
    orgId: OrgId,
    keyHash: hashKey(ResidentToken),
    keyPrefix: ResidentToken.slice(0, 12),
    residentAgentId: AgentId,
  }),
  [hashKey(OtherResidentToken)]: new ApiKey({
    id: `ak_res00002`,
    name: `resident:${OtherAgentId}`,
    active: true,
    orgId: OrgId,
    keyHash: hashKey(OtherResidentToken),
    keyPrefix: OtherResidentToken.slice(0, 12),
    residentAgentId: OtherAgentId,
  }),
}

const buildAgent = () =>
  new Agent({
    id: AgentId,
    name: `cmo`,
    orgId: OrgId,
    projects: [{ id: ProjectId }] as any,
  })

const Records = [
  { id: `rec_cfg001`, data: { agentId: AgentId, agenda: [] }, extra: `dropped` },
]

const buildApp = (agent: Agent | null = buildAgent()) => {
  const query = vi.fn().mockResolvedValue({ data: Records })
  const app = {
    locals: {
      config: { server: {} },
      db: {
        services: {
          agent: { get: vi.fn().mockResolvedValue({ data: agent }) },
          record: { query },
          apiKey: {
            getByHash: vi
              .fn()
              .mockImplementation(async (hash: string) => ({ data: keysByHash[hash] })),
            touchLastUsed: vi.fn().mockResolvedValue({ data: true }),
          },
        },
      },
    },
  } as unknown as TApp
  return { app, query }
}

const buildCtx = () => {
  const json = vi.fn()
  const status = vi.fn().mockReturnThis()
  const res = { status, json, locals: {} } as unknown as Response
  return { res, json, status }
}

const buildReq = (
  app: TApp,
  {
    token = ResidentToken,
    body = { collection: `resident_configs`, query: { limit: 1 } },
    params = { orgId: OrgId, projectId: ProjectId, agentId: AgentId },
  }: { token?: string; body?: unknown; params?: Record<string, string> } = {}
) =>
  ({
    app,
    body,
    params,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }) as unknown as TRequest

/** Run residentAuth then the action, mirroring the registered middleware chain. */
const run = async (req: TRequest, res: Response) => {
  await new Promise<void>((resolve, reject) => {
    Promise.resolve(
      residentAuth(req, res, (err?: unknown) => (err ? reject(err) : resolve()))
    ).catch(reject)
  })
  await residentRecordsQueryAction(req, res)
}

describe(`residentRecordsQuery`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`registers a resident-authed POST at the records/query path`, () => {
    const { app } = buildApp()
    const def = residentRecordsQuery(app)
    expect(def.method).toBe(EPMethod.Post)
    expect(def.path).toContain(`/agents/:agentId/records/query`)
    expect(def.middleware).toContain(residentAuth)
  })

  it(`returns id+data rows for a resident-authed query`, async () => {
    const { app, query } = buildApp()
    const { res, json } = buildCtx()
    await run(buildReq(app), res)
    expect(query).toHaveBeenCalledWith(ProjectId, `resident_configs`, { limit: 1 })
    expect(json).toHaveBeenCalledWith({
      data: [{ id: `rec_cfg001`, data: { agentId: AgentId, agenda: [] } }],
    })
  })

  it(`rejects a resident token bound to another agent`, async () => {
    const { app } = buildApp()
    const { res } = buildCtx()
    await expect(
      run(buildReq(app, { token: OtherResidentToken }), res)
    ).rejects.toMatchObject({ status: 403 })
  })

  it(`rejects a missing token`, async () => {
    const { app } = buildApp()
    const { res } = buildCtx()
    await expect(run(buildReq(app, { token: `` }), res)).rejects.toMatchObject({
      status: 401,
    })
  })

  it(`rejects an agent outside the org or project`, async () => {
    const { app } = buildApp(
      new Agent({ id: AgentId, name: `x`, orgId: `og_other001`, projects: [] as any })
    )
    const { res } = buildCtx()
    await expect(run(buildReq(app), res)).rejects.toMatchObject({ status: 403 })
  })

  it(`requires a collection name`, async () => {
    const { app } = buildApp()
    const { res } = buildCtx()
    await expect(run(buildReq(app, { body: { query: {} } }), res)).rejects.toMatchObject({
      status: 400,
    })
  })
})
