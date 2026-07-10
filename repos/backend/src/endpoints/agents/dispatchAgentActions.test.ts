import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Agent, ApiKey, hashKey, ApiKeyPrefix } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { residentAuth } from '@TBE/middleware/residentAuth'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'
import {
  residentDispatch,
  MaxDispatchActions,
  dispatchAgentActions,
} from './dispatchAgentActions'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/services/functions/functionExecutor`, () => ({
  FunctionExecutor: { execute: vi.fn() },
}))

const mockExecute = FunctionExecutor.execute as ReturnType<typeof vi.fn>

const OrgId = `og_org00001`
const AgentId = `ag_agent001`
const ProjectId = `pj_proj0001`
const OtherAgentId = `ag_other001`

const ResidentToken = `${ApiKeyPrefix}resident-secret-1`
const OtherResidentToken = `${ApiKeyPrefix}resident-secret-2`
const NormalToken = `${ApiKeyPrefix}normal-user-key`
const RevokedToken = `${ApiKeyPrefix}revoked-key`

/** Key fixtures looked up by hash, exactly as the middleware resolves them. */
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
  [hashKey(NormalToken)]: new ApiKey({
    id: `ak_norm0001`,
    name: `user key`,
    active: true,
    orgId: OrgId,
    userId: `11111111-2222-3333-4444-555555555555`,
    keyHash: hashKey(NormalToken),
    keyPrefix: NormalToken.slice(0, 12),
  }),
  [hashKey(RevokedToken)]: new ApiKey({
    id: `ak_revk0001`,
    name: `resident:${AgentId}`,
    active: false,
    orgId: OrgId,
    keyHash: hashKey(RevokedToken),
    keyPrefix: RevokedToken.slice(0, 12),
    residentAgentId: AgentId,
  }),
}

const buildAgent = (overrides: Record<string, any> = {}) =>
  new Agent({
    id: AgentId,
    name: `steward`,
    orgId: OrgId,
    projects: [{ id: ProjectId }] as any,
    ...overrides,
  })

const mockFunc = {
  id: `fn-1`,
  name: `recordProposal`,
  language: `typescript`,
  projectId: ProjectId,
  content: `export default async () => ({})`,
}

/** The allowlist source: the agent's resident_configs record (R3 resolver). */
const buildApp = (
  agent: Agent | null = buildAgent(),
  actions: string[] | null = [`recordProposal`]
) =>
  ({
    locals: {
      config: { server: {} },
      db: {
        services: {
          agent: {
            get: vi.fn().mockResolvedValue({ data: agent }),
          },
          function: {
            list: vi.fn().mockResolvedValue({ data: [mockFunc] }),
          },
          record: {
            query: vi.fn().mockResolvedValue({
              data:
                actions === null
                  ? []
                  : [{ id: `rec_cfg001`, data: { agentId: AgentId, actions } }],
            }),
          },
          apiKey: {
            getByHash: vi
              .fn()
              .mockImplementation(async (hash: string) => ({ data: keysByHash[hash] })),
            touchLastUsed: vi.fn().mockResolvedValue({ data: true }),
          },
        },
      },
    },
  }) as unknown as TApp

const buildCtx = () => {
  const json = vi.fn()
  const status = vi.fn().mockReturnThis()
  const res = { status, json, locals: {} } as unknown as Response
  return { res, json, status }
}

const buildReq = (
  app: TApp,
  {
    token,
    body = {},
    params = { orgId: OrgId, projectId: ProjectId, agentId: AgentId },
  }: { token?: string; body?: any; params?: Record<string, string> } = {}
) =>
  ({
    app,
    body,
    params,
    query: {},
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }) as unknown as TRequest

const runAuth = async (req: TRequest) => {
  const next = vi.fn()
  await residentAuth(req, buildCtx().res as any, next)
  return next.mock.calls[0]?.[0]
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`residentDispatch registration`, () => {
  it(`registers a POST at the admin dispatch path with residentAuth`, () => {
    const app = buildApp()
    const config = residentDispatch(app)
    expect(config.method).toBe(EPMethod.Post)
    expect(config.path).toBe(
      `/_/orgs/:orgId/projects/:projectId/agents/:agentId/dispatch`
    )
    expect(config.middleware).toHaveLength(2)
    expect(config.middleware?.[1]).toBe(residentAuth)
    expect(config.action).toBe(dispatchAgentActions)
  })
})

describe(`residentAuth — full auth matrix`, () => {
  it(`401s when no Authorization header is present`, async () => {
    const err = await runAuth(buildReq(buildApp()))
    expect(err).toMatchObject({ status: 401 })
  })

  it(`401s a bearer token that is not a tdsk api key (e.g. a user JWT)`, async () => {
    const err = await runAuth(buildReq(buildApp(), { token: `eyJhbGciOiJSUzI1NiJ9.x.y` }))
    expect(err).toMatchObject({ status: 401 })
  })

  it(`401s an unknown tdsk key`, async () => {
    const err = await runAuth(
      buildReq(buildApp(), { token: `${ApiKeyPrefix}does-not-exist` })
    )
    expect(err).toMatchObject({ status: 401 })
  })

  it(`403s a normal (non-resident) api key — admins use the normal surfaces`, async () => {
    const err = await runAuth(buildReq(buildApp(), { token: NormalToken }))
    expect(err).toMatchObject({ status: 403 })
  })

  it(`403s a resident key bound to a DIFFERENT agent`, async () => {
    const err = await runAuth(buildReq(buildApp(), { token: OtherResidentToken }))
    expect(err).toMatchObject({ status: 403 })
  })

  it(`401s a revoked resident key`, async () => {
    const err = await runAuth(buildReq(buildApp(), { token: RevokedToken }))
    expect(err).toMatchObject({ status: 401 })
  })

  it(`401s an expired resident key`, async () => {
    const expiredToken = `${ApiKeyPrefix}expired-key`
    keysByHash[hashKey(expiredToken)] = new ApiKey({
      id: `ak_expd0001`,
      name: `resident:${AgentId}`,
      active: true,
      orgId: OrgId,
      keyHash: hashKey(expiredToken),
      keyPrefix: expiredToken.slice(0, 12),
      residentAgentId: AgentId,
      expiresAt: new Date(Date.now() - 60_000),
    })
    const err = await runAuth(buildReq(buildApp(), { token: expiredToken }))
    expect(err).toMatchObject({ status: 401 })
  })

  it(`passes the resident key bound to exactly :agentId and touches lastUsedAt`, async () => {
    const app = buildApp()
    const err = await runAuth(buildReq(app, { token: ResidentToken }))
    expect(err).toBeUndefined()
    expect(app.locals.db.services.apiKey.touchLastUsed).toHaveBeenCalledWith(
      `ak_res00001`
    )
  })
})

describe(`dispatchAgentActions`, () => {
  const dispatch = (app: TApp, body: any, params?: Record<string, string>) => {
    const ctx = buildCtx()
    return {
      ctx,
      run: dispatchAgentActions(buildReq(app, { body, params }), ctx.res),
    }
  }

  it(`executes each action through invokeAction and returns per-action results`, async () => {
    mockExecute.mockResolvedValue({ success: true, output: { saved: true }, duration: 3 })
    const app = buildApp()

    const { ctx, run } = dispatch(app, {
      actions: [{ function: `recordProposal`, args: { title: `x` } }],
    })
    await run

    expect(app.locals.db.services.function.list).toHaveBeenCalledWith({
      where: { projectId: ProjectId, name: `recordProposal` },
    })
    expect(mockExecute).toHaveBeenCalledWith(mockFunc, {
      db: app.locals.db,
      context: { args: { title: `x` }, caller: { agentId: AgentId } },
      connectEndpoints: [],
      caller: { agentId: AgentId },
    })
    expect(ctx.status).toHaveBeenCalledWith(200)
    expect(ctx.json).toHaveBeenCalledWith({
      data: [{ ok: true, data: { saved: true } }],
    })
  })

  it(`enforces the SERVER-SIDE allowlist — non-allowed functions fail per-action`, async () => {
    mockExecute.mockResolvedValue({ success: true, output: {}, duration: 1 })
    const app = buildApp()

    const { ctx, run } = dispatch(app, {
      actions: [
        { function: `recordProposal`, args: {} },
        { function: `deleteEverything`, args: {} },
      ],
    })
    await run

    const results = ctx.json.mock.calls[0][0].data
    expect(results).toHaveLength(2)
    expect(results[0].ok).toBe(true)
    expect(results[1].ok).toBe(false)
    expect(results[1].error).toContain(`function not allowed`)
    // The non-allowed function never reached the executor
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  it(`the request cannot supply its own allowlist`, async () => {
    // No resident_configs record at all — the resolver fails closed to []
    const app = buildApp(buildAgent(), null)

    const { ctx, run } = dispatch(app, {
      allowlist: [`deleteEverything`],
      actions: [{ function: `deleteEverything`, args: {} }],
    })
    await run

    const results = ctx.json.mock.calls[0][0].data
    expect(results[0].ok).toBe(false)
    expect(results[0].error).toContain(`function not allowed`)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it(`defaults missing args to an empty object`, async () => {
    mockExecute.mockResolvedValue({ success: true, output: {}, duration: 1 })
    const app = buildApp()

    const { run } = dispatch(app, { actions: [{ function: `recordProposal` }] })
    await run

    expect(mockExecute.mock.calls[0][1].context.args).toEqual({})
  })

  it(`400s when actions is missing or empty`, async () => {
    await expect(dispatch(buildApp(), {}).run).rejects.toMatchObject({ status: 400 })
    await expect(dispatch(buildApp(), { actions: [] }).run).rejects.toMatchObject({
      status: 400,
    })
    await expect(
      dispatch(buildApp(), { actions: `not-an-array` }).run
    ).rejects.toMatchObject({ status: 400 })
  })

  it(`400s when more than ${MaxDispatchActions} actions are sent`, async () => {
    const actions = Array.from({ length: MaxDispatchActions + 1 }, () => ({
      function: `recordProposal`,
      args: {},
    }))
    await expect(dispatch(buildApp(), { actions }).run).rejects.toMatchObject({
      status: 400,
    })
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it(`accepts exactly ${MaxDispatchActions} actions`, async () => {
    mockExecute.mockResolvedValue({ success: true, output: {}, duration: 1 })
    const actions = Array.from({ length: MaxDispatchActions }, () => ({
      function: `recordProposal`,
      args: {},
    }))
    const { ctx, run } = dispatch(buildApp(), { actions })
    await run
    expect(ctx.status).toHaveBeenCalledWith(200)
    expect(ctx.json.mock.calls[0][0].data).toHaveLength(MaxDispatchActions)
  })

  it(`400s a malformed action (missing function name or non-object args)`, async () => {
    await expect(
      dispatch(buildApp(), { actions: [{ args: {} }] }).run
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      dispatch(buildApp(), { actions: [{ function: `recordProposal`, args: [] }] }).run
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      dispatch(buildApp(), { actions: [{ function: ``, args: {} }] }).run
    ).rejects.toMatchObject({ status: 400 })
  })

  it(`404s when the agent does not exist`, async () => {
    const app = buildApp(null)
    await expect(
      dispatch(app, { actions: [{ function: `recordProposal`, args: {} }] }).run
    ).rejects.toMatchObject({ status: 404 })
  })

  it(`403s when the agent belongs to a different org`, async () => {
    const app = buildApp(buildAgent({ orgId: `og_other001` }))
    await expect(
      dispatch(app, { actions: [{ function: `recordProposal`, args: {} }] }).run
    ).rejects.toMatchObject({ status: 403 })
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it(`403s when the agent is not bound to the project (agent_projects)`, async () => {
    const app = buildApp(buildAgent({ projects: [{ id: `pj_other001` }] as any }))
    await expect(
      dispatch(app, { actions: [{ function: `recordProposal`, args: {} }] }).run
    ).rejects.toMatchObject({ status: 403 })
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it(`isolates action failures — one failing action never aborts its siblings`, async () => {
    mockExecute
      .mockResolvedValueOnce({ success: false, output: null, duration: 1, error: `boom` })
      .mockResolvedValueOnce({ success: true, output: { ok: 1 }, duration: 1 })
    const app = buildApp()

    const { ctx, run } = dispatch(app, {
      actions: [
        { function: `recordProposal`, args: { n: 1 } },
        { function: `recordProposal`, args: { n: 2 } },
      ],
    })
    await run

    expect(ctx.json).toHaveBeenCalledWith({
      data: [
        { ok: false, error: `boom` },
        { ok: true, data: { ok: 1 } },
      ],
    })
  })
})
